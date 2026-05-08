import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../config/database.js';

const router = Router();
router.use(authenticate);

// إحصائيات عامة
router.get('/stats', async (req, res, next) => {
  try {
    const [salesToday] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE DATE(order_date) = CURDATE() AND status != 'cancelled'`
    );
    const [salesMonth] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE MONTH(order_date) = MONTH(CURDATE()) AND YEAR(order_date) = YEAR(CURDATE()) AND status != 'cancelled'`
    );
    const [expensesMonth] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE())`
    );
    const [productsCount] = await db.query('SELECT COUNT(*) as total FROM products WHERE is_active = TRUE');
    const [lowStockProducts] = await db.query(
      `SELECT COUNT(*) as total FROM products WHERE is_active = TRUE AND current_stock <= min_stock AND min_stock > 0`
    );
    const [lowStockMaterials] = await db.query(
      `SELECT COUNT(*) as total FROM raw_materials WHERE is_active = TRUE AND current_stock <= min_stock AND min_stock > 0`
    );
    const [pendingOrders] = await db.query(
      `SELECT COUNT(*) as total FROM sales_orders WHERE status IN ('draft', 'confirmed')`
    );
    const [productionInProgress] = await db.query(
      `SELECT COUNT(*) as total FROM production_orders WHERE status = 'in_progress'`
    );

    res.json({
      success: true,
      data: {
        total_sales_today: salesToday[0].total,
        total_sales_month: salesMonth[0].total,
        total_expenses_month: expensesMonth[0].total,
        products_count: productsCount[0].total,
        low_stock_count: lowStockProducts[0].total + lowStockMaterials[0].total,
        pending_orders: pendingOrders[0].total,
        production_in_progress: productionInProgress[0].total,
      },
    });
  } catch (err) { next(err); }
});

// مبيعات آخر 30 يوم
router.get('/sales-chart', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT DATE(order_date) as date,
              COALESCE(SUM(total_amount), 0) as total,
              COUNT(*) as orders_count
       FROM sales_orders
       WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status != 'cancelled'
       GROUP BY DATE(order_date)
       ORDER BY date`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// أفضل 10 منتجات
router.get('/top-products', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name,
              COALESCE(SUM(soi.quantity), 0) as total_quantity,
              COALESCE(SUM(soi.total_price), 0) as total_revenue
       FROM products p
       LEFT JOIN sales_order_items soi ON p.id = soi.product_id
       LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.status != 'cancelled'
       WHERE p.is_active = TRUE
       GROUP BY p.id, p.name
       HAVING total_quantity > 0
       ORDER BY total_quantity DESC
       LIMIT 10`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// آخر 10 طلبات
router.get('/recent-orders', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT so.id, so.order_number, so.total_amount, so.status, so.payment_status, so.order_date,
              c.name as customer_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       ORDER BY so.created_at DESC LIMIT 10`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// أصناف تحت الحد الأدنى
router.get('/low-stock', async (req, res, next) => {
  try {
    const [products] = await db.query(
      `SELECT id, name, 'product' as item_type, current_stock, min_stock
       FROM products WHERE is_active = TRUE AND current_stock <= min_stock AND min_stock > 0
       ORDER BY (current_stock / GREATEST(min_stock, 1)) LIMIT 20`
    );
    const [materials] = await db.query(
      `SELECT id, name, 'material' as item_type, current_stock, min_stock
       FROM raw_materials WHERE is_active = TRUE AND current_stock <= min_stock AND min_stock > 0
       ORDER BY (current_stock / GREATEST(min_stock, 1)) LIMIT 20`
    );
    res.json({ success: true, data: [...products, ...materials] });
  } catch (err) { next(err); }
});

// ملخص حالة الإنتاج
router.get('/production-status', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT status, COUNT(*) as count,
              COALESCE(SUM(planned_quantity), 0) as total_planned,
              COALESCE(SUM(actual_quantity), 0) as total_actual
       FROM production_orders
       GROUP BY status`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export default router;
