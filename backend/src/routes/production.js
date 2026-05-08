import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة أوامر الإنتاج
router.get('/', authorize('production.view', '*'), async (req, res, next) => {
  try {
    const { status, date_from, date_to, page, limit } = req.query;
    let query = `SELECT po.*, r.name as recipe_name, p.name as product_name,
                        u.full_name as created_by_name
                 FROM production_orders po
                 LEFT JOIN recipes r ON po.recipe_id = r.id
                 LEFT JOIN products p ON r.product_id = p.id
                 LEFT JOIN users u ON po.created_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (status) { query += ` AND po.status = ?`; params.push(status); }
    if (date_from) { query += ` AND po.planned_date >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND po.planned_date <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY po.created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تفاصيل أمر الإنتاج
router.get('/:id', authorize('production.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT po.*, r.name as recipe_name, p.name as product_name,
              u.full_name as created_by_name
       FROM production_orders po
       LEFT JOIN recipes r ON po.recipe_id = r.id
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'أمر الإنتاج غير موجود' });
    const [logs] = await db.query(
      `SELECT pl.*, u.full_name as user_name
       FROM production_logs pl LEFT JOIN users u ON pl.performed_by = u.id
       WHERE pl.production_order_id = ? ORDER BY pl.created_at DESC`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], logs } });
  } catch (err) { next(err); }
});

// إنشاء أمر إنتاج
router.post('/', authorize('production.create', '*'), [
  body('recipe_id').isInt().withMessage('الوصفة مطلوبة'),
  body('planned_quantity').isFloat({ gt: 0 }).withMessage('الكمية المطلوبة يجب أن تكون أكبر من صفر'),
  validate,
], async (req, res, next) => {
  try {
    const { recipe_id, planned_quantity, planned_date, notes } = req.body;
    // Get product_id from recipe
    const [recipeRows] = await db.query('SELECT product_id FROM recipes WHERE id = ?', [recipe_id]);
    if (!recipeRows.length) return res.status(400).json({ success: false, message: 'الوصفة غير موجودة' });
    const product_id = recipeRows[0].product_id;
    const [last] = await db.query(
      `SELECT id FROM production_orders WHERE DATE(created_at) = CURDATE() ORDER BY id DESC LIMIT 1`
    );
    const seq = last.length ? last[0].id + 1 : 1;
    const order_number = generateNumber('PRD', seq);
    const [result] = await db.query(
      `INSERT INTO production_orders (order_number, recipe_id, product_id, planned_quantity, planned_date, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'planned', ?)`,
      [order_number, recipe_id, product_id, planned_quantity, planned_date || new Date(), notes, req.user.id]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء أمر الإنتاج بنجاح', data: { id: result.insertId, order_number } });
  } catch (err) { next(err); }
});

// بدء الإنتاج
router.put('/:id/start', authorize('production.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      `SELECT po.*, r.id as rid FROM production_orders po
       LEFT JOIN recipes r ON po.recipe_id = r.id WHERE po.id = ? AND po.status = 'planned'`, [req.params.id]
    );
    if (!orders.length) return res.status(400).json({ success: false, message: 'أمر الإنتاج غير موجود أو لا يمكن بدؤه' });
    const order = orders[0];

    // جلب خامات الوصفة وخصم المخزون
    const [items] = await conn.query(
      `SELECT ri.material_id, ri.quantity, ri.waste_percentage, r.output_quantity
       FROM recipe_items ri JOIN recipes r ON ri.recipe_id = r.id
       WHERE ri.recipe_id = ?`, [order.recipe_id]
    );
    const multiplier = order.planned_quantity / (items[0]?.output_quantity || 1);

    for (const item of items) {
      const needed = item.quantity * multiplier * (1 + (item.waste_percentage || 0) / 100);
      const [mat] = await conn.query('SELECT current_stock FROM raw_materials WHERE id = ?', [item.material_id]);
      if (!mat.length || mat[0].current_stock < needed) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `المخزون غير كافٍ للخامة رقم ${item.material_id}` });
      }
      await conn.query('UPDATE raw_materials SET current_stock = current_stock - ? WHERE id = ?', [needed, item.material_id]);
      await conn.query(
        `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
         VALUES ('out', 'material', ?, 1, ?, 'production', ?, 'خصم خامات للإنتاج', ?)`,
        [item.material_id, needed, req.params.id, req.user.id]
      );
    }

    await conn.query(
      `UPDATE production_orders SET status = 'in_progress', start_date = NOW() WHERE id = ?`, [req.params.id]
    );
    await conn.commit();
    res.json({ success: true, message: 'تم بدء الإنتاج بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// إتمام الإنتاج
router.put('/:id/complete', authorize('production.edit', '*'), [
  body('actual_quantity').isFloat({ gt: 0 }).withMessage('الكمية الفعلية مطلوبة'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { actual_quantity } = req.body;
    const [orders] = await conn.query(
      `SELECT po.*, r.product_id FROM production_orders po
       LEFT JOIN recipes r ON po.recipe_id = r.id
       WHERE po.id = ? AND po.status = 'in_progress'`, [req.params.id]
    );
    if (!orders.length) return res.status(400).json({ success: false, message: 'أمر الإنتاج غير موجود أو لا يمكن إتمامه' });
    const order = orders[0];

    // إضافة المنتجات للمخزون
    await conn.query(
      'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
      [actual_quantity, order.product_id]
    );
    await conn.query(
      `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
       VALUES ('in', 'product', ?, 1, ?, 'production', ?, 'إنتاج تام', ?)`,
      [order.product_id, actual_quantity, req.params.id, req.user.id]
    );
    await conn.query(
      `UPDATE production_orders SET status = 'completed', actual_quantity = ?, end_date = NOW() WHERE id = ?`,
      [actual_quantity, req.params.id]
    );
    await conn.commit();
    res.json({ success: true, message: 'تم إتمام الإنتاج بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// إلغاء أمر الإنتاج
router.put('/:id/cancel', authorize('production.edit', '*'), async (req, res, next) => {
  try {
    const [result] = await db.query(
      `UPDATE production_orders SET status = 'cancelled' WHERE id = ? AND status IN ('planned', 'in_progress')`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'لا يمكن إلغاء هذا الأمر' });
    res.json({ success: true, message: 'تم إلغاء أمر الإنتاج' });
  } catch (err) { next(err); }
});

// إضافة سجل إنتاج
router.post('/:id/log', authorize('production.log', 'production.edit', '*'), [
  body('description').notEmpty().withMessage('الوصف مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { description, quantity_produced, notes } = req.body;
    const [result] = await db.query(
      `INSERT INTO production_logs (production_order_id, performed_by, action, quantity, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, description, quantity_produced || 0, notes]
    );
    res.status(201).json({ success: true, message: 'تم إضافة السجل بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

export default router;
