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
    let query = `SELECT p.*, u.full_name as created_by_name
                 FROM payments p
                 LEFT JOIN users u ON p.created_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (type) { query += ` AND p.payment_type = ?`; params.push(type); }
    if (date_from) { query += ` AND DATE(p.payment_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(p.payment_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT p\.\*, u\.full_name as created_by_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY p.payment_date DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// إنشاء دفعة
router.post('/', authorize('payments.create', 'payments.*', '*'), [
  body('payment_type').isIn(['received', 'made']).withMessage('نوع الدفعة غير صالح'),
  body('party_type').isIn(['customer', 'supplier']).withMessage('نوع الطرف غير صالح'),
  body('party_id').isInt().withMessage('الطرف مطلوب'),
  body('amount').isFloat({ gt: 0 }).withMessage('المبلغ مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { payment_type, party_type, party_id, amount, payment_method, payment_date, reference, notes } = req.body;

    const [last] = await conn.query('SELECT id FROM payments ORDER BY id DESC LIMIT 1');
    const seq = last.length ? last[0].id + 1 : 1;
    const payment_number = generateNumber('PAY', seq);

    const [result] = await conn.query(
      `INSERT INTO payments (payment_number, payment_type, party_type, party_id, amount, payment_method, payment_date, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payment_number, payment_type, party_type, party_id, amount, payment_method || 'cash', payment_date || new Date(), reference, notes, req.user.id]
    );

    // تحديث الرصيد
    const balanceTable = party_type === 'customer' ? 'customers' : 'suppliers';
    if (payment_type === 'received') {
      // مقبوض من عميل: خصم من رصيد العميل
      await conn.query(`UPDATE ${balanceTable} SET balance = balance - ? WHERE id = ?`, [amount, party_id]);
    } else {
      // مدفوع لمورد: خصم من رصيد المورد
      await conn.query(`UPDATE ${balanceTable} SET balance = balance - ? WHERE id = ?`, [amount, party_id]);
    }

    // تحديث حالة سداد الأوامر المرتبطة
    if (req.body.order_id) {
      const orderTable = party_type === 'customer' ? 'sales_orders' : 'purchase_orders';
      const [order] = await conn.query(`SELECT total_amount FROM ${orderTable} WHERE id = ?`, [req.body.order_id]);
      if (order.length) {
        const [paidResult] = await conn.query(
          `SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE party_type = ? AND party_id = ? AND order_id = ?`,
          [party_type, party_id, req.body.order_id]
        );
        const totalPaid = paidResult[0].paid + amount;
        const paymentStatus = totalPaid >= order[0].total_amount ? 'paid' : 'partial';
        await conn.query(`UPDATE ${orderTable} SET payment_status = ? WHERE id = ?`, [paymentStatus, req.body.order_id]);
      }
    }

    // قيد محاسبي
    const cashAccountCode = payment_method === 'bank' ? '1120' : '1110';
    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, is_posted, created_by)
       VALUES (?, ?, 'payment', ?, ?, TRUE, ?)`,
      [generateNumber('JE', result.insertId), payment_date || new Date(), result.insertId, `دفعة ${payment_number}`, req.user.id]
    );

    if (payment_type === 'received') {
      // مقبوض: مدين الصندوق/البنك - دائن العملاء
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = ? LIMIT 1), ?, 0, ?)`,
        [jeResult.insertId, cashAccountCode, amount, `مقبوض من عميل - ${payment_number}`]
      );
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '1200' LIMIT 1), 0, ?, ?)`,
        [jeResult.insertId, amount, `مقبوض من عميل - ${payment_number}`]
      );
    } else {
      // مدفوع: مدين الموردين - دائن الصندوق/البنك
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '2100' LIMIT 1), ?, 0, ?)`,
        [jeResult.insertId, amount, `مدفوع لمورد - ${payment_number}`]
      );
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = ? LIMIT 1), 0, ?, ?)`,
        [jeResult.insertId, cashAccountCode, amount, `مدفوع لمورد - ${payment_number}`]
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
      `SELECT * FROM cash_registers WHERE DATE(opened_at) = CURDATE() ORDER BY id DESC LIMIT 1`
    );
    if (!register.length) return res.json({ success: true, data: null, message: 'لم يتم فتح الصندوق اليوم' });

    const [received] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE payment_type = 'received' AND payment_method = 'cash'
       AND DATE(payment_date) = CURDATE()`
    );
    const [made] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE payment_type = 'made' AND payment_method = 'cash'
       AND DATE(payment_date) = CURDATE()`
    );
    const [expensesTotal] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE payment_method = 'cash' AND DATE(expense_date) = CURDATE()`
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
      `SELECT id FROM cash_registers WHERE DATE(opened_at) = CURDATE() AND closed_at IS NULL`
    );
    if (existing.length) return res.status(400).json({ success: false, message: 'الصندوق مفتوح بالفعل' });

    const [result] = await db.query(
      `INSERT INTO cash_registers (opening_balance, opened_by, opened_at) VALUES (?, ?, NOW())`,
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
      `SELECT * FROM cash_registers WHERE DATE(opened_at) = CURDATE() AND closed_at IS NULL ORDER BY id DESC LIMIT 1`
    );
    if (!register.length) return res.status(400).json({ success: false, message: 'لا يوجد صندوق مفتوح' });

    await db.query(
      `UPDATE cash_registers SET closing_balance = ?, closed_by = ?, closed_at = NOW(), notes = ? WHERE id = ?`,
      [closing_balance, req.user.id, notes, register[0].id]
    );
    res.json({ success: true, message: 'تم إغلاق الصندوق بنجاح' });
  } catch (err) { next(err); }
});

export default router;
