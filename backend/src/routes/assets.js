import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة الأصول
router.get('/', authorize('assets.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*,
              COALESCE((SELECT SUM(ad.depreciation_amount) FROM asset_depreciation ad WHERE ad.asset_id = a.id), 0) as accumulated_depreciation
       FROM assets a WHERE a.is_active = TRUE ORDER BY a.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// إنشاء أصل
router.post('/', authorize('assets.create', '*'), [
  body('name').notEmpty().withMessage('اسم الأصل مطلوب'),
  body('purchase_cost').isFloat({ gt: 0 }).withMessage('تكلفة الشراء مطلوبة'),
  body('useful_life_months').isInt({ gt: 0 }).withMessage('العمر الافتراضي مطلوب'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, category, purchase_cost, purchase_date, useful_life_months, salvage_value, depreciation_method, description, payment_method } = req.body;

    const [result] = await conn.query(
      `INSERT INTO assets (name, category, purchase_cost, purchase_date, useful_life_months, salvage_value, depreciation_method, current_value, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [name, category, purchase_cost, purchase_date || new Date(), useful_life_months, salvage_value || 0, depreciation_method || 'straight_line', purchase_cost, description]
    );

    // قيد محاسبي: مدين حساب الأصول - دائن الصندوق/البنك
    const cashCode = payment_method === 'bank' ? '1120' : '1110';
    const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
    const fiscalYearId = fyRow.length ? fyRow[0].id : 1;
    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
       VALUES (?, ?, ?, 'adjustment', ?, ?, TRUE, ?, ?, ?)`,
      [generateNumber('JE', result.insertId), fiscalYearId, purchase_date || new Date(), result.insertId, `شراء أصل: ${name}`, purchase_cost, purchase_cost, req.user.id]
    );
    // مدين: الأصول الثابتة (حساب 1400)
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '1400' LIMIT 1), ?, 0, ?)`,
      [jeResult.insertId, purchase_cost, `شراء أصل: ${name}`]
    );
    // دائن: الصندوق/البنك
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = ? LIMIT 1), 0, ?, ?)`,
      [jeResult.insertId, cashCode, purchase_cost, `شراء أصل: ${name}`]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إضافة الأصل بنجاح', data: { id: result.insertId } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تحديث أصل
router.put('/:id', authorize('assets.edit', '*'), async (req, res, next) => {
  try {
    const { name, category, description, is_active } = req.body;
    await db.query(
      `UPDATE assets SET name=?, category=?, description=?, is_active=? WHERE id=?`,
      [name, category, description, is_active ?? true, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث الأصل بنجاح' });
  } catch (err) { next(err); }
});

// تشغيل الإهلاك الشهري لكل الأصول النشطة
router.post('/depreciate', authorize('assets.create', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { month, year } = req.body;
    const period = `${year}-${String(month).padStart(2, '0')}`;

    const periodDate = `${period}-01`;

    // تحقق من عدم تنفيذ الإهلاك لنفس الشهر
    const [existing] = await conn.query(
      `SELECT id FROM asset_depreciation WHERE period_date = ? LIMIT 1`, [periodDate]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: `تم احتساب الإهلاك لشهر ${period} مسبقاً` });
    }

    // Get assets with their accumulated depreciation calculated from asset_depreciation table
    const [assets] = await conn.query(
      `SELECT a.*,
              COALESCE((SELECT SUM(ad.depreciation_amount) FROM asset_depreciation ad WHERE ad.asset_id = a.id), 0) as total_accumulated
       FROM assets a
       WHERE a.is_active = TRUE
       HAVING total_accumulated < (a.purchase_cost - a.salvage_value)`
    );

    if (!assets.length) {
      return res.json({ success: true, message: 'لا توجد أصول تحتاج إهلاك' });
    }

    let totalDepreciation = 0;

    for (const asset of assets) {
      const monthlyDep = (asset.purchase_cost - asset.salvage_value) / asset.useful_life_months;
      const remaining = asset.purchase_cost - asset.salvage_value - asset.total_accumulated;
      const depAmount = Math.min(monthlyDep, remaining);
      if (depAmount <= 0) continue;

      totalDepreciation += depAmount;
      const newAccumulated = asset.total_accumulated + depAmount;
      const bookValue = asset.purchase_cost - newAccumulated;

      await conn.query(
        `INSERT INTO asset_depreciation (asset_id, period_date, depreciation_amount, accumulated_depreciation, book_value) VALUES (?, ?, ?, ?, ?)`,
        [asset.id, periodDate, depAmount, newAccumulated, bookValue]
      );
      await conn.query(
        `UPDATE assets SET current_value = ? WHERE id = ?`,
        [bookValue, asset.id]
      );
    }

    // قيد محاسبي مجمع: مدين مصروف الإهلاك - دائن مجمع الإهلاك
    if (totalDepreciation > 0) {
      const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
      const fiscalYearId = fyRow.length ? fyRow[0].id : 1;
      const [jeResult] = await conn.query(
        `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
         VALUES (?, ?, ?, 'depreciation', 0, ?, TRUE, ?, ?, ?)`,
        [generateNumber('JE', Date.now() % 10000), fiscalYearId, periodDate, `إهلاك أصول شهر ${period}`, totalDepreciation, totalDepreciation, req.user.id]
      );
      // مدين: مصروف الإهلاك (5200)
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '5200' LIMIT 1), ?, 0, ?)`,
        [jeResult.insertId, totalDepreciation, `إهلاك أصول ${period}`]
      );
      // دائن: مجمع الإهلاك (1410)
      await conn.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '1410' LIMIT 1), 0, ?, ?)`,
        [jeResult.insertId, totalDepreciation, `مجمع إهلاك ${period}`]
      );
    }

    await conn.commit();
    res.json({ success: true, message: `تم احتساب الإهلاك بنجاح: ${totalDepreciation.toFixed(2)}`, data: { total: totalDepreciation, assets_count: assets.length } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// جدول إهلاك أصل
router.get('/:id/depreciation', authorize('assets.view', '*'), async (req, res, next) => {
  try {
    const [asset] = await db.query('SELECT * FROM assets WHERE id = ?', [req.params.id]);
    if (!asset.length) return res.status(404).json({ success: false, message: 'الأصل غير موجود' });

    const [records] = await db.query(
      `SELECT * FROM asset_depreciation WHERE asset_id = ? ORDER BY period_date`, [req.params.id]
    );

    const totalAccumulated = records.reduce((s, r) => s + r.depreciation_amount, 0);
    const currentValue = asset[0].purchase_cost - totalAccumulated;

    res.json({
      success: true,
      data: {
        asset: asset[0],
        depreciation_records: records,
        current_value: currentValue,
        remaining_life: Math.max(0, asset[0].useful_life_months - records.length),
      },
    });
  } catch (err) { next(err); }
});

export default router;
