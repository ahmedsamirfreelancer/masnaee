import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة الموظفين
router.get('/', authorize('hr.view', '*'), async (req, res, next) => {
  try {
    const { search, department_id, is_active, page, limit } = req.query;
    let query = `SELECT e.*, d.name as department_name
                 FROM employees e
                 LEFT JOIN departments d ON e.department_id = d.id
                 WHERE 1=1`;
    const params = [];
    if (search) { query += ` AND (e.name LIKE ? OR e.phone LIKE ? OR e.employee_number LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (department_id) { query += ` AND e.department_id = ?`; params.push(department_id); }
    if (is_active !== undefined) { query += ` AND e.is_active = ?`; params.push(is_active === 'true' ? 1 : 0); }
    const countQuery = query.replace(/SELECT e\.\*, d\.name as department_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY e.name`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// موظف واحد
router.get('/:id', authorize('hr.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, d.name as department_name FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// إنشاء موظف
router.post('/', authorize('hr.create', '*'), [
  body('name').notEmpty().withMessage('اسم الموظف مطلوب'),
  body('base_salary').isFloat({ min: 0 }).withMessage('الراتب الأساسي مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, employee_number, phone, email, national_id, department_id, job_title, base_salary, hire_date, address, notes } = req.body;
    const [result] = await db.query(
      `INSERT INTO employees (name, employee_number, phone, email, national_id, department_id, job_title, base_salary, hire_date, address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, employee_number, phone, email, national_id, department_id, job_title, base_salary, hire_date || new Date(), address, notes]
    );
    res.status(201).json({ success: true, message: 'تم إضافة الموظف بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// تحديث موظف
router.put('/:id', authorize('hr.edit', '*'), async (req, res, next) => {
  try {
    const { name, employee_number, phone, email, national_id, department_id, job_title, base_salary, address, notes, is_active } = req.body;
    await db.query(
      `UPDATE employees SET name=?, employee_number=?, phone=?, email=?, national_id=?, department_id=?, job_title=?, base_salary=?, address=?, notes=?, is_active=? WHERE id=?`,
      [name, employee_number, phone, email, national_id, department_id, job_title, base_salary, address, notes, is_active ?? true, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث الموظف بنجاح' });
  } catch (err) { next(err); }
});

// حذف موظف (تعطيل)
router.delete('/:id', authorize('hr.delete', '*'), async (req, res, next) => {
  try {
    await db.query('UPDATE employees SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'تم تعطيل الموظف بنجاح' });
  } catch (err) { next(err); }
});

// الأقسام
router.get('/meta/departments', authorize('hr.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/meta/departments', authorize('hr.create', '*'), [
  body('name').notEmpty().withMessage('اسم القسم مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name, description]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء القسم بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

export default router;
