import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة مدفوعات الرواتب
router.get('/', authorize('hr.salaries.view', '*'), async (req, res, next) => {
  try {
    const { month, year, employee_id } = req.query;
    let query = `SELECT sp.*, e.name as employee_name
                 FROM salary_payments sp
                 LEFT JOIN employees e ON sp.employee_id = e.id
                 WHERE 1=1`;
    const params = [];
    if (month) { query += ` AND sp.month = ?`; params.push(month); }
    if (year) { query += ` AND sp.year = ?`; params.push(year); }
    if (employee_id) { query += ` AND sp.employee_id = ?`; params.push(employee_id); }
    query += ` ORDER BY sp.year DESC, sp.month DESC, e.name`;
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// حساب رواتب شهر
router.post('/calculate', authorize('hr.salaries.create', '*'), [
  body('month').isInt({ min: 1, max: 12 }).withMessage('الشهر غير صالح'),
  body('year').isInt({ min: 2020 }).withMessage('السنة غير صالحة'),
  validate,
], async (req, res, next) => {
  try {
    const { month, year } = req.body;

    // التحقق من عدم احتساب الرواتب مسبقاً
    const [existing] = await db.query(
      'SELECT id FROM salary_payments WHERE month = ? AND year = ? LIMIT 1', [month, year]
    );
    if (existing.length) return res.status(400).json({ success: false, message: 'تم احتساب رواتب هذا الشهر مسبقاً' });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const [employees] = await db.query('SELECT * FROM employees WHERE is_active = TRUE');

    const calculations = [];
    for (const emp of employees) {
      // حساب الأيام والإضافي
      const [attendance] = await db.query(
        `SELECT
           SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as worked_days,
           SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
           COALESCE(SUM(overtime_hours), 0) as overtime_hours
         FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?`,
        [emp.id, startDate, endDate]
      );
      const att = attendance[0];

      // حساب السلف
      const [advances] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM employee_advances
         WHERE employee_id = ? AND deduct_from_month = ? AND deduct_from_year = ? AND is_deducted = FALSE`,
        [emp.id, month, year]
      );

      const hourlyRate = emp.base_salary / 30 / 8;
      const overtimePay = (att.overtime_hours || 0) * hourlyRate * 1.5;
      const absentDeduction = (att.absent_days || 0) * (emp.base_salary / 30);
      const advancesTotal = advances[0].total;
      const net = emp.base_salary + overtimePay - absentDeduction - advancesTotal;

      calculations.push({
        employee_id: emp.id,
        employee_name: emp.name,
        base_salary: emp.base_salary,
        worked_days: att.worked_days || 0,
        absent_days: att.absent_days || 0,
        overtime_hours: att.overtime_hours || 0,
        overtime_pay: Math.round(overtimePay * 100) / 100,
        absent_deduction: Math.round(absentDeduction * 100) / 100,
        advances: advancesTotal,
        net_salary: Math.round(net * 100) / 100,
      });
    }

    res.json({ success: true, data: calculations });
  } catch (err) { next(err); }
});

// صرف الرواتب
router.post('/pay', authorize('hr.salaries.create', '*'), [
  body('month').isInt({ min: 1, max: 12 }).withMessage('الشهر غير صالح'),
  body('year').isInt({ min: 2020 }).withMessage('السنة غير صالحة'),
  body('payments').isArray({ min: 1 }).withMessage('يجب تحديد الرواتب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { month, year, payments, payment_method } = req.body;

    let totalSalaries = 0;

    for (const pay of payments) {
      const pmId = payment_method || 1; // default cash
      const [result] = await conn.query(
        `INSERT INTO salary_payments (employee_id, month, year, base_salary, overtime_amount, bonuses, deductions, advances, net_salary, payment_date, payment_method_id, created_by)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, CURDATE(), ?, ?)`,
        [pay.employee_id, month, year, pay.base_salary, pay.overtime_pay || 0, pay.absent_deduction || 0, pay.advances || 0, pay.net_salary, pmId, req.user.id]
      );

      totalSalaries += pay.net_salary;

      // تحديث السلف كمخصومة
      if (pay.advances > 0) {
        await conn.query(
          `UPDATE employee_advances SET is_deducted = TRUE WHERE employee_id = ? AND deduct_from_month = ? AND deduct_from_year = ? AND is_deducted = FALSE`,
          [pay.employee_id, month, year]
        );
      }
    }

    // قيد محاسبي مجمع: مدين مصروف الرواتب - دائن الصندوق/البنك
    const cashCode = payment_method === 'bank' ? '1120' : '1110';
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
    const fiscalYearId = fyRow.length ? fyRow[0].id : 1;
    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
       VALUES (?, ?, NOW(), 'salary', 0, ?, TRUE, ?, ?, ?)`,
      [generateNumber('JE', Date.now() % 10000), fiscalYearId, `رواتب شهر ${period}`, totalSalaries, totalSalaries, req.user.id]
    );
    // مدين: مصروف الرواتب (5300)
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '5300' LIMIT 1), ?, 0, ?)`,
      [jeResult.insertId, totalSalaries, `رواتب ${period}`]
    );
    // دائن: الصندوق/البنك
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = ? LIMIT 1), 0, ?, ?)`,
      [jeResult.insertId, cashCode, totalSalaries, `رواتب ${period}`]
    );

    await conn.commit();
    res.json({ success: true, message: `تم صرف رواتب ${payments.length} موظف بنجاح`, data: { total: totalSalaries } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// قائمة السلف
router.get('/advances', authorize('hr.salaries.view', '*'), async (req, res, next) => {
  try {
    const { employee_id, month, year } = req.query;
    let query = `SELECT ea.*, e.name as employee_name
                 FROM employee_advances ea
                 LEFT JOIN employees e ON ea.employee_id = e.id WHERE 1=1`;
    const params = [];
    if (employee_id) { query += ` AND ea.employee_id = ?`; params.push(employee_id); }
    if (month) { query += ` AND ea.deduct_from_month = ?`; params.push(month); }
    if (year) { query += ` AND ea.deduct_from_year = ?`; params.push(year); }
    query += ` ORDER BY ea.created_at DESC`;
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// إنشاء سلفة
router.post('/advances', authorize('hr.salaries.create', '*'), [
  body('employee_id').isInt().withMessage('الموظف مطلوب'),
  body('amount').isFloat({ gt: 0 }).withMessage('المبلغ مطلوب'),
  validate,
], async (req, res, next) => {
  try {
    const { employee_id, amount, month, year, notes } = req.body;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const [result] = await db.query(
      `INSERT INTO employee_advances (employee_id, amount, advance_date, deduct_from_month, deduct_from_year, notes, approved_by) VALUES (?, ?, CURDATE(), ?, ?, ?, ?)`,
      [employee_id, amount, currentMonth, currentYear, notes, req.user.id]
    );
    res.status(201).json({ success: true, message: 'تم تسجيل السلفة بنجاح', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

export default router;
