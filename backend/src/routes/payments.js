import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة المدفوعات
router.get('/', authorize('payments.view', 'payments.*', '*'), async (req, res, next) => {
  try {
    const { type, date_from, date_to, page, limit } = req.query;
    let query = `SELECT p.*, pm.name as payment_method_name, u.full_name as created_by_name
                 FROM payments p
                 LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
                 LEFT JOIN users u ON p.created_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (type) { query += ` AND p.type = ?`; params.push(type); }
    if (date_from) { query += ` AND DATE(p.payment_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(p.payment_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT p\.\*, pm\.name.*created_by_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY p.payment_date DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// إنشاء دفعة
router.post('/', authorize('payments.create', 'payments.*', '*'), [
  body('type').isIn(['received', 'made']).withMessage('نوع الدفعة غير صالح'),
  body('related_type').isIn(['sale', 'purchase', 'expense', 'salary', 'other']).withMessage('نوع المرجع غير صالح'),
  body('amount').isFloat({ gt: 0 }).withMessage('المبلغ مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { type: payType, related_type, related_id, amount, payment_method_id, payment_date, reference, notes } = req.body;

    const [last] = await conn.query('SELECT id FROM payments ORDER BY id DESC LIMIT 1');
    const seq = last.length ? last[0].id + 1 : 1;
    const payment_number = generateNumber('PAY', seq);

    const pmId = payment_method_id || 1; // default cash

    const [result] = await conn.query(
      `INSERT INTO payments (payment_number, type, related_type, related_id, payment_method_id, amount, payment_date, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payment_number, payType, related_type, related_id || null, pmId, amount, payment_date || new Date(), reference, notes, req.user.id]
    );

    // تحديث حالة سداد الأوامر المرتبطة
    if (related_id) {
      if (related_type === 'sale') {
        const [order] = await conn.query('SELECT total_amount, customer_id FROM sales_orders WHERE id = ?', [related_id]);
        if (order.length) {
          await conn.query('UPDATE sales_orders SET paid_amount = paid_amount + ? WHERE id = ?', [amount, related_id]);
          const newPaid = (order[0].paid_amount || 0) + amount;
          const paymentStatus = newPaid >= order[0].total_amount ? 'paid' : 'partial';
          await conn.query('UPDATE sales_orders SET payment_status = ? WHERE id = ?', [paymentStatus, related_id]);
          // Update customer balance
          await conn.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [amount, order[0].customer_id]);
        }
      } else if (related_type === 'purchase') {
        const [order] = await conn.query('SELECT total_amount, supplier_id FROM purchase_orders WHERE id = ?', [related_id]);
        if (order.length) {
          await conn.query('UPDATE purchase_orders SET paid_amount = paid_amount + ? WHERE id = ?', [amount, related_id]);
          const newPaid = (order[0].paid_amount || 0) + amount;
          const paymentStatus = newPaid >= order[0].total_amount ? 'paid' : 'partial';
          await conn.query('UPDATE purchase_orders SET payment_status = ? WHERE id = ?', [paymentStatus, related_id]);
          // Update supplier balance
          await conn.query('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [amount, order[0].supplier_id]);
        }
      }
    }

    // قيد محاسبي
    const [pmRows] = await conn.query('SELECT account_id FROM payment_methods WHERE id = ?', [pmId]);
    const cashAccountId = pmRows.length ? pmRows[0].account_id : null;

    const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
    const fiscalYearId = fyRow.length ? fyRow[0].id : 1;

    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
       VALUES (?, ?, ?, 'payment', ?, ?, TRUE, ?, ?, ?)`,
      [generateNumber('JE', result.insertId), fiscalYearId, payment_date || new Date(), result.insertId, `دفعة ${payment_number}`, amount, amount, req.user.id]
    );

    // Update payment with journal_entry_id
    await conn.query('UPDATE payments SET journal_entry_id = ? WHERE id = ?', [jeResult.insertId, result.insertId]);

    if (payType === 'received' && cashAccountId) {
      // مقبوض: مدين الصندوق/البنك - دائن العملاء
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, ?, 0, ?)`,
        [jeResult.insertId, cashAccountId, amount, `مقبوض - ${payment_number}`]
      );
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '1103' LIMIT 1), 0, ?, ?)`,
        [jeResult.insertId, amount, `مقبوض - ${payment_number}`]
      );
    } else if (payType === 'made' && cashAccountId) {
      // مدفوع: مدين الموردين - دائن الصندوق/البنك
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '2101' LIMIT 1), ?, 0, ?)`,
        [jeResult.insertId, amount, `مدفوع - ${payment_number}`]
      );
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, 0, ?, ?)`,
        [jeResult.insertId, cashAccountId, amount, `مدفوع - ${payment_number}`]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء الدفعة بنجاح', data: { id: result.insertId, payment_number } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// صندوق اليوم
router.get('/cash-register', authorize('payments.view', 'payments.*', '*'), async (req, res, next) => {
  try {
    const [register] = await db.query(
      `SELECT * FROM cash_register WHERE date = CURDATE() ORDER BY id DESC LIMIT 1`
    );
    if (!register.length) return res.json({ success: true, data: null, message: 'لم يتم فتح الصندوق اليوم' });

    const [received] = await db.query(
      `SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       WHERE p.type = 'received' AND pm.name = 'نقدي'
       AND DATE(p.payment_date) = CURDATE()`
    );
    const [made] = await db.query(
      `SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       WHERE p.type = 'made' AND pm.name = 'نقدي'
       AND DATE(p.payment_date) = CURDATE()`
    );
    const [expensesTotal] = await db.query(
      `SELECT COALESCE(SUM(e.amount), 0) as total FROM expenses e
       JOIN payment_methods pm ON e.payment_method_id = pm.id
       WHERE pm.name = 'نقدي' AND DATE(e.expense_date) = CURDATE()`
    );

    res.json({
      success: true,
      data: {
        register: register[0],
        opening_balance: register[0].opening_balance,
        total_received: received[0].total,
        total_paid: made[0].total,
        total_expenses: expensesTotal[0].total,
        current_balance: register[0].opening_balance + received[0].total - made[0].total - expensesTotal[0].total,
      },
    });
  } catch (err) { next(err); }
});

// فتح الصندوق
router.post('/cash-register/open', authorize('payments.create', 'payments.*', '*'), [
  body('opening_balance').isFloat({ min: 0 }).withMessage('رصيد الافتتاح مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { opening_balance } = req.body;
    const [existing] = await db.query(
      `SELECT id FROM cash_register WHERE date = CURDATE() AND closing_balance IS NULL`
    );
    if (existing.length) return res.status(400).json({ success: false, message: 'الصندوق مفتوح بالفعل' });

    const [result] = await db.query(
      `INSERT INTO cash_register (opening_balance, date, opened_by) VALUES (?, CURDATE(), ?)`,
      [opening_balance, req.user.id]
    );
    res.status(201).json({ success: true, message: 'تم فتح الصندوق بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// إغلاق الصندوق
router.post('/cash-register/close', authorize('payments.create', 'payments.*', '*'), [
  body('closing_balance').isFloat({ min: 0 }).withMessage('رصيد الإغلاق مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { closing_balance, notes } = req.body;
    const [register] = await db.query(
      `SELECT * FROM cash_register WHERE date = CURDATE() AND closing_balance IS NULL ORDER BY id DESC LIMIT 1`
    );
    if (!register.length) return res.status(400).json({ success: false, message: 'لا يوجد صندوق مفتوح' });

    await db.query(
      `UPDATE cash_register SET closing_balance = ?, closed_by = ?, notes = ? WHERE id = ?`,
      [closing_balance, req.user.id, notes, register[0].id]
    );
    res.json({ success: true, message: 'تم إغلاق الصندوق بنجاح' });
  } catch (err) { next(err); }
});

export default router;
