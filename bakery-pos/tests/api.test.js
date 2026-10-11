const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');

const { app } = require('../server/index.js');

function startTestServer() {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  return server;
}

test('order creation supports debt flow and reports endpoint', async () => {
  const server = startTestServer();
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const productRes = await fetch(`${baseUrl}/api/products`);
    const products = await productRes.json();
    assert.ok(Array.isArray(products));
    assert.ok(products.length > 0);

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product_id: products[0].id, quantity: 2 }],
        customer_name: 'عميل تجريبي',
        notes: 'اختبار',
        payment_type: 'debt',
        delivery_enabled: true,
        delivery_address: 'المدينة',
        delivery_notes: 'اختبار',
        created_by: 'اختبار'
      })
    });
    const order = await orderRes.json();
    assert.equal(orderRes.status, 200);
    assert.equal(order.payment_status, 'unpaid');
    assert.equal(order.balance_due > 0, true);

    const reportRes = await fetch(`${baseUrl}/api/reports?period=day&date=${new Date().toISOString().slice(0, 10)}`);
    const report = await reportRes.json();
    assert.ok(report.summary);
    assert.ok(Array.isArray(report.byProduct));
  } finally {
    server.close();
  }
});
