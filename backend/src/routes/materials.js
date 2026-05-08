import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('materials.view', 'products.view', '*'), async (req, res, next) => {
  try {
    const { search, category_id, page, limit } = req.query;
    let query = `SELECT m.*, c.name as category_name, u.name as unit_name
                 FROM raw_materials m LEFT JOIN categories c ON m.category_id = c.id
                 LEFT JOIN units u ON m.unit_id = u.id WHERE m.is_active = TRUE`;
    const params = [];
    if (search) { query += ` AND m.name LIKE ?`; params.push(`%${search}%`); }
    if (category_id) { query += ` AND m.category_id = ?`; params.push(category_id); }
    query += ` ORDER BY m.name`;
    const p = paginate(query, { page, limit });
    const [rows] = await db.query(p.query, params);
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM raw_materials WHERE is_active = TRUE');
    res.json({ success: true, data: rows, pagination: { page: p.page, limit: p.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

router.get('/low-stock', authorize('materials.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, u.name as unit_name FROM raw_materials m
       LEFT JOIN units u ON m.unit_id = u.id
       WHERE m.is_active = TRUE AND m.current_stock <= m.min_stock ORDER BY (m.current_stock / GREATEST(m.min_stock, 1))`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', authorize('materials.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, c.name as category_name, u.name as unit_name
       FROM raw_materials m LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN units u ON m.unit_id = u.id WHERE m.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'الخامة غير موجودة' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

router.post('/', authorize('materials.create', '*'), [
  body('name').notEmpty().withMessage('اسم الخامة مطلوب'),
  body('unit_id').isInt().withMessage('الوحدة مطلوبة'),
  validate,
], async (req, res, next) => {
  try {
    const { name, category_id, unit_id, cost_price, min_stock, description } = req.body;
    const [result] = await db.query(
      `INSERT INTO raw_materials (name, category_id, unit_id, cost_price, min_stock, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category_id, unit_id, cost_price || 0, min_stock || 0, description]
    );
    res.status(201).json({ success: true, message: 'تم إضافة الخامة بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('materials.edit', '*'), async (req, res, next) => {
  try {
    const { name, category_id, unit_id, cost_price, min_stock, description, is_active } = req.body;
    await db.query(
      `UPDATE raw_materials SET name=?, category_id=?, unit_id=?, cost_price=?, min_stock=?, description=?, is_active=? WHERE id=?`,
      [name, category_id, unit_id, cost_price, min_stock, description, is_active, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث الخامة بنجاح' });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('materials.delete', '*'), async (req, res, next) => {
  try {
    await db.query('UPDATE raw_materials SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'تم حذف الخامة بنجاح' });
  } catch (err) { next(err); }
});

export default router;
