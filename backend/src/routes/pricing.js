import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';

const router = Router();
router.use(authenticate);

// حاسبة التسعير
router.post('/calculate', authorize('products.view', '*'), async (req, res, next) => {
  try {
    const { product_id, product_size_id, quantity } = req.body;
    if (!product_id || !quantity) return res.status(400).json({ success: false, message: 'المنتج والكمية مطلوبين' });

    // 1. بيانات المنتج
    const [products] = await db.query('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!products.length) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    const product = products[0];

    let sizeInfo = null;
    if (product_size_id) {
      const [sizes] = await db.query('SELECT * FROM product_sizes WHERE id = ?', [product_size_id]);
      if (sizes.length) sizeInfo = sizes[0];
    }

    // 2. تكلفة الخامات من التركيبة
    const [recipes] = await db.query(
      'SELECT * FROM recipes WHERE product_id = ? AND is_active = TRUE LIMIT 1', [product_id]
    );

    let materialCostPerUnit = 0;
    let materialBreakdown = [];
    let recipeOutputQty = 1;

    if (recipes.length) {
      const recipe = recipes[0];
      recipeOutputQty = recipe.output_quantity || 1;
      const [items] = await db.query(
        `SELECT ri.*, m.name as material_name, m.cost_price, u.name as unit_name
         FROM recipe_items ri
         JOIN raw_materials m ON ri.material_id = m.id
         LEFT JOIN units u ON ri.unit_id = u.id
         WHERE ri.recipe_id = ?`, [recipe.id]
      );

      for (const item of items) {
        const wasteMultiplier = 1 + (item.waste_percentage || 0) / 100;
        const qtyNeeded = item.quantity * wasteMultiplier;
        const cost = qtyNeeded * (item.cost_price || 0);
        materialCostPerUnit += cost;
        materialBreakdown.push({
          name: item.material_name,
          quantity: Number(qtyNeeded.toFixed(3)),
          unit: item.unit_name,
          unit_cost: item.cost_price,
          total_cost: Number(cost.toFixed(2)),
          waste_percent: item.waste_percentage || 0,
        });
      }
      // تكلفة الخامات لكل وحدة منتج
      materialCostPerUnit = materialCostPerUnit / recipeOutputQty;
    }

    // 3. تكلفة العمالة الشهرية
    const [salaryResult] = await db.query(
      'SELECT COALESCE(SUM(base_salary), 0) as total FROM employees WHERE is_active = TRUE'
    );
    const monthlySalaries = salaryResult[0].total;

    // 4. تكلفة التشغيل الشهرية (من المصروفات آخر 3 شهور متوسط)
    const [expResult] = await db.query(
      `SELECT COALESCE(AVG(monthly_total), 0) as avg_monthly FROM (
         SELECT DATE_FORMAT(expense_date, '%Y-%m') as month, SUM(amount) as monthly_total
         FROM expenses
         WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
         GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
       ) t`
    );
    let monthlyExpenses = expResult[0].avg_monthly;

    // لو مفيش مصروفات مسجلة، نستخدم إعدادات افتراضية
    if (!monthlyExpenses) {
      const [settings] = await db.query("SELECT `key`, `value` FROM settings WHERE `key` IN ('monthly_rent', 'monthly_fuel', 'monthly_utilities')");
      const s = {};
      settings.forEach(r => { s[r.key] = Number(r.value) || 0; });
      monthlyExpenses = (s.monthly_rent || 0) + (s.monthly_fuel || 0) + (s.monthly_utilities || 0);
    }

    // 5. إهلاك الأصول الشهري
    const [assetResult] = await db.query(
      `SELECT COALESCE(SUM(
         CASE WHEN useful_life_months > 0
         THEN (purchase_cost - COALESCE(salvage_value, 0)) / useful_life_months
         ELSE 0 END
       ), 0) as monthly_depreciation
       FROM assets WHERE is_active = TRUE`
    );
    const monthlyDepreciation = assetResult[0].monthly_depreciation;

    // 6. الطاقة الإنتاجية الشهرية (من أوامر الإنتاج آخر 3 شهور)
    const [prodResult] = await db.query(
      `SELECT COALESCE(AVG(monthly_qty), 0) as avg_monthly FROM (
         SELECT DATE_FORMAT(end_date, '%Y-%m') as month, SUM(actual_quantity) as monthly_qty
         FROM production_orders
         WHERE status = 'completed' AND end_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
         GROUP BY DATE_FORMAT(end_date, '%Y-%m')
       ) t`
    );
    let monthlyProduction = prodResult[0].avg_monthly;

    // لو مفيش إنتاج مسجل، نستخدم تقدير (30 يوم × 100 وحدة)
    if (!monthlyProduction) {
      const [estResult] = await db.query("SELECT `value` FROM settings WHERE `key` = 'estimated_monthly_production'");
      monthlyProduction = estResult.length ? Number(estResult[0].value) : 3000;
    }

    // 7. حساب التكاليف غير المباشرة لكل وحدة
    const totalMonthlyOverhead = monthlySalaries + monthlyExpenses + monthlyDepreciation;
    const overheadPerUnit = monthlyProduction > 0 ? totalMonthlyOverhead / monthlyProduction : 0;

    // 8. التكلفة الإجمالية لكل وحدة
    const costPerUnit = materialCostPerUnit + overheadPerUnit;
    const totalCost = costPerUnit * quantity;

    // 9. هامش الربح المقترح
    const margins = [
      { percent: 10, price_per_unit: costPerUnit * 1.10, total: costPerUnit * 1.10 * quantity },
      { percent: 15, price_per_unit: costPerUnit * 1.15, total: costPerUnit * 1.15 * quantity },
      { percent: 20, price_per_unit: costPerUnit * 1.20, total: costPerUnit * 1.20 * quantity },
      { percent: 25, price_per_unit: costPerUnit * 1.25, total: costPerUnit * 1.25 * quantity },
      { percent: 30, price_per_unit: costPerUnit * 1.30, total: costPerUnit * 1.30 * quantity },
    ];

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          current_selling_price: sizeInfo?.selling_price || product.selling_price,
          current_cost_price: sizeInfo?.cost_price || product.cost_price,
        },
        quantity,
        recipe_output_qty: recipeOutputQty,

        // تفصيل التكاليف لكل وحدة
        cost_breakdown: {
          materials: {
            total: Number(materialCostPerUnit.toFixed(2)),
            items: materialBreakdown,
          },
          labor: {
            monthly_total: Number(monthlySalaries.toFixed(2)),
            per_unit: Number((monthlyProduction > 0 ? monthlySalaries / monthlyProduction : 0).toFixed(2)),
          },
          operating: {
            monthly_total: Number(monthlyExpenses.toFixed(2)),
            per_unit: Number((monthlyProduction > 0 ? monthlyExpenses / monthlyProduction : 0).toFixed(2)),
          },
          depreciation: {
            monthly_total: Number(monthlyDepreciation.toFixed(2)),
            per_unit: Number((monthlyProduction > 0 ? monthlyDepreciation / monthlyProduction : 0).toFixed(2)),
          },
        },

        monthly_production: Number(monthlyProduction.toFixed(0)),
        overhead_per_unit: Number(overheadPerUnit.toFixed(2)),
        cost_per_unit: Number(costPerUnit.toFixed(2)),
        total_cost: Number(totalCost.toFixed(2)),
        suggested_margins: margins.map(m => ({
          percent: m.percent,
          price_per_unit: Number(m.price_per_unit.toFixed(2)),
          total: Number(m.total.toFixed(2)),
          profit_per_unit: Number((m.price_per_unit - costPerUnit).toFixed(2)),
        })),
      },
    });
  } catch (err) { next(err); }
});

