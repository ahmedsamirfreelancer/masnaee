import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import db from '../config/database.js';
import { paginate, generateNumber } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// قائمة أوامر الشراء
router.get('/', authorize('purchases.view', '*'), async (req, res, next) => {
  try {
    const { status, supplier_id, date_from, date_to, page, limit } = req.query;
    let query = `SELECT po.*, s.name as supplier_name
                 FROM purchase_orders po
                 LEFT JOIN suppliers s ON po.supplier_id = s.id
                 WHERE 1=1`;
    const params = [];
    if (status) { query += ` AND po.status = ?`; params.push(status); }
    if (supplier_id) { query += ` AND po.supplier_id = ?`; params.push(supplier_id); }
    if (date_from) { query += ` AND DATE(po.order_date) >= ?`; params.push(date_from); }
    if (date_to) { query += ` AND DATE(po.order_date) <= ?`; params.push(date_to); }
    const countQuery = query.replace(/SELECT po\.\*, s\.name as supplier_name/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    query += ` ORDER BY po.created_at DESC`;
    const pg = paginate(query, { page, limit });
    const [rows] = await db.query(pg.query, params);
    res.json({ success: true, data: rows, pagination: { page: pg.page, limit: pg.limit, total: countResult[0].total } });
  } catch (err) { next(err); }
});

// تفاصيل أمر الشراء
router.get('/:id', authorize('purchases.view', '*'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT po.*, s.name as supplier_name, s.phone as supplier_phone
       FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'أمر الشراء غير موجود' });
    const [items] = await db.query(
      `SELECT poi.*, m.name as material_name
       FROM purchase_order_items poi LEFT JOIN raw_materials m ON poi.material_id = m.id
       WHERE poi.purchase_order_id = ?`, [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
});

// إنشاء أمر شراء
router.post('/', authorize('purchases.create', '*'), [
  body('supplier_id').isInt().withMessage('المورد مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب إضافة خامة واحدة على الأقل'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier_id, items, discount, tax_rate, notes, order_date } = req.body;

    const [last] = await conn.query(
      `SELECT id FROM purchase_orders WHERE DATE(created_at) = CURDATE() ORDER BY id DESC LIMIT 1`
    );
    const seq = last.length ? last[0].id + 1 : 1;
    const order_number = generateNumber('PO', seq);

    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.quantity * item.unit_price);
    }
    const disc = discount || 0;
    const tax = (subtotal - disc) * ((tax_rate || 0) / 100);
    const total = subtotal - disc + tax;

    const [result] = await conn.query(
      `INSERT INTO purchase_orders (order_number, supplier_id, order_date, subtotal, discount_amount, tax_amount, total_amount, notes, status, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'unpaid', ?)`,
      [order_number, supplier_id, order_date || new Date(), subtotal, disc, tax, total, notes, req.user.id]
    );
    const orderId = result.insertId;

    for (const item of items) {
      const total_price = item.quantity * item.unit_price;
      await conn.query(
        `INSERT INTO purchase_order_items (purchase_order_id, material_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.material_id, item.quantity, item.unit_price, total_price]
      );
    }

    // تحديث رصيد المورد
    await conn.query('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [total, supplier_id]);

    await conn.commit();
    res.status(201).json({ success: true, message: 'تم إنشاء أمر الشراء بنجاح', data: { id: orderId, order_number } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// تحديث أمر شراء (مسودة فقط)
router.put('/:id', authorize('purchases.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [order] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? AND status = ?', [req.params.id, 'draft']);
    if (!order.length) return res.status(400).json({ success: false, message: 'لا يمكن تعديل هذا الأمر' });

    const { supplier_id, items, discount, tax_rate, notes } = req.body;
    let subtotal = 0;
    if (items) {
      for (const item of items) { subtotal += (item.quantity * item.unit_price); }
    }
    const disc = discount || 0;
    const tax = (subtotal - disc) * ((tax_rate || 0) / 100);
    const total = subtotal - disc + tax;

    await conn.query('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [order[0].total_amount, order[0].supplier_id]);

    await conn.query(
      `UPDATE purchase_orders SET supplier_id=?, subtotal=?, discount_amount=?, tax_amount=?, total_amount=?, notes=? WHERE id=?`,
      [supplier_id || order[0].supplier_id, subtotal, disc, tax, total, notes, req.params.id]
    );

    if (items) {
      await conn.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
      for (const item of items) {
        const total_price = item.quantity * item.unit_price;
        await conn.query(
          `INSERT INTO purchase_order_items (purchase_order_id, material_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [req.params.id, item.material_id, item.quantity, item.unit_price, total_price]
        );
      }
    }

    await conn.query('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [total, supplier_id || order[0].supplier_id]);

    await conn.commit();
    res.json({ success: true, message: 'تم تحديث أمر الشراء بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// استلام البضائع
router.put('/:id/receive', authorize('purchases.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      `SELECT * FROM purchase_orders WHERE id = ? AND status IN ('draft', 'confirmed')`, [req.params.id]
    );
    if (!orders.length) return res.status(400).json({ success: false, message: 'لا يمكن استلام هذا الأمر' });
    const order = orders[0];

    const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
    const receivedItems = req.body.items;

    for (const item of items) {
      const received = receivedItems?.find(r => r.material_id === item.material_id);
      const qty = received ? received.received_quantity : item.quantity;

      await conn.query(
        'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?', [qty, item.id]
      );
      await conn.query(
        'UPDATE raw_materials SET current_stock = current_stock + ? WHERE id = ?', [qty, item.material_id]
      );
      await conn.query(
        `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
         VALUES ('in', 'material', ?, 1, ?, 'purchase', ?, 'استلام مشتريات', ?)`,
        [item.material_id, qty, req.params.id, req.user.id]
      );
    }

    // قيد محاسبي: مدين المواد الخام - دائن الموردين
    const [fyRow] = await conn.query('SELECT id FROM fiscal_years WHERE is_closed = 0 ORDER BY id DESC LIMIT 1');
    const fiscalYearId = fyRow.length ? fyRow[0].id : 1;
    const [jeResult] = await conn.query(
      `INSERT INTO journal_entries (entry_number, fiscal_year_id, entry_date, reference_type, reference_id, description, is_posted, total_debit, total_credit, created_by)
       VALUES (?, ?, NOW(), 'purchase', ?, ?, TRUE, ?, ?, ?)`,
      [generateNumber('JE', order.id), fiscalYearId, req.params.id, `استلام مشتريات ${order.order_number}`, order.total_amount, order.total_amount, req.user.id]
    );
    // مدين: المواد الخام (حساب 1300)
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '1300' LIMIT 1), ?, 0, ?)`,
      [jeResult.insertId, order.total_amount, `مشتريات - ${order.order_number}`]
    );
    // دائن: الموردين (حساب 2100)
    await conn.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES (?, (SELECT id FROM chart_of_accounts WHERE code = '2100' LIMIT 1), 0, ?, ?)`,
      [jeResult.insertId, order.total_amount, `مشتريات - ${order.order_number}`]
    );

    await conn.query(
      `UPDATE purchase_orders SET status = 'received' WHERE id = ?`, [req.params.id]
    );
    await conn.commit();
    res.json({ success: true, message: 'تم استلام البضائع بنجاح' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// إلغاء أمر الشراء
router.put('/:id/cancel', authorize('purchases.edit', '*'), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? AND status != ?', [req.params.id, 'cancelled']);
    if (!orders.length) return res.status(400).json({ success: false, message: 'لا يمكن إلغاء هذا الأمر' });

    await conn.query('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [orders[0].total_amount, orders[0].supplier_id]);
    await conn.query('UPDATE purchase_orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'تم إلغاء أمر الشراء' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// مرتجع مشتريات
router.post('/returns', authorize('purchases.create', '*'), [
  body('purchase_order_id').isInt().withMessage('أمر الشراء مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب تحديد الأصناف المرتجعة'),
  validate,
], async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { purchase_order_id, items, reason } = req.body;

    const [orders] = await conn.query('SELECT * FROM purchase_orders WHERE id = ?', [purchase_order_id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'أمر الشراء غير موجود' });

    let totalReturn = 0;
    for (const item of items) {
      const returnAmount = item.quantity * item.unit_price;
      totalReturn += returnAmount;
      await conn.query('UPDATE raw_materials SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.material_id]);
      await conn.query(
        `INSERT INTO inventory_movements (type, item_type, item_id, warehouse_id, quantity, reference_type, reference_id, notes, created_by)
         VALUES ('out', 'material', ?, 1, ?, 'return', ?, ?, ?)`,
        [item.material_id, item.quantity, purchase_order_id, reason || 'مرتجع مشتريات', req.user.id]
      );
    }

    const [lastRet] = await conn.query('SELECT id FROM purchase_returns ORDER BY id DESC LIMIT 1');
    const retSeq = lastRet.length ? lastRet[0].id + 1 : 1;
    const return_number = `PRET-${String(retSeq).padStart(6, '0')}`;
    const [result] = await conn.query(
      `INSERT INTO purchase_returns (return_number, purchase_order_id, supplier_id, return_date, total_amount, reason, created_by)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?)`,
      [return_number, purchase_order_id, orders[0].supplier_id, totalReturn, reason, req.user.id]
    );

    await conn.query('UPDATE suppliers SET balance = balance - ? WHERE id = ?', [totalReturn, orders[0].supplier_id]);

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
