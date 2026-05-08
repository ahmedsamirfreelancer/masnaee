import jwt from 'jsonwebtoken';
import { hasPermission } from '../config/constants.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'جلسة منتهية - يرجى إعادة تسجيل الدخول' });
  }
}

export function authorize(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }
    const allowed = permissions.some(p => hasPermission(req.user.role, p));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لهذا الإجراء' });
    }
    next();
  };
}
