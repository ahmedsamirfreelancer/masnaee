import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// ===================== دليل الحسابات =====================

// شجرة الحسابات
router.get('/chart-of-accounts', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT coa.*, parent.name as parent_name
       FROM chart_of_accounts coa
       LEFT JOIN chart_of_accounts parent ON coa.parent_id = parent.id
       ORDER BY coa.code`
    );

    // بناء الشجرة
    const map = {};
    const tree = [];
    for (const row of rows) {
      map[row.id] = { ...row, children: [] };
    }
    for (const row of rows) {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].children.push(map[row.id]);
      } else {
        tree.push(map[row.id]);
      }
    }

    res.json({ success: true, data: tree, flat: rows });
  } catch (err) { next(err); }
});

// إضافة حساب
router.post('/chart-of-accounts', authorize('accounting.create', 'accounting.*', '*'), [
  body('code').notEmpty().withMessage('رمز الحساب مطلوب'),
  body('name').notEmpty().withMessage('اسم الحساب مطلوب'),
  body('account_type').isIn([1, 2, 3, 4, 5]).withMessage('نوع الحساب غير صالح'),
  validate,
], async (req, res, next) => {
  try {
    const { code, name, account_type, parent_id, description, is_active } = req.body;
    const [existing] = await db.query('SELECT id FROM chart_of_accounts WHERE code = ?', [code]);
    if (existing.length) return res.status(400).json({ success: false, message: 'رمز الحساب مستخدم بالفعل' });
    const [result] = await db.query(
      `INSERT INTO chart_of_accounts (code, name, account_type, parent_id, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, account_type, parent_id || null, description, is_active ?? true]
    );
    res.status(201).json({ success: true, message: 'تم إضافة الحساب بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// تعديل حساب (غير النظام)
router.put('/chart-of-accounts/:id', authorize('accounting.edit', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const [account] = await db.query('SELECT * FROM chart_of_accounts WHERE id = ?', [req.params.id]);
    if (!account.length) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    if (account[0].is_system) return res.status(400).json({ success: false, message: 'لا يمكن تعديل حساب نظام' });
    const { name, description, parent_id, is_active } = req.body;
    await db.query(
      `UPDATE chart_of_accounts SET name=?, description=?, parent_id=?, is_active=? WHERE id=?`,
      [name || account[0].name, description, parent_id, is_active ?? true, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث الحساب بنجاح' });
  } catch (err) { next(err); }
});

// ===================== القيود اليومية =====================

// قائمة القيود
router.get('/journal-entries', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to, reference_type, is_posted, page, limit } = req.query;
    let query = `SELECT je.*, u.full_name as created_by_name
                 FROM journal_entries je
                 LEFT JOIN users u ON je.created_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (date_from) { query += ` AND DATE(je.entry_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(je.entry_date) <= ?`; params.push(date_to); }
    if (reference_type) { query += ` AND je.reference_type = ?`; params.push(reference_type); }
    if (is_posted !== undefined) { query += ` AND je.is_posted = ?`; params.push(is_posted === 'true' ? 1 : 0); }
    const countQuery = query.replace(/SELECT je\.\*, u\.full_name as created_by_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY je.entry_date DESC, je.id DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تفاصيل القيد
router.get('/journal-entries/:id', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT je.*, u.full_name as created_by_name
       FROM journal_entries je LEFT JOIN users u ON je.created_by = u.id
       WHERE je.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'القيد غير موجود' });
    const [lines] = await db.query(
      `SELECT jel.*, coa.code as account_code, coa.name as account_name
       FROM journal_entry_lines jel
       LEFT JOIN chart_of_accounts coa ON jel.account_id = coa.id
       WHERE jel.journal_entry_id = ?`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], lines } });
  } catch (err) { next(err); }
});

// إنشاء قيد يدوي
router.post('/journal-entries', authorize('accounting.create', 'accounting.*', '*'), [
  body('entry_date').notEmpty().withMessage('تاريخ القيد مطلوب'),
  body('lines').isArray({ min: 2 }).withMessage('يجب إضافة سطرين على الأقل'),
  body('description').notEmpty().withMessage('وصف القيد مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { entry_date, description, lines, reference_type, reference_id } = req.body;

    // التحقق من أن المدين = الدائن
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit})`,
      });
    }

    await conn.beginTransaction();

    const [last] = await conn.query('SELECT id FROM journal_entries ORDER BY id DESC LIMIT 1');
    const seq = last.length ? last[0].id + 1 : 1;
    const entry_number = generateNumber('JE', seq);

    const [result] = await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
      [entry_number, entry_date, description, reference_type || 'manual', reference_id || null, totalDebit, totalCredit, req.user.id]
    );
    const jeId = result.insertId;

    for (const line of lines) {
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, ?, ?, ?)`,
        [jeId, line.account_id, parseFloat(line.debit || 0), parseFloat(line.credit || 0), line.description || '']
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء القيد بنجاح', data: { id: jeId, entry_number } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// ترحيل القيد
router.put('/journal-entries/:id/post', authorize('accounting.edit', 'accounting.*', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [entries] = await conn.query('SELECT * FROM journal_entries WHERE id = ? AND is_posted = FALSE', [req.params.id]);
    if (!entries.length) return res.status(400).json({ success: false, message: 'القيد غير موجود أو مرحل بالفعل' });

    const [lines] = await conn.query('SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?', [req.params.id]);

    // تحديث أرصدة الحسابات
    for (const line of lines) {
      await conn.query(
        `UPDATE chart_of_accounts SET balance = balance + ? - ? WHERE id = ?`,
        [line.debit, line.credit, line.account_id]
      );
    }

    await conn.query('UPDATE journal_entries SET is_posted = TRUE, posted_at = NOW() WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'تم ترحيل القيد بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// ===================== التقارير المالية =====================

// ميزان المراجعة
router.get('/trial-balance', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    const params = [];
    if (date_from) { dateFilter += ' AND je.entry_date >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND je.entry_date <= ?'; params.push(date_to); }

    const [rows] = await db.query(
      `SELECT coa.id, coa.code, coa.name, coa.account_type,
              COALESCE(SUM(jel.debit), 0) as total_debit,
              COALESCE(SUM(jel.credit), 0) as total_credit,
              COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as net_balance
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
       LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = TRUE ${dateFilter}
       WHERE coa.is_active = TRUE
       GROUP BY coa.id, coa.code, coa.name, coa.account_type
       HAVING total_debit > 0 OR total_credit > 0
       ORDER BY coa.code`,
      params
    );

    const totals = rows.reduce((acc, r) => ({
      total_debit: acc.total_debit + r.total_debit,
      total_credit: acc.total_credit + r.total_credit,
    }), { total_debit: 0, total_credit: 0 });

    res.json({ success: true, data: { accounts: rows, totals } });
  } catch (err) { next(err); }
});

// قائمة الدخل
router.get('/income-statement', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    const dateParams = [];
    if (date_from) { dateFilter += ' AND je.entry_date >= ?'; dateParams.push(date_from); }
    if (date_to) { dateFilter += ' AND je.entry_date <= ?'; dateParams.push(date_to); }

    // الإيرادات (نوع 4) - الدائن أكبر من المدين = إيراد
    const [revenue] = await db.query(
      `SELECT coa.id, coa.code, coa.name,
              COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0) as amount
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
       LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = TRUE ${dateFilter}
       WHERE coa.account_type = 4 AND coa.is_active = TRUE
       GROUP BY coa.id, coa.code, coa.name
       ORDER BY coa.code`,
      dateParams
    );

    // المصروفات (نوع 5) - المدين أكبر من الدائن = مصروف
    const [expenses] = await db.query(
      `SELECT coa.id, coa.code, coa.name,
              COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as amount
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
       LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = TRUE ${dateFilter}
       WHERE coa.account_type = 5 AND coa.is_active = TRUE
       GROUP BY coa.id, coa.code, coa.name
       ORDER BY coa.code`,
      dateParams
    );

    const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenses.reduce((sum, r) => sum + r.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        revenue,
        expenses,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
      },
    });
  } catch (err) { next(err); }
});

// الميزانية العمومية
router.get('/balance-sheet', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const { date } = req.query;
    const asOfDate = date || new Date().toISOString().split('T')[0];

    // الأصول (نوع 1)
    const [assets] = await db.query(
      `SELECT coa.id, coa.code, coa.name,
              COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
       LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = TRUE AND je.entry_date <= ?
       WHERE coa.account_type = 1 AND coa.is_active = TRUE
       GROUP BY coa.id, coa.code, coa.name
       ORDER BY coa.code`, [asOfDate]
    );

    // الخصوم (نوع 2)
    const [liabilities] = await db.query(
      `SELECT coa.id, coa.code, coa.name,
              COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0) as balance
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
       LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = TRUE AND je.entry_date <= ?
       WHERE coa.account_type = 2 AND coa.is_active = TRUE
       GROUP BY coa.id, coa.code, coa.name
       ORDER BY coa.code`, [asOfDate]
    );

    // حقوق الملكية (نوع 3)
    const [equity] = await db.query(
      `SELECT coa.id, coa.code, coa.name,
              COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0) as balance
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
       LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = TRUE AND je.entry_date <= ?
       WHERE coa.account_type = 3 AND coa.is_active = TRUE
       GROUP BY coa.id, coa.code, coa.name
       ORDER BY coa.code`, [asOfDate]
    );

    // صافي الربح (إيرادات - مصروفات) حتى التاريخ
    const [incomeResult] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN coa.account_type = 4 THEN jel.credit - jel.debit ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN coa.account_type = 5 THEN jel.debit - jel.credit ELSE 0 END), 0) as net_income
       FROM journal_entry_lines jel
       JOIN chart_of_accounts coa ON jel.account_id = coa.id
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE je.is_posted = TRUE AND je.entry_date <= ? AND coa.account_type IN (4, 5)`, [asOfDate]
    );

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
    const netIncome = incomeResult[0].net_income || 0;

    res.json({
      success: true,
      data: {
        as_of_date: asOfDate,
        assets,
        liabilities,
        equity,
        net_income: netIncome,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        total_liabilities_and_equity: totalLiabilities + totalEquity + netIncome,
        is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01,
      },
    });
  } catch (err) { next(err); }
});

