import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة فحوصات الجودة
router.get('/', authorize('quality.view', 'quality.*', '*'), async (req, res, next) => {
  try {
    const { production_order_id, result: qcResult, date_from, date_to, page, limit } = req.query;
    let query = `SELECT qc.*, po.order_number as production_order_number, p.name as product_name, u.full_name as inspector_name
                 FROM quality_checks qc
                 LEFT JOIN production_orders po ON qc.reference_type = 'production' AND qc.reference_id = po.id
                 LEFT JOIN products p ON qc.item_type = 'product' AND qc.item_id = p.id
                 LEFT JOIN users u ON qc.checked_by = u.id
                 WHERE 1=1`;
    const params = [];
    if (production_order_id) { query += ` AND qc.reference_type = 'production' AND qc.reference_id = ?`; params.push(production_order_id); }
    if (qcResult) { query += ` AND qc.result = ?`; params.push(qcResult); }
    if (date_from) { query += ` AND DATE(qc.check_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(qc.check_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT qc\.\*.*inspector_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY qc.check_date DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تفاصيل فحص
router.get('/:id', authorize('quality.view', 'quality.*', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT qc.*, po.order_number as production_order_number, u.full_name as inspector_name
       FROM quality_checks qc
       LEFT JOIN production_orders po ON qc.reference_type = 'production' AND qc.reference_id = po.id
       LEFT JOIN users u ON qc.checked_by = u.id
       WHERE qc.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'الفحص غير موجود' });
    const [items] = await db.query(
      `SELECT qci.*, qs.name as standard_name
       FROM quality_check_items qci
       LEFT JOIN quality_standards qs ON qci.standard_id = qs.id
       WHERE qci.quality_check_id = ?`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
});

// إنشاء فحص جودة
router.post('/', authorize('quality.create', 'quality.*', '*'), [
  body('production_order_id').isInt().withMessage('أمر الإنتاج مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة بند فحص واحد على الأقل'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { production_order_id, check_date, sample_size, notes, items } = req.body;

    // تحديد النتيجة الإجمالية
    const allPassed = items.every(i => i.is_passed);
    const result = allPassed ? 'pass' : 'fail';

    // Generate check number
    const [lastQc] = await conn.query('SELECT id FROM quality_checks ORDER BY id DESC LIMIT 1');
    const qcSeq = lastQc.length ? lastQc[0].id + 1 : 1;
    const check_number = `QC-${String(qcSeq).padStart(6, '0')}`;

    // Get product info from production order
    const [poRows] = await conn.query('SELECT product_id FROM production_orders WHERE id = ?', [production_order_id]);
    const productId = poRows.length ? poRows[0].product_id : null;

    const [qcResult] = await conn.query(
      `INSERT INTO quality_checks (check_number, type, reference_type, reference_id, item_type, item_id, checked_by, check_date, result, notes)
       VALUES (?, 'in_process', 'production', ?, 'product', ?, ?, ?, ?, ?)`,
      [check_number, production_order_id, productId, req.user.id, check_date || new Date(), result, notes]
    );
    const checkId = qcResult.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO quality_check_items (quality_check_id, standard_id, measured_value, result, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [checkId, item.standard_id, item.actual_value, item.is_passed ? 'pass' : 'fail', item.notes]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء فحص الجودة بنجاح', data: { id: checkId, result } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// معايير الجودة
router.get('/meta/standards', authorize('quality.view', 'quality.*', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM quality_standards ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/meta/standards', authorize('quality.create', 'quality.*', '*'), [
  body('name').notEmpty().withMessage('اسم المعيار مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, description, min_value, max_value, unit } = req.body;
    const [result] = await db.query(
      `INSERT INTO quality_standards (name, description, min_value, max_value, unit) VALUES (?, ?, ?, ?, ?)`,
      [name, description, min_value, max_value, unit]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء المعيار بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

export default router;