// حفظ إعدادات التسعير
router.put('/settings', authorize('settings.edit', '*'), async (req, res, next) => {
  try {
    const { estimated_monthly_production, monthly_rent, monthly_fuel, monthly_utilities } = req.body;
    const settings = { estimated_monthly_production, monthly_rent, monthly_fuel, monthly_utilities };
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) continue;
      const [existing] = await db.query("SELECT id FROM settings WHERE `key` = ?", [key]);
      if (existing.length) {
        await db.query("UPDATE settings SET `value` = ? WHERE `key` = ?", [String(value), key]);
      } else {
        await db.query("INSERT INTO settings (`key`, `value`, `group`) VALUES (?, ?, 'pricing')", [key, String(value)]);
      }
    }
    res.json({ success: true, message: 'تم حفظ إعدادات التسعير' });
  } catch (err) { next(err); }
});

// جلب إعدادات التسعير
router.get('/settings', authorize('products.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('estimated_monthly_production', 'monthly_rent', 'monthly_fuel', 'monthly_utilities')"
    );
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// === تسعير الزيت ===

// حفظ إعدادات الزيت
router.put('/oil-settings', authorize('products.view', '*'), async (req, res, next) => {
  try {
    const data = JSON.stringify(req.body);
    const [existing] = await db.query("SELECT id FROM settings WHERE `key` = 'oil_pricing'");
    if (existing.length) {
      await db.query("UPDATE settings SET `value` = ? WHERE `key` = 'oil_pricing'", [data]);
    } else {
      await db.query("INSERT INTO settings (`key`, `value`, `group`) VALUES ('oil_pricing', ?, 'pricing')", [data]);
    }
    res.json({ success: true, message: 'تم حفظ إعدادات التسعير' });
  } catch (err) { next(err); }
});

// جلب إعدادات الزيت
router.get('/oil-settings', authorize('products.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT `value` FROM settings WHERE `key` = 'oil_pricing'");
    const data = rows.length ? JSON.parse(rows[0].value) : null;
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
