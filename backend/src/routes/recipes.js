import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';

const router = Router();
router.use(authenticate);

// قائمة الوصفات
router.get('/', authorize('recipes.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, p.name as product_name,
              (SELECT COUNT(*) FROM recipe_items ri WHERE ri.recipe_id = r.id) as items_count
       FROM recipes r
       LEFT JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// تفاصيل الوصفة
router.get('/:id', authorize('recipes.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, p.name as product_name
       FROM recipes r LEFT JOIN products p ON r.product_id = p.id
       WHERE r.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'الوصفة غير موجودة' });
    const [items] = await db.query(
      `SELECT ri.*, m.name as material_name, u.name as unit_name
       FROM recipe_items ri
       LEFT JOIN raw_materials m ON ri.material_id = m.id
       LEFT JOIN units u ON m.unit_id = u.id
       WHERE ri.recipe_id = ?`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
});

// إنشاء وصفة
router.post('/', authorize('recipes.create', '*'), [
  body('product_id').isInt().withMessage('المنتج مطلوب'),
  body('name').notEmpty().withMessage('اسم الوصفة مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة خامة واحدة على الأقل'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { product_id, name, description, output_quantity, items } = req.body;
    const [result] = await conn.query(
      `INSERT INTO recipes (product_id, name, description, output_quantity) VALUES (?, ?, ?, ?)`,
      [product_id, name, description, output_quantity || 1]
    );
    const recipeId = result.insertId;
    for (const item of items) {
      await conn.query(
        `INSERT INTO recipe_items (recipe_id, material_id, quantity, waste_percentage) VALUES (?, ?, ?, ?)`,
        [recipeId, item.material_id, item.quantity, item.waste_percentage || 0]
      );
    }
    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء الوصفة بنجاح', data: { id: recipeId } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تحديث الوصفة
router.put('/:id', authorize('recipes.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { product_id, name, description, output_quantity, items } = req.body;
    await conn.query(
      `UPDATE recipes SET product_id=?, name=?, description=?, output_quantity=? WHERE id=?`,
      [product_id, name, description, output_quantity || 1, req.params.id]
    );
    if (items) {
      await conn.query('DELETE FROM recipe_items WHERE recipe_id = ?', [req.params.id]);
      for (const item of items) {
        await conn.query(
          `INSERT INTO recipe_items (recipe_id, material_id, quantity, waste_percentage) VALUES (?, ?, ?, ?)`,
          [req.params.id, item.material_id, item.quantity, item.waste_percentage || 0]
        );
      }
    }
    await conn.commit();
    res.json({ success: true, message: 'تم تحديث الوصفة بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// حذف الوصفة
router.delete('/:id', authorize('recipes.delete', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM recipe_items WHERE recipe_id = ?', [req.params.id]);
    await conn.query('DELETE FROM recipes WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'تم حذف الوصفة بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