// كشف حساب
router.get('/ledger/:accountId', authorize('accounting.view', 'accounting.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const [account] = await db.query('SELECT * FROM chart_of_accounts WHERE id = ?', [req.params.accountId]);
    if (!account.length) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });

    let query = `SELECT jel.*, je.entry_number, je.entry_date, je.description as entry_description, je.reference_type, je.reference_id
                 FROM journal_entry_lines jel
                 JOIN journal_entries je ON jel.journal_entry_id = je.id
                 WHERE je.is_posted = TRUE AND jel.account_id = ?`;
    const params = [req.params.accountId];
    if (date_from) { query += ` AND je.entry_date >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND je.entry_date <= ?`; params.push(date_to); }
    query += ` ORDER BY je.entry_date, je.id`;

    const [transactions] = await db.query(query, params);

    // حساب الرصيد التراكمي
    let runningBalance = 0;
    const rows = transactions.map(t => {
      runningBalance += t.debit - t.credit;
      return { ...t, running_balance: runningBalance };
    });

    res.json({
      success: true,
      data: {
        account: account[0],
        transactions: rows,
        total_debit: rows.reduce((s, r) => s + r.debit, 0),
        total_credit: rows.reduce((s, r) => s + r.credit, 0),
        closing_balance: runningBalance,
      },
    });
  } catch (err) { next(err); }
});

export default router;
