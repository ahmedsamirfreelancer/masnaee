import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة أوامر البيع
router.get('/', authorize('sales.view', '*'), async (req, res, next) => {
  try {
    const { status, payment_status, customer_id, date_from, date_to, page, limit } = req.query;
    let query = `SELECT so.*, c.name as customer_name
                 FROM sales_orders so
                 LEFT JOIN customers c ON so.customer_id = c.id
                 WHERE 1=1`;
    const params = [];
    if (status) { query += ` AND so.status = ?`; params.push(status); }
    if (payment_status) { query += ` AND so.payment_status = ?`; params.push(payment_status); }
    if (customer_id) { query += ` AND so.customer_id = ?`; params.push(customer_id); }
    if (date_from) { query += ` AND DATE(so.order_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(so.order_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT so\.\*, c\.name as customer_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY so.created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تفاصيل أمر البيع
router.get('/:id', authorize('sales.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT so.*, c.name as customer_name, c.phone as customer_phone
       FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id
       WHERE so.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'أمر البيع غير موجود' });
    const [items] = await db.query(
      `SELECT soi.*, p.name as product_name
       FROM sales_order_items soi LEFT JOIN products p ON soi.product_id = p.id
       WHERE soi.sales_order_id = ?`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
});

// إنشاء أمر بيع
router.post('/', authorize('sales.create', '*'), [
  body('customer_id').isInt().withMessage('العميل مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة منتج واحد على الأقل'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, items, discount, tax_rate, notes, order_date } = req.body;

    const [last] = await conn.query(
      `SELECT id FROM sales_orders WHERE DATE(created_at) = CURDATE() ORDER BY id DESC LIMIT 1`
    );
    const seq = last.length ? last[0].id + 1 : 1;
    const order_number = generateNumber('SO', seq);

    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.quantity * item.unit_price);
    }
    const disc = discount || 0;
    const tax = (subtotal - disc) * ((tax_rate || 0) / 100);
    const total = subtotal - disc + tax;

    const [result] = await conn.query(
      `INSERT INTO sales_orders (order_number, customer_id, order_date, subtotal, discount_amount, tax_amount, total_amount, notes, status, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'unpaid', ?)`,
      [order_number, customer_id, order_date || new Date(), subtotal, disc, tax, total, notes, req.user.id]
    );
    const orderId = result.insertId;

    for (const item of items) {
      const total_price = item.quantity * item.unit_price;
      await conn.query(
        `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price, total_price]
      );
    }

    // تحديث رصيد العميل
    await conn.query('UPDATE customers SET balance = balance + ? WHERE id = ?', [total, customer_id]);

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء أمر البيع بنجاح', data: { id: orderId, order_number } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تحديث أمر بيع (مسودة فقط)
router.put('/:id', authorize('sales.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [order] = await conn.query('SELECT * FROM sales_orders WHERE id = ? AND status = ?', [req.params.id, 'draft']);
    if (!order.length) return res.status(400).json({ success: false, message: 'لا يمكن تعديل هذا الأمر' });

    const { customer_id, items, discount, tax_rate, notes } = req.body;
    let subtotal = 0;
    if (items) {
      for (const item of items) { subtotal += (item.quantity * item.unit_price); }
    }
    const disc = discount || 0;
    const tax = (subtotal - disc) * ((tax_rate || 0) / 100);
    const total = subtotal - disc + tax;

    // عكس الرصيد القديم وإضافة الجديد
    await conn.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [order[0].total_amount, order[0].customer_id]);

    await conn.query(
      `UPDATE sales_orders SET customer_id=?, subtotal=?, discount_amount=?, tax_amount=?, total_amount=?, notes=? WHERE id=?`,
      [customer_id || order[0].customer_id, subtotal, disc, tax, total, notes, req.params.id]
    );

    if (items) {
      await conn.query('DELETE FROM sales_order_items WHERE sales_order_id = ?', [req.params.id]);
      for (const item of items) {
        const total_price = item.quantity * item.unit_price;
        await conn.query(
          `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [req.params.id, item.product_id, item.quantity, item.unit_price, total_price]
        );
      }
    }

    await conn.query('UPDATE customers SET balance = balance + ? WHERE id = ?', [total, customer_id || order[0].customer_id]);

    await conn.commit();
    res.json({ success: true, message: 'تم تحديث أمر البيع بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تأكيد الأمر
router.put('/:id/confirm', authorize('sales.edit', '*'), async (req, res, next) => {
  try {
    const [result] = await db.query(
      `UPDATE sales_orders SET status = 'confirmed' WHERE id = ? AND status = 'draft'`, [req.params.id]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'لا يمكن تأكيد هذا الأمر' });
    res.json({ success: true, message: 'تم تأكيد أمر البيع' });
  } catch (err) { next(err); }
});

// شحن الأمر
router.put('/:id/ship', authorize('sales.edit', '*'), async (req, res, next) => {
  try {
    const [result] = await db.query(
      `UPDATE sales_orders SET status = 'shipped' WHERE id = ? AND status = 'confirmed'`, [req.params.id]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'لا يمكن شحن هذا الأمر' });
    res.json({ success: true, message: 'تم شحن الأمر' });
  } catch (err) { next(err); }
});

// تسليم الأمر (خصم مخزون + قيد محاسبي)
router.put('/:id/deliver', authorize('sales.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      `SELECT * FROM sales_orders WHERE id = ? AND status IN ('confirmed', 'shipped')`, [req.params.id]
    );
    if (!orders.length) return res.status(400).json({ success: false, message: 'لا يمكن تسليم هذا الأمر' });
    const order = orders[0];

    const [items] = await conn.query('SELECT * FROM sales_order_items WHERE sales_order_id = ?', [req.params.id]);

    // خصم المنتجات من المخزون
    for (const item of items) {
      const [prod] = await conn.query('SELECT current_stock FROM products WHERE id = ?', [item.product_id]);
      if (!prod.length || prod[0].current_stock < item.quantity) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `المخزون غير كافٍ للمنتج رقم ${item.product_id}` });
      }
      await conn.query('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      await conn.query(
        `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
         VALUES ('out', 'product', ?, 1, ?, 'sale', ?, 'تسليم أمر بيع', ?)`,
        [item.product_id, item.quantity, req.params.id, req.user.id]
      );
    }

    // قيد محاسبي: مدين العملاء - دائن إيرادات المبيعات
    const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
    const fiscalYearId = fyRow.length ? fyRow[0].id : 1;
    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
       VALUES (?, ?, NOW(), 'sale', ?, ?, TRUE, ?, ?, ?)`,
      [generateNumber('JE', order.id), fiscalYearId, req.params.id, `تسليم أمر بيع ${order.order_number}`, order.total_amount, order.total_amount, req.user.id]
    );
    // مدين: العملاء (نفترض حساب 1200)
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '1200' LIMIT 1), ?, 0, ?)`,
      [jeResult.insertId, order.total_amount, `مبيعات - ${order.order_number}`]
    );
    // دائن: إيرادات المبيعات (نفترض حساب 4100)
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '4100' LIMIT 1), 0, ?, ?)`,
      [jeResult.insertId, order.total_amount, `مبيعات - ${order.order_number}`]
    );

    await conn.query(
      `UPDATE sales_orders SET status = 'delivered', delivery_date = CURDATE() WHERE id = ?`, [req.params.id]
    );
    await conn.commit();
    res.json({ success: true, message: 'تم تسليم الأمر بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// إلغاء الأمر
router.put('/:id/cancel', authorize('sales.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'الأمر غير موجود' });
    const order = orders[0];
    if (order.status === 'cancelled') return res.status(400).json({ success: false, message: 'الأمر ملغي بالفعل' });

    // لو كان مسلم نرجع المخزون
    if (order.status === 'delivered') {
      const [items] = await conn.query('SELECT * FROM sales_order_items WHERE sales_order_id = ?', [req.params.id]);
      for (const item of items) {
        await conn.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        await conn.query(
          `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
           VALUES ('in', 'product', ?, 1, ?, 'adjustment', ?, 'إلغاء أمر بيع', ?)`,
          [item.product_id, item.quantity, req.params.id, req.user.id]
        );
      }
    }

    // عكس رصيد العميل
    await conn.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [order.total_amount, order.customer_id]);

    await conn.query('UPDATE sales_orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'تم إلغاء الأمر بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// مرتجع مبيعات
router.post('/returns', authorize('sales.create', '*'), [
  body('sales_order_id').isInt().withMessage('أمر البيع مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب تحديد الأصناف المرتجعة'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { sales_order_id, items, reason } = req.body;

    const [orders] = await conn.query('SELECT * FROM sales_orders WHERE id = ?', [sales_order_id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'أمر البيع غير موجود' });

    let totalReturn = 0;
    for (const item of items) {
      const returnAmount = item.quantity * item.unit_price;
      totalReturn += returnAmount;
      // إرجاع المنتج للمخزون
      await conn.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      await conn.query(
        `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
         VALUES ('in', 'product', ?, 1, ?, 'return', ?, ?, ?)`,
        [item.product_id, item.quantity, sales_order_id, reason || 'مرتجع مبيعات', req.user.id]
      );
    }

    const [lastRet] = await conn.query('SELECT id FROM sales_returns ORDER BY id DESC LIMIT 1');
    const retSeq = lastRet.length ? lastRet[0].id + 1 : 1;
    const return_number = `SRET-${String(retSeq).padStart(6, '0')}`;
    const [result] = await conn.query(
      `INSERT INTO sales_returns (return_number, sales_order_id, customer_id, return_date, total_amount, reason, created_by)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?)`,
      [return_number, sales_order_id, orders[0].customer_id, totalReturn, reason, req.user.id]
    );

    // تحديث رصيد العميل
    await conn.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [totalReturn, orders[0].customer_id]);

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء المرتجع بنجاح', data: { id: result.insertId } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
