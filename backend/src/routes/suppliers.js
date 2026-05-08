import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة الموردين
router.get('/', authorize('suppliers.view', '*'), async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    let query = `SELECT * FROM suppliers WHERE 1=1`;
    const params = [];
    if (search) {
      query += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const countQuery = `SELECT COUNT(*) as total FROM suppliers WHERE 1=1${search ? ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)' : ''}`;
    const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
    query += ` ORDER BY created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// مورد واحد
router.get('/:id', authorize('suppliers.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// أوامر شراء المورد
router.get('/:id/orders', authorize('suppliers.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC`, [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// مدفوعات المورد
router.get('/:id/payments', authorize('suppliers.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM payments WHERE party_type = 'supplier' AND party_id = ? ORDER BY payment_date DESC`, [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// إنشاء مورد
router.post('/', authorize('suppliers.create', '*'), [
  body('name').notEmpty().withMessage('اسم المورد مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, phone, email, address, city, tax_number, contact_person, notes } = req.body;
    const [result] = await db.query(
      `INSERT INTO suppliers (name, phone, email, address, city, tax_number, contact_person, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email, address, city, tax_number, contact_person, notes]
    );
    res.status(201).json({ success: true, message: 'تم إضافة المورد بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// تحديث مورد
router.put('/:id', authorize('suppliers.edit', '*'), async (req, res, next) => {
  try {
    const { name, phone, email, address, city, tax_number, contact_person, notes, is_active } = req.body;
    await db.query(
      `UPDATE suppliers SET name=?, phone=?, email=?, address=?, city=?, tax_number=?, contact_person=?, notes=?, is_active=? WHERE id=?`,
      [name, phone, email, address, city, tax_number, contact_person, notes, is_active ?? true, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث المورد بنجاح' });
  } catch (err) { next(err); }
});

// حذف مورد
router.delete('/:id', authorize('suppliers.delete', '*'), async (req, res, next) => {
  try {
    await db.query('UPDATE suppliers SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'تم حذف المورد بنجاح' });
  } catch (err) { next(err); }
});

export default router;
