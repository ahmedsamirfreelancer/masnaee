import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// سجلات الحضور
router.get('/', authorize('hr.view', 'attendance.self', '*'), async (req, res, next) => {
  try {
    const { employee_id, date_from, date_to, status, page, limit } = req.query;
    let query = `SELECT a.*, e.name as employee_name, e.employee_number
                 FROM attendance a
                 LEFT JOIN employees e ON a.employee_id = e.id
                 WHERE 1=1`;
    const params = [];
    if (employee_id) { query += ` AND a.employee_id = ?`; params.push(employee_id); }
    if (date_from) { query += ` AND a.date >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND a.date <= ?`; params.push(date_to); }
    if (status) { query += ` AND a.status = ?`; params.push(status); }
    const countQuery = query.replace(/SELECT a\.\*, e\.name.*employee_number/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY a.date DESC, e.name`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تسجيل حضور فردي
router.post('/', authorize('hr.create', 'attendance.self', '*'), [
  body('employee_id').isInt().withMessage('الموظف مطلوب'),
  body('date').notEmpty().withMessage('التاريخ مطلوب'),
  body('status').isIn(['present', 'absent', 'late', 'leave', 'holiday']).withMessage('الحالة غير صالحة'),
  validate,
], async (req, res, next) => {
  try {
    const { employee_id, date, status, check_in, check_out, overtime_hours, notes } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]
    );
    if (existing.length) {
      await db.query(
        `UPDATE attendance SET status=?, check_in=?, check_out=?, overtime_hours=?, notes=? WHERE id=?`,
        [status, check_in, check_out, overtime_hours || 0, notes, existing[0].id]
      );
      return res.json({ success: true, message: 'تم تحديث سجل الحضور' });
    }

    const [result] = await db.query(
      `INSERT INTO attendance (employee_id, date, status, check_in, check_out, overtime_hours, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, date, status, check_in, check_out, overtime_hours || 0, notes]
    );
    res.status(201).json({ success: true, message: 'تم تسجيل الحضور بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// تسجيل حضور جماعي
router.post('/bulk', authorize('hr.create', '*'), [
  body('date').notEmpty().withMessage('التاريخ مطلوب'),
  body('records').isArray({ min: 1 }).withMessage('يجب إضافة سجل واحد على الأقل'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { date, records } = req.body;

    for (const record of records) {
      const [existing] = await conn.query(
        'SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [record.employee_id, date]
      );
      if (existing.length) {
        await conn.query(
          `UPDATE attendance SET status=?, check_in=?, check_out=?, overtime_hours=?, notes=? WHERE id=?`,
          [record.status, record.check_in, record.check_out, record.overtime_hours || 0, record.notes, existing[0].id]
        );
      } else {
        await conn.query(
          `INSERT INTO attendance (employee_id, date, status, check_in, check_out, overtime_hours, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [record.employee_id, date, record.status, record.check_in, record.check_out, record.overtime_hours || 0, record.notes]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: `تم تسجيل حضور ${records.length} موظف بنجاح` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// ملخص الحضور لشهر
router.get('/summary', authorize('hr.view', '*'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'الشهر والسنة مطلوبان' });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const [rows] = await db.query(
      `SELECT e.id as employee_id, e.name as employee_name, e.employee_number,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
              SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
              SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) as leave_days,
              COALESCE(SUM(a.overtime_hours), 0) as total_overtime
       FROM employees e
       LEFT JOIN attendance a ON e.id = a.employee_id AND a.date BETWEEN ? AND ?
       WHERE e.is_active = TRUE
       GROUP BY e.id, e.name, e.employee_number
       ORDER BY e.name`,
      [startDate, endDate]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export default router;
