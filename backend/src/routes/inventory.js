import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// حركات المخزون
router.get('/movements', authorize('inventory.view', '*'), async (req, res, next) => {
  try {
    const { type, item_type, date_from, date_to, page, limit } = req.query;
    let query = `SELECT im.*, u.full_name as created_by_name
                 FROM inventory_movements im
                 LEFT JOIN users u ON im.created_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (type) { query += ` AND im.movement_type = ?`; params.push(type); }
    if (item_type) { query += ` AND im.item_type = ?`; params.push(item_type); }
    if (date_from) { query += ` AND DATE(im.created_at) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(im.created_at) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY im.created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// المخزون الحالي
router.get('/stock', authorize('inventory.view', '*'), async (req, res, next) => {
  try {
    const [products] = await db.query(
      `SELECT id, name, 'product' as item_type, current_stock, min_stock, selling_price, cost_price
       FROM products WHERE is_active = TRUE ORDER BY name`
    );
    const [materials] = await db.query(
      `SELECT id, name, 'material' as item_type, current_stock, min_stock, cost_price
       FROM raw_materials WHERE is_active = TRUE ORDER BY name`
    );
    res.json({ success: true, data: { products, materials } });
  } catch (err) { next(err); }
});

// أصناف تحت الحد الأدنى
router.get('/low-stock', authorize('inventory.view', '*'), async (req, res, next) => {
  try {
    const [products] = await db.query(
      `SELECT id, name, 'product' as item_type, current_stock, min_stock
       FROM products WHERE is_active = TRUE AND current_stock <= min_stock AND min_stock > 0`
    );
    const [materials] = await db.query(
      `SELECT id, name, 'material' as item_type, current_stock, min_stock
       FROM raw_materials WHERE is_active = TRUE AND current_stock <= min_stock AND min_stock > 0`
    );
    res.json({ success: true, data: [...products, ...materials] });
  } catch (err) { next(err); }
});

// تسوية مخزون يدوية
router.post('/adjustment', authorize('inventory.adjust', '*'), [
  body('item_type').isIn(['product', 'material']).withMessage('نوع الصنف غير صالح'),
  body('item_id').isInt().withMessage('الصنف مطلوب'),
  body('quantity').isFloat().withMessage('الكمية مطلوبة'),
  body('reason').notEmpty().withMessage('سبب التسوية مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { item_type, item_id, quantity, reason } = req.body;
    const table = item_type === 'product' ? 'products' : 'raw_materials';
    const movType = quantity > 0 ? 'in' : 'out';

    await conn.query(
      `UPDATE ${table} SET current_stock = current_stock + ? WHERE id = ?`,
      [quantity, item_id]
    );
    await conn.query(
      `INSERT INTO inventory_movements (item_type, item_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, ?, ?, 'adjustment', 0, ?, ?)`,
      [item_type, item_id, movType, Math.abs(quantity), reason, req.user.id]
    );
    await conn.commit();
    res.json({ success: true, message: 'تم تسوية المخزون بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تحويل بين المخازن
router.post('/transfer', authorize('inventory.transfer', '*'), [
  body('item_type').isIn(['product', 'material']).withMessage('نوع الصنف غير صالح'),
  body('item_id').isInt().withMessage('الصنف مطلوب'),
  body('from_warehouse_id').isInt().withMessage('المخزن المصدر مطلوب'),
  body('to_warehouse_id').isInt().withMessage('المخزن المستلم مطلوب'),
  body('quantity').isFloat({ gt: 0 }).withMessage('الكمية يجب أن تكون أكبر من صفر'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { item_type, item_id, from_warehouse_id, to_warehouse_id, quantity, notes } = req.body;

    // حركة خروج من المخزن المصدر
    await conn.query(
      `INSERT INTO inventory_movements (item_type, item_id, movement_type, quantity, warehouse_id, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, 'out', ?, ?, 'transfer', ?, ?, ?)`,
      [item_type, item_id, quantity, from_warehouse_id, to_warehouse_id, notes || 'تحويل مخزون', req.user.id]
    );
    // حركة دخول للمخزن المستلم
    await conn.query(
      `INSERT INTO inventory_movements (item_type, item_id, movement_type, quantity, warehouse_id, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, 'in', ?, ?, 'transfer', ?, ?, ?)`,
      [item_type, item_id, quantity, to_warehouse_id, from_warehouse_id, notes || 'تحويل مخزون', req.user.id]
    );
    await conn.commit();
    res.json({ success: true, message: 'تم التحويل بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// المخازن
router.get('/warehouses', authorize('inventory.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM warehouses ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/warehouses', authorize('inventory.create', '*'), [
  body('name').notEmpty().withMessage('اسم المخزن مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, location, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO warehouses (name, location, description) VALUES (?, ?, ?)',
      [name, location, description]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء المخزن بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

export default router;
