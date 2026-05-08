import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, searchCondition } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('products.view', '*'), async (req, res, next) => {
  try {
    const { search, category_id, is_active, page, limit } = req.query;
    let query = `SELECT p.*, c.name as category_name, u.name as unit_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN units u ON p.unit_id = u.id WHERE 1=1`;
    const params = [];
    if (search) { query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (category_id) { query += ` AND p.category_id = ?`; params.push(category_id); }
    if (is_active !== undefined) { query += ` AND p.is_active = ?`; params.push(is_active); }

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM products p WHERE 1=1${search ? ' AND (p.name LIKE ? OR p.sku LIKE ?)' : ''}${category_id ? ' AND p.category_id = ?' : ''}`, search ? [`%${search}%`, `%${search}%`, ...(category_id ? [category_id] : [])] : (category_id ? [category_id] : []));

    query += ` ORDER BY p.created_at DESC`;
    const p = paginate(query, { page, limit });
    const [rows] = await db.query(p.query, params);
    res.json({ success: true, data: rows, pagination: { page: p.page, limit: p.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

router.get('/:id', authorize('products.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name, u.name as unit_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id WHERE p.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    const [sizes] = await db.query(
      `SELECT ps.*, u.name as unit_name FROM product_sizes ps LEFT JOIN units u ON ps.unit_id = u.id WHERE ps.product_id = ?`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], sizes } });
  } catch (err) { next(err); }
});

router.post('/', authorize('products.create', '*'), [
  body('name').notEmpty().withMessage('اسم المنتج مطلوب'),
  body('unit_id').isInt().withMessage('الوحدة مطلوبة'),
  validate,
], async (req, res, next) => {
  try {
    const { name, sku, category_id, unit_id, cost_price, selling_price, min_stock, barcode, description, sizes } = req.body;
    const [result] = await db.query(
      `INSERT INTO products (name, sku, category_id, unit_id, cost_price, selling_price, min_stock, barcode, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sku, category_id, unit_id, cost_price || 0, selling_price || 0, min_stock || 0, barcode, description]
    );
    if (sizes?.length) {
      for (const s of sizes) {
        await db.query(
          `INSERT INTO product_sizes (product_id, size_label, size_value, unit_id, cost_price, selling_price, barcode)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [result.insertId, s.size_label, s.size_value, s.unit_id, s.cost_price || 0, s.selling_price || 0, s.barcode]
        );
      }
    }
    res.status(201).json({ success: true, message: 'تم إضافة المنتج بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('products.edit', '*'), async (req, res, next) => {
  try {
    const { name, sku, category_id, unit_id, cost_price, selling_price, min_stock, barcode, description, is_active } = req.body;
    await db.query(
      `UPDATE products SET name=?, sku=?, category_id=?, unit_id=?, cost_price=?, selling_price=?, min_stock=?, barcode=?, description=?, is_active=? WHERE id=?`,
      [name, sku, category_id, unit_id, cost_price, selling_price, min_stock, barcode, description, is_active, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث المنتج بنجاح' });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('products.delete', '*'), async (req, res, next) => {
  try {
    await db.query('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err) { next(err); }
});

// Product Sizes
router.post('/:id/sizes', authorize('products.edit', '*'), async (req, res, next) => {
  try {
    const { size_label, size_value, unit_id, cost_price, selling_price, barcode } = req.body;
    const [result] = await db.query(
      `INSERT INTO product_sizes (product_id, size_label, size_value, unit_id, cost_price, selling_price, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, size_label, size_value, unit_id, cost_price || 0, selling_price || 0, barcode]
    );
    res.status(201).json({ success: true, message: 'تم إضافة الحجم بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// Categories
router.get('/meta/categories', async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories WHERE type = 'product' ORDER BY name");
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export default router;
