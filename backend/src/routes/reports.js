import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';

const router = Router();
router.use(authenticate);

// تقرير المبيعات
router.get('/sales', authorize('reports.sales', 'reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to, group_by } = req.query;
    const params = [];
    let dateFilter = '';
    if (date_from) { dateFilter += ' AND DATE(so.order_date) >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND DATE(so.order_date) <= ?'; params.push(date_to); }

    let groupExpr, selectExpr;
    switch (group_by) {
      case 'week':
        groupExpr = 'YEARWEEK(so.order_date)';
        selectExpr = `CONCAT(YEAR(so.order_date), '-W', LPAD(WEEK(so.order_date), 2, '0')) as period`;
        break;
      case 'month':
        groupExpr = 'DATE_FORMAT(so.order_date, "%Y-%m")';
        selectExpr = `DATE_FORMAT(so.order_date, "%Y-%m") as period`;
        break;
      default:
        groupExpr = 'DATE(so.order_date)';
        selectExpr = `DATE(so.order_date) as period`;
    }

    const [rows] = await db.query(
      `SELECT ${selectExpr},
              COUNT(*) as orders_count,
              COALESCE(SUM(so.total_amount), 0) as total_sales,
              COALESCE(SUM(so.discount), 0) as total_discount,
              COALESCE(SUM(so.tax_amount), 0) as total_tax
       FROM sales_orders so
       WHERE so.status != 'cancelled' ${dateFilter}
       GROUP BY ${groupExpr}
       ORDER BY period`,
      params
    );

    const [totals] = await db.query(
      `SELECT COUNT(*) as orders_count,
              COALESCE(SUM(total_amount), 0) as total_sales,
              COALESCE(SUM(discount), 0) as total_discount
       FROM sales_orders WHERE status != 'cancelled' ${dateFilter}`,
      params
    );

    res.json({ success: true, data: { rows, totals: totals[0] } });
  } catch (err) { next(err); }
});

// تقرير المشتريات
router.get('/purchases', authorize('reports.purchases', 'reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to, group_by } = req.query;
    const params = [];
    let dateFilter = '';
    if (date_from) { dateFilter += ' AND DATE(po.order_date) >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND DATE(po.order_date) <= ?'; params.push(date_to); }

    let groupExpr = 'DATE(po.order_date)';
    let selectExpr = `DATE(po.order_date) as period`;
    if (group_by === 'month') {
      groupExpr = 'DATE_FORMAT(po.order_date, "%Y-%m")';
      selectExpr = `DATE_FORMAT(po.order_date, "%Y-%m") as period`;
    }

    const [rows] = await db.query(
      `SELECT ${selectExpr},
              COUNT(*) as orders_count,
              COALESCE(SUM(po.total_amount), 0) as total_purchases
       FROM purchase_orders po
       WHERE po.status != 'cancelled' ${dateFilter}
       GROUP BY ${groupExpr}
       ORDER BY period`,
      params
    );

    const [totals] = await db.query(
      `SELECT COUNT(*) as orders_count, COALESCE(SUM(total_amount), 0) as total_purchases
       FROM purchase_orders WHERE status != 'cancelled' ${dateFilter}`,
      params
    );

    res.json({ success: true, data: { rows, totals: totals[0] } });
  } catch (err) { next(err); }
});

// تقرير الإنتاج
router.get('/production', authorize('reports.production', 'reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const params = [];
    let dateFilter = '';
    if (date_from) { dateFilter += ' AND DATE(po.created_at) >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND DATE(po.created_at) <= ?'; params.push(date_to); }

    const [summary] = await db.query(
      `SELECT po.status, COUNT(*) as count,
              COALESCE(SUM(po.planned_quantity), 0) as total_planned,
              COALESCE(SUM(po.actual_quantity), 0) as total_actual
       FROM production_orders po WHERE 1=1 ${dateFilter}
       GROUP BY po.status`,
      params
    );

    const [byProduct] = await db.query(
      `SELECT p.name as product_name,
              COUNT(po.id) as orders_count,
              COALESCE(SUM(po.actual_quantity), 0) as total_produced
       FROM production_orders po
       LEFT JOIN recipes r ON po.recipe_id = r.id
       LEFT JOIN products p ON r.product_id = p.id
       WHERE po.status = 'completed' ${dateFilter}
       GROUP BY p.id, p.name
       ORDER BY total_produced DESC`,
      params
    );

    res.json({ success: true, data: { summary, by_product: byProduct } });
  } catch (err) { next(err); }
});

// تقرير تقييم المخزون
router.get('/inventory', authorize('reports.inventory', 'reports.*', '*'), async (req, res, next) => {
  try {
    const [products] = await db.query(
      `SELECT id, name, 'product' as item_type, current_stock, cost_price,
              (current_stock * cost_price) as total_value
       FROM products WHERE is_active = TRUE ORDER BY total_value DESC`
    );
    const [materials] = await db.query(
      `SELECT id, name, 'material' as item_type, current_stock, cost_price,
              (current_stock * cost_price) as total_value
       FROM raw_materials WHERE is_active = TRUE ORDER BY total_value DESC`
    );

    const productsValue = products.reduce((s, p) => s + p.total_value, 0);
    const materialsValue = materials.reduce((s, m) => s + m.total_value, 0);

    res.json({
      success: true,
      data: {
        products,
        materials,
        products_total_value: productsValue,
        materials_total_value: materialsValue,
        grand_total: productsValue + materialsValue,
      },
    });
  } catch (err) { next(err); }
});

