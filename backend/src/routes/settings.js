import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// جميع الإعدادات
router.get('/', authorize('settings.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings ORDER BY `group`, `key`');
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.group]) grouped[row.group] = {};
      grouped[row.group][row.key] = row.value;
    }
    res.json({ success: true, data: { settings: rows, grouped } });
  } catch (err) { next(err); }
});

// تحديث الإعدادات
router.put('/', authorize('settings.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'الإعدادات مطلوبة' });
    }

    for (const [key, value] of Object.entries(settings)) {
      const [existing] = await conn.query('SELECT id FROM settings WHERE `key` = ?', [key]);
      if (existing.length) {
        await conn.query('UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?', [String(value), key]);
      } else {
        await conn.query(
          'INSERT INTO settings (`key`, `value`, `group`, updated_at) VALUES (?, ?, ?, NOW())',
          [key, String(value), 'general']
        );
      }
    }

    // سجل النشاط
    await conn.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'update', 'settings', 0, ?)`,
      [req.user.id, JSON.stringify({ keys: Object.keys(settings) })]
    );

    await conn.commit();
    res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// الوحدات
router.get('/units', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM units ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/units', authorize('settings.edit', '*'), [
  body('name').notEmpty().withMessage('اسم الوحدة مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, abbreviation } = req.body;
    const [result] = await db.query(
      'INSERT INTO units (name, abbreviation) VALUES (?, ?)',
      [name, abbreviation]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء الوحدة بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// التصنيفات
router.post('/categories', authorize('settings.edit', '*'), [
  body('name').notEmpty().withMessage('اسم التصنيف مطلوب'),
  body('type').isIn(['product', 'material', 'expense']).withMessage('نوع التصنيف غير صالح'),
  validate,
], async (req, res, next) => {
  try {
    const { name, type, parent_id } = req.body;
    const [result] = await db.query(
      'INSERT INTO categories (name, type, parent_id) VALUES (?, ?, ?)',
      [name, type, parent_id || null]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء التصنيف بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// سجل النشاط
router.get('/activity-log', authorize('settings.view', '*'), async (req, res, next) => {
  try {
    const { user_id, action, entity_type, date_from, date_to, page, limit } = req.query;
    let query = `SELECT al.*, u.full_name as user_name
                 FROM activity_log al
                 LEFT JOIN users u ON al.user_id = u.id
                 WHERE 1=1`;
    const params = [];
    if (user_id) { query += ` AND al.user_id = ?`; params.push(user_id); }
    if (action) { query += ` AND al.action = ?`; params.push(action); }
    if (entity_type) { query += ` AND al.entity_type = ?`; params.push(entity_type); }
    if (date_from) { query += ` AND DATE(al.created_at) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(al.created_at) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT al\.\*, u\.full_name as user_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY al.created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

export default router;
