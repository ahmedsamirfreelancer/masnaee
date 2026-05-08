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
    const { category_id, date_from, date_to, page, limit } = req.query;
    let query = `SELECT e.*, ec.name as category_name, u.full_name as created_by_name
                 FROM expenses e
                 LEFT JOIN expense_categories ec ON e.category_id = ec.id
                 LEFT JOIN users u ON e.created_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (category_id) { query += ` AND e.category_id = ?`; params.push(category_id); }
    if (date_from) { query += ` AND DATE(e.expense_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(e.expense_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT e\.\*, ec\.name.*created_by_name/, 'SELECT COUNT(*) as total');
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
  body('category_id').isInt().withMessage('التصنيف مطلوب'),
  body('description').notEmpty().withMessage('الوصف مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { amount, category_id, description, expense_date, payment_method, account_id } = req.body;

    const [last] = await conn.query('SELECT id FROM expenses ORDER BY id DESC LIMIT 1');
    const seq = last.length ? last[0].id + 1 : 1;
    const expense_number = generateNumber('EXP', seq);

    const [result] = await conn.query(
      `INSERT INTO expenses (expense_number, amount, category_id, description, expense_date, payment_method, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [expense_number, amount, category_id, description, expense_date || new Date(), payment_method || 'cash', req.user.id]
    );

    // قيد محاسبي: مدين حساب المصروف - دائن الصندوق/البنك
    const [category] = await conn.query('SELECT account_id FROM expense_categories WHERE id = ?', [category_id]);
    const expenseAccountId = category.length && category[0].account_id
      ? category[0].account_id
      : null;

    const cashAccountCode = payment_method === 'bank' ? '1120' : '1110';

    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, is_posted, created_by)
       VALUES (?, ?, 'expense', ?, ?, TRUE, ?)`,
      [generateNumber('JE', result.insertId), expense_date || new Date(), result.insertId, `مصروف: ${description}`, req.user.id]
    );

    if (expenseAccountId) {
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, ?, 0, ?)`,
        [jeResult.insertId, expenseAccountId, amount, description]
      );
    } else {
      // حساب مصروفات عامة 5100
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '5100' LIMIT 1), ?, 0, ?)`,
        [jeResult.insertId, amount, description]
      );
    }

    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = ? LIMIT 1), 0, ?, ?)`,
      [jeResult.insertId, cashAccountCode, amount, description]
    );

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
    const { amount, category_id, description, expense_date, payment_method } = req.body;
    await db.query(
      `UPDATE expenses SET amount=?, category_id=?, description=?, expense_date=?, payment_method=? WHERE id=?`,
      [amount, category_id, description, expense_date, payment_method, req.params.id]
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
      const [jeResult] = await conn.query(
        `INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, is_posted, created_by)
         VALUES (?, NOW(), 'expense_reversal', ?, ?, TRUE, ?)`,
        [generateNumber('JE', expense[0].id + 10000), req.params.id, `عكس مصروف: ${expense[0].description}`, req.user.id]
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

// تصنيفات المصروفات
router.get('/categories', authorize('expenses.view', 'expenses.*', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM expense_categories ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ملخص المصروفات حسب التصنيف
router.get('/summary', authorize('expenses.view', 'expenses.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    let query = `SELECT ec.id, ec.name as category_name, COUNT(e.id) as count, COALESCE(SUM(e.amount), 0) as total
                 FROM expense_categories ec
                 LEFT JOIN expenses e ON ec.id = e.category_id`;
    const params = [];
    const conditions = [];
    if (date_from) { conditions.push('DATE(e.expense_date) >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('DATE(e.expense_date) <= ?'); params.push(date_to); }
    if (conditions.length) query += ` AND ${conditions.join(' AND ')}`;
    query += ` GROUP BY ec.id, ec.name ORDER BY total DESC`;

    const [rows] = await db.query(query, params);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    res.json({ success: true, data: { categories: rows, grand_total: grandTotal } });
  } catch (err) { next(err); }
});

export default router;
