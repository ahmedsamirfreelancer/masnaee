import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('users.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.last_login, u.created_at,
              r.name as role, r.display_name as role_display
       FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/', authorize('users.create', '*'), [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  body('full_name').notEmpty().withMessage('الاسم الكامل مطلوب'),
  body('role_id').isInt().withMessage('الدور مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { username, password, full_name, email, phone, role_id } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) return res.status(400).json({ success: false, message: 'اسم المستخدم موجود بالفعل' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, full_name, email, phone, role_id) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hash, full_name, email, phone, role_id]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('users.edit', '*'), async (req, res, next) => {
  try {
    const { full_name, email, phone, role_id, is_active } = req.body;
    await db.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, role_id = ?, is_active = ? WHERE id = ?',
      [full_name, email, phone, role_id, is_active, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث المستخدم بنجاح' });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('users.delete', '*'), async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === 1) return res.status(400).json({ success: false, message: 'لا يمكن حذف مدير النظام' });
    await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'تم تعطيل المستخدم بنجاح' });
  } catch (err) { next(err); }
});

router.get('/roles', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name, display_name FROM roles');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export default router;
