import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import db from '../config/database.js';

const router = Router();

router.post('/login', [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
  validate,
], async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [users] = await db.query(
      `SELECT u.*, r.name as role, r.display_name as role_display, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.username = ? AND u.is_active = TRUE`,
      [username]
    );
    if (!users.length) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        role_display: user.role_display,
        permissions: JSON.parse(user.permissions || '[]'),
      },
    });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, r.name as role, r.display_name as role_display, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [req.user.id]
    );
    if (!users.length) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const user = users[0];
    user.permissions = JSON.parse(user.permissions || '[]');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.put('/change-password', authenticate, [
  body('current_password').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('new_password').isLength({ min: 6 }).withMessage('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'),
  validate,
], async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, users[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) { next(err); }
});

export default router;
