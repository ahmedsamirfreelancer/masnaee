import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة العملاء
router.get('/', authorize('customers.view', '*'), async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    let query = `SELECT * FROM customers WHERE 1=1`;
    const params = [];
    if (search) {
      query += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const countQuery = `SELECT COUNT(*) as total FROM customers WHERE 1=1${search ? ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)' : ''}`;
    const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
    query += ` ORDER BY created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تفاصيل العميل
router.get('/stats/:id', authorize('customers.view', '*'), async (req, res, next) => {
  try {
    const [customer] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer.length) return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    const [orders] = await db.query(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales_orders WHERE customer_id = ? AND status != 'cancelled'`, [req.params.id]
    );
    const [payments] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE party_type = 'customer' AND party_id = ?`, [req.params.id]
    );
    res.json({
      success: true,
      data: {
        ...customer[0],
        total_orders: orders[0].total_orders,
        total_amount: orders[0].total_amount,
        total_paid: payments[0].total_paid,
        balance: customer[0].balance || 0,
      },
    });
  } catch (err) { next(err); }
});

// عميل واحد
router.get('/:id', authorize('customers.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// طلبات العميل
router.get('/:id/orders', authorize('customers.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM sales_orders WHERE customer_id = ? ORDER BY created_at DESC`, [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// مدفوعات العميل
router.get('/:id/payments', authorize('customers.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM payments WHERE party_type = 'customer' AND party_id = ? ORDER BY payment_date DESC`, [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// إنشاء عميل
router.post('/', authorize('customers.create', '*'), [
  body('name').notEmpty().withMessage('اسم العميل مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, phone, email, address, city, tax_number, notes } = req.body;
    const [result] = await db.query(
      `INSERT INTO customers (name, phone, email, address, city, tax_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email, address, city, tax_number, notes]
    );
    res.status(201).json({ success: true, message: 'تم إضافة العميل بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// تحديث عميل
router.put('/:id', authorize('customers.edit', '*'), async (req, res, next) => {
  try {
    const { name, phone, email, address, city, tax_number, notes, is_active } = req.body;
    await db.query(
      `UPDATE customers SET name=?, phone=?, email=?, address=?, city=?, tax_number=?, notes=?, is_active=? WHERE id=?`,
      [name, phone, email, address, city, tax_number, notes, is_active ?? true, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث العميل بنجاح' });
  } catch (err) { next(err); }
});

// حذف عميل
router.delete('/:id', authorize('customers.delete', '*'), async (req, res, next) => {
  try {
    await db.query('UPDATE customers SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err) { next(err); }
});

export default router;
