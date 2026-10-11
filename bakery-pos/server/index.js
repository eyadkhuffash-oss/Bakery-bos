const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const { db, nextOrderNumber } = require('./db');

function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => res.redirect('/cashier.html'));

// ============== المنتجات ==============
app.get('/api/products', (req, res) => {
  const rows = db.prepare(`SELECT * FROM products WHERE active = 1 ORDER BY category, sort_order, id`).all();
  res.json(rows);
});

app.get('/api/products/all', (req, res) => {
  const rows = db.prepare(`SELECT * FROM products ORDER BY category, sort_order, id`).all();
  res.json(rows);
});

app.post('/api/products', (req, res) => {
  const { name, category, price, icon } = req.body;
  if (!name || !category || price == null) return res.status(400).json({ error: 'بيانات ناقصة' });
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order),0) as m FROM products`).get().m;
  const info = db.prepare(`INSERT INTO products (name, category, price, icon, sort_order) VALUES (?,?,?,?,?)`)
    .run(name, category, price, icon || '🥐', maxOrder + 1);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', (req, res) => {
  const { name, category, price, icon, active } = req.body;
  const existing = db.prepare(`SELECT * FROM products WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'غير موجود' });
  db.prepare(`UPDATE products SET name=?, category=?, price=?, icon=?, active=? WHERE id=?`).run(
    name ?? existing.name,
    category ?? existing.category,
    price ?? existing.price,
    icon ?? existing.icon,
    active ?? existing.active,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/products/:id', (req, res) => {
  db.prepare(`UPDATE products SET active=0 WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// ============== الطلبيات ==============

// إنشاء طلبية جديدة (من شاشة الكاشير)
app.post('/api/orders', (req, res) => {
  const { items, notes } = req.body; // items: [{product_id, quantity}]
  if (!items || !items.length) return res.status(400).json({ error: 'لا يوجد أصناف' });

  const tx = db.transaction(() => {
    const orderNumber = nextOrderNumber();
    let total = 0;
    const orderInfo = db.prepare(`INSERT INTO orders (order_number, status, notes, total) VALUES (?,?,?,0)`)
      .run(orderNumber, 'new', notes || null);
    const orderId = orderInfo.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, category, icon, unit_price, quantity, subtotal)
      VALUES (?,?,?,?,?,?,?,?)
    `);

    for (const it of items) {
      const product = db.prepare(`SELECT * FROM products WHERE id=?`).get(it.product_id);
      if (!product) continue;
      const subtotal = product.price * it.quantity;
      total += subtotal;
      insertItem.run(orderId, product.id, product.name, product.category, product.icon, product.price, it.quantity, subtotal);
    }

    db.prepare(`UPDATE orders SET total=? WHERE id=?`).run(total, orderId);
    return orderId;
  });

  const orderId = tx();
  const fullOrder = getFullOrder(orderId);
  io.emit('new-order', fullOrder);
  res.json(fullOrder);
});

// كل الطلبيات النشطة (جديدة أو جاهزة، غير مسلّمة) لعرضها عند فتح شاشة الخباز
app.get('/api/orders/active', (req, res) => {
  const orders = db.prepare(`SELECT * FROM orders WHERE status IN ('new','ready') ORDER BY created_at ASC`).all();
  const full = orders.map(o => attachItems(o));
  res.json(full);
});

// تحديث حالة الطلبية (جاهزة / تم التسليم / إلغاء)
app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['new', 'ready', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'حالة غير صحيحة' });
  }
  const field = status === 'ready' ? `, ready_at = datetime('now','localtime')`
              : status === 'delivered' ? `, delivered_at = datetime('now','localtime')`
              : '';
  db.prepare(`UPDATE orders SET status=? ${field} WHERE id=?`).run(status, req.params.id);
  const fullOrder = getFullOrder(req.params.id);
  io.emit('order-updated', fullOrder);
  res.json(fullOrder);
});

function attachItems(order) {
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id=?`).all(order.id);
  return { ...order, items };
}
function getFullOrder(id) {
  const order = db.prepare(`SELECT * FROM orders WHERE id=?`).get(id);
  return attachItems(order);
}

// ============== التقارير ==============
// period = day | week | month | year ، date = أي تاريخ ضمن تلك الفترة (YYYY-MM-DD)، اختياري (افتراضي اليوم)
app.get('/api/reports', (req, res) => {
  const { period = 'day', date } = req.query;
  const refDate = date || new Date().toISOString().slice(0, 10);

  let startExpr, endExpr;
  if (period === 'day') {
    startExpr = `date('${refDate}')`;
    endExpr = `date('${refDate}', '+1 day')`;
  } else if (period === 'week') {
    // الأسبوع يبدأ السبت (مناسب لفلسطين) -> نحسب بداية الأسبوع بالنسبة لـ refDate
    startExpr = `date('${refDate}', 'weekday 6', '-7 days')`;
    endExpr = `date('${refDate}', 'weekday 6')`;
  } else if (period === 'month') {
    startExpr = `date('${refDate}', 'start of month')`;
    endExpr = `date('${refDate}', 'start of month', '+1 month')`;
  } else if (period === 'year') {
    startExpr = `date('${refDate}', 'start of year')`;
    endExpr = `date('${refDate}', 'start of year', '+1 year')`;
  } else {
    return res.status(400).json({ error: 'period غير صحيح' });
  }

  const where = `status != 'cancelled' AND date(created_at) >= ${startExpr} AND date(created_at) < ${endExpr}`;

  const summary = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE ${where}
  `).get();

  const byProduct = db.prepare(`
    SELECT oi.product_name, oi.category, SUM(oi.quantity) as qty, SUM(oi.subtotal) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled' AND date(o.created_at) >= ${startExpr} AND date(o.created_at) < ${endExpr}
    GROUP BY oi.product_id
    ORDER BY revenue DESC
  `).all();

  const byCategory = db.prepare(`
    SELECT oi.category, SUM(oi.quantity) as qty, SUM(oi.subtotal) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled' AND date(o.created_at) >= ${startExpr} AND date(o.created_at) < ${endExpr}
    GROUP BY oi.category
  `).all();

  const byDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as orders_count, SUM(total) as revenue
    FROM orders
    WHERE ${where}
    GROUP BY day
    ORDER BY day ASC
  `).all();

  res.json({ period, refDate, summary, byProduct, byCategory, byDay });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('✅ السيرفر يعمل الآن!');
  console.log(`   على هذا اللابتوب (الكاشير): http://localhost:${PORT}`);
  if (ips.length) {
    ips.forEach(ip => console.log(`   من الموبايل (الخباز) افتح:   http://${ip}:${PORT}/kitchen.html`));
  } else {
    console.log('   ⚠️  لم يتم العثور على عنوان شبكة. تأكد أنك متصل بشبكة واي فاي أو شغّل نقطة اتصال (Hotspot).');
  }
  console.log('');
});
