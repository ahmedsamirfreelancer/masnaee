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
              (a.purchase_cost - COALESCE(a.accumulated_depreciation, 0)) as current_value
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

    const monthly_depreciation = (purchase_cost - (salvage_value || 0)) / useful_life_months;

    const [result] = await conn.query(
      `INSERT INTO assets (name, category, purchase_cost, purchase_date, useful_life_months, salvage_value, depreciation_method, monthly_depreciation, accumulated_depreciation, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, TRUE)`,
      [name, category, purchase_cost, purchase_date || new Date(), useful_life_months, salvage_value || 0, depreciation_method || 'straight_line', monthly_depreciation, description]
    );

    // قيد محاسبي: مدين حساب الأصول - دائن الصندوق/البنك
    const cashCode = payment_method === 'bank' ? '1120' : '1110';
    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, is_posted, created_by)
       VALUES (?, ?, 'asset', ?, ?, TRUE, ?)`,
      [generateNumber('JE', result.insertId), purchase_date || new Date(), result.insertId, `شراء أصل: ${name}`, req.user.id]
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

    // تحقق من عدم تنفيذ الإهلاك لنفس الشهر
    const [existing] = await conn.query(
      `SELECT id FROM asset_depreciation WHERE period = ? LIMIT 1`, [period]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: `تم احتساب الإهلاك لشهر ${period} مسبقاً` });
    }

    const [assets] = await conn.query(
      `SELECT * FROM assets WHERE is_active = TRUE AND accumulated_depreciation < (purchase_cost - salvage_value)`
    );

    if (!assets.length) {
      return res.json({ success: true, message: 'لا توجد أصول تحتاج إهلاك' });
    }

    let totalDepreciation = 0;

    for (const asset of assets) {
      const remaining = asset.purchase_cost - asset.salvage_value - asset.accumulated_depreciation;
      const depAmount = Math.min(asset.monthly_depreciation, remaining);
      if (depAmount <= 0) continue;

      totalDepreciation += depAmount;

      await conn.query(
        `INSERT INTO asset_depreciation (asset_id, period, amount, created_at) VALUES (?, ?, ?, NOW())`,
        [asset.id, period, depAmount]
      );
      await conn.query(
        `UPDATE assets SET accumulated_depreciation = accumulated_depreciation + ? WHERE id = ?`,
        [depAmount, asset.id]
      );
    }

    // قيد محاسبي مجمع: مدين مصروف الإهلاك - دائن مجمع الإهلاك
    if (totalDepreciation > 0) {
      const [jeResult] = await conn.query(
        `INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, is_posted, created_by)
         VALUES (?, ?, 'depreciation', 0, ?, TRUE, ?)`,
        [generateNumber('JE', Date.now() % 10000), `${period}-01`, `إهلاك أصول شهر ${period}`, req.user.id]
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
      `SELECT * FROM asset_depreciation WHERE asset_id = ? ORDER BY period`, [req.params.id]
    );

    const currentValue = asset[0].purchase_cost - (asset[0].accumulated_depreciation || 0);

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