// أفضل العملاء
router.get('/customers', authorize('reports.sales', 'reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to, top } = req.query;
    const params = [];
    let dateFilter = '';
    if (date_from) { dateFilter += ' AND DATE(so.order_date) >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND DATE(so.order_date) <= ?'; params.push(date_to); }

    const [rows] = await db.query(
      `SELECT c.id, c.name, c.phone,
              COUNT(so.id) as orders_count,
              COALESCE(SUM(so.total_amount), 0) as total_revenue
       FROM customers c
       LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status != 'cancelled' ${dateFilter}
       GROUP BY c.id, c.name, c.phone
       HAVING total_revenue > 0
       ORDER BY total_revenue DESC
       LIMIT ?`,
      [...params, parseInt(top) || 20]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// أفضل الموردين
router.get('/suppliers', authorize('reports.purchases', 'reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to, top } = req.query;
    const params = [];
    let dateFilter = '';
    if (date_from) { dateFilter += ' AND DATE(po.order_date) >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND DATE(po.order_date) <= ?'; params.push(date_to); }

    const [rows] = await db.query(
      `SELECT s.id, s.name, s.phone,
              COUNT(po.id) as orders_count,
              COALESCE(SUM(po.total_amount), 0) as total_purchases
       FROM suppliers s
       LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'cancelled' ${dateFilter}
       GROUP BY s.id, s.name, s.phone
       HAVING total_purchases > 0
       ORDER BY total_purchases DESC
       LIMIT ?`,
      [...params, parseInt(top) || 20]
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// تقرير الأرباح
router.get('/profit', authorize('reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const params = [];
    let salesFilter = '';
    let expFilter = '';
    let purchFilter = '';
    if (date_from) {
      salesFilter += ' AND DATE(order_date) >= ?';
      expFilter += ' AND DATE(expense_date) >= ?';
      purchFilter += ' AND DATE(order_date) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      salesFilter += ' AND DATE(order_date) <= ?';
      expFilter += ' AND DATE(expense_date) <= ?';
      purchFilter += ' AND DATE(order_date) <= ?';
      params.push(date_to);
    }

    const salesParams = params.slice();
    const expParams = params.slice();
    const purchParams = params.slice();

    const [salesResult] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != 'cancelled' ${salesFilter}`,
      salesParams
    );
    const [purchResult] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status != 'cancelled' ${purchFilter}`,
      purchParams
    );
    const [expResult] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1 ${expFilter}`,
      expParams
    );

    const revenue = salesResult[0].total;
    const costs = purchResult[0].total;
    const expenses = expResult[0].total;
    const grossProfit = revenue - costs;
    const netProfit = grossProfit - expenses;

    res.json({
      success: true,
      data: {
        revenue,
        cost_of_goods: costs,
        gross_profit: grossProfit,
        operating_expenses: expenses,
        net_profit: netProfit,
        profit_margin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0,
      },
    });
  } catch (err) { next(err); }
});

// تقرير التدفق النقدي
router.get('/cashflow', authorize('reports.*', '*'), async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const params = [];
    let dateFilter = '';
    if (date_from) { dateFilter += ' AND DATE(payment_date) >= ?'; params.push(date_from); }
    if (date_to) { dateFilter += ' AND DATE(payment_date) <= ?'; params.push(date_to); }

    const [received] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total,
              DATE(payment_date) as date
       FROM payments WHERE payment_type = 'received' ${dateFilter}
       GROUP BY DATE(payment_date) ORDER BY date`,
      params
    );

    const [made] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total,
              DATE(payment_date) as date
       FROM payments WHERE payment_type = 'made' ${dateFilter}
       GROUP BY DATE(payment_date) ORDER BY date`,
      params
    );

    const expParams = [];
    let expDateFilter = '';
    if (date_from) { expDateFilter += ' AND DATE(expense_date) >= ?'; expParams.push(date_from); }
    if (date_to) { expDateFilter += ' AND DATE(expense_date) <= ?'; expParams.push(date_to); }

    const [expensesDaily] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total,
              DATE(expense_date) as date
       FROM expenses WHERE 1=1 ${expDateFilter}
       GROUP BY DATE(expense_date) ORDER BY date`,
      expParams
    );

    const totalReceived = received.reduce((s, r) => s + r.total, 0);
    const totalMade = made.reduce((s, r) => s + r.total, 0);
    const totalExpenses = expensesDaily.reduce((s, r) => s + r.total, 0);

    res.json({
      success: true,
      data: {
        inflows: received,
        outflows_payments: made,
        outflows_expenses: expensesDaily,
        total_inflows: totalReceived,
        total_outflows: totalMade + totalExpenses,
        net_cashflow: totalReceived - totalMade - totalExpenses,
      },
    });
  } catch (err) { next(err); }
});

export default router;
