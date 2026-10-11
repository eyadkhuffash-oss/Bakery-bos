const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'bakery.db'));
db.pragma('journal_mode = WAL');

// ---------- الجداول ----------
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('bread','pastry')),
  price REAL NOT NULL,
  icon TEXT DEFAULT '🥐',
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','ready','delivered','cancelled')),
  notes TEXT,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  ready_at TEXT,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT DEFAULT '🥐',
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
`);

// عداد رقم الطلبية (يبدأ من جديد كل يوم منطقيًا لكنه تسلسلي هنا، يكفي للعرض)
const counterRow = db.prepare(`SELECT value FROM counters WHERE name='order_number'`).get();
if (!counterRow) {
  db.prepare(`INSERT INTO counters (name, value) VALUES ('order_number', 0)`).run();
}

function nextOrderNumber() {
  db.prepare(`UPDATE counters SET value = value + 1 WHERE name='order_number'`).run();
  return db.prepare(`SELECT value FROM counters WHERE name='order_number'`).get().value;
}

// ---------- بيانات أولية (تشتغل مرة واحدة فقط إذا الجدول فاضي) ----------
const productCount = db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
if (productCount === 0) {
  const insert = db.prepare(`INSERT INTO products (name, category, price, icon, sort_order) VALUES (?,?,?,?,?)`);
  const seed = [
    // خبز
    ['خبز عربي', 'bread', 0.5, '🍞', 1],
    ['خبز تورتيلا', 'bread', 1.0, '🫓', 2],
    // معجنات
    ['مناقيش زعتر', 'pastry', 1.5, '🌿', 3],
    ['مناقيش جبنة', 'pastry', 2.0, '🧀', 4],
    ['سبانخ', 'pastry', 1.5, '🥬', 5],
    ['لحمة بعجين', 'pastry', 2.5, '🥩', 6],
    ['كرواسون', 'pastry', 2.0, '🥐', 7],
    ['سمبوسك', 'pastry', 1.0, '🥟', 8],
    ['فطاير جبنة وزعتر', 'pastry', 2.0, '🫔', 9],
    ['بيتزا صغيرة', 'pastry', 3.0, '🍕', 10],
  ];
  const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
  tx(seed);
}

module.exports = { db, nextOrderNumber };
