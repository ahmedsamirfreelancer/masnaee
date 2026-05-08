import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة المصروفات
router.get('/', authorize('expenses.view', 'expenses.*', '*'), async (req, res, next) => {
  try {
    const { category, date_from, date_to, page, limit } = req.query;
    let query = `SELECT e.*, u.full_name as created_by_name, pm.name as payment_method_name,
                        coa.name as account_name
                 FROM expenses e
                 LEFT JOIN users u ON e.created_by = u.id
                 LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
                 LEFT JOIN chart_of_accounts coa ON e.account_id = coa.id
                 WHERE 1=1`;
    const params = [];
    if (category) { query += ` AND e.category = ?`; params.push(category); }
    if (date_from) { query += ` AND DATE(e.expense_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(e.expense_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT e\.\*, u\.full_name.*account_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY e.expense_date DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// إنشاء مصروف
router.post('/', authorize('expenses.create', 'expenses.*', '*'), [
  body('amount').isFloat({ gt: 0 }).withMessage('المبلغ مطلوب'),
  body('category').isIn(['rent', 'utilities', 'fuel', 'maintenance', 'supplies', 'marketing', 'other']).withMessage('التصنيف مطلوب'),
  body('description').notEmpty().withMessage('الوصف مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { amount, category, description, expense_date, payment_method_id, account_id } = req.body;

    const [last] = await conn.query('SELECT id FROM expenses ORDER BY id DESC LIMIT 1');
    const seq = last.length ? last[0].id + 1 : 1;
    const expense_number = generateNumber('EXP', seq);

    const pmId = payment_method_id || 1; // default cash
    const accId = account_id || (await conn.query("SELECT id FROM chart_of_accounts WHERE code = '5201' LIMIT 1"))[0][0]?.id;

    const [result] = await conn.query(
      `INSERT INTO expenses (expense_number, amount, category, description, expense_date, payment_method_id, account_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [expense_number, amount, category, description, expense_date || new Date(), pmId, accId, req.user.id]
    );

    // قيد محاسبي: مدين حساب المصروف - دائن الصندوق/البنك
    const [pmRows] = await conn.query('SELECT account_id FROM payment_methods WHERE id = ?', [pmId]);
    const cashAccountId = pmRows.length ? pmRows[0].account_id : null;

    const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
    const fiscalYearId = fyRow.length ? fyRow[0].id : 1;

    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
       VALUES (?, ?, ?, 'expense', ?, ?, TRUE, ?, ?, ?)`,
      [generateNumber('JE', result.insertId), fiscalYearId, expense_date || new Date(), result.insertId, `مصروف: ${description}`, amount, amount, req.user.id]
    );

    // مدين: حساب المصروف
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, 0, ?)`,
      [jeResult.insertId, accId, amount, description]
    );

    // دائن: الصندوق/البنك
    if (cashAccountId) {
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, 0, ?, ?)`,
        [jeResult.insertId, cashAccountId, amount, description]
      );
    }

    await conn.query('UPDATE expenses SET journal_entry_id = ? WHERE id = ?', [jeResult.insertId, result.insertId]);

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إضافة المصروف بنجاح', data: { id: result.insertId, expense_number } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تحديث مصروف
router.put('/:id', authorize('expenses.edit', 'expenses.*', '*'), async (req, res, next) => {
  try {
    const { amount, category, description, expense_date } = req.body;
    await db.query(
      `UPDATE expenses SET amount=?, category=?, description=?, expense_date=? WHERE id=?`,
      [amount, category, description, expense_date, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث المصروف بنجاح' });
  } catch (err) { next(err); }
});

// حذف مصروف (عكس القيد)
router.delete('/:id', authorize('expenses.delete', 'expenses.*', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [expense] = await conn.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (!expense.length) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });

    // عكس القيد المحاسبي
    if (expense[0].journal_entry_id) {
      const [lines] = await conn.query(
        'SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?', [expense[0].journal_entry_id]
      );
      const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
      const fiscalYearId = fyRow.length ? fyRow[0].id : 1;
      const totalAmount = lines.reduce((s, l) => s + l.debit, 0);

      const [jeResult] = await conn.query(
        `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
         VALUES (?, ?, NOW(), 'adjustment', ?, ?, TRUE, ?, ?, ?)`,
        [generateNumber('JE', expense[0].id + 10000), fiscalYearId, req.params.id, `عكس مصروف: ${expense[0].description}`, totalAmount, totalAmount, req.user.id]
      );
      for (const line of lines) {
        await conn.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES (?, ?, ?, ?, ?)`,
          [jeResult.insertId, line.account_id, line.credit, line.debit, `عكس: ${line.description}`]
        );
        await conn.query(
          'UPDATE chart_of_accounts SET balance = balance + ? - ? WHERE id = ?',
          [line.credit, line.debit, line.account_id]
        );
      }
    }

    await conn.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تصنيفات المصروفات (from ENUM values)
router.get('/categories', authorize('expenses.view', 'expenses.*', '*'), async (req, res, next) => {
  try {
    const categories = [
      { id: 'rent', name: 'إيجارات' },
      { id: 'utilities', name: 'كهرباء ومياه' },
      { id: 'fuel', name: 'وقود ومحروقات' },
      { id: 'maintenance', name: 'صيانة وإصلاحات' },
      { id: 'supplies', name: 'مستلزمات' },
      { id: 'marketing', name: 'تسويق وإعلان' },
      { id: 'other', name: 'أخرى' },
    ];
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

// ملخص المصروفات حسب التصنيف
router.get('/summary', authorize('expenses.view', 'expenses.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    let query = `SELECT e.category, COUNT(e.id) as count, COALESCE(SUM(e.amount), 0) as total
                 FROM expenses e WHERE 1=1`;
    const params = [];
    if (date_from) { query += ` AND DATE(e.expense_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(e.expense_date) <= ?`; params.push(date_to); }
    query += ` GROUP BY e.category ORDER BY total DESC`;

    const [rows] = await db.query(query, params);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    res.json({ success: true, data: { categories: rows, grand_total: grandTotal } });
  } catch (err) { next(err); }
});

export default router;
