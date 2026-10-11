const socket = io();
let products = [];
let cart = {}; // product_id -> quantity
let currentTab = 'all';
let openOrders = []; // طلبيات جديدة/جاهزة لم تُسلَّم بعد

// ----------- الساعة -----------
function tickClock(){
  const d = new Date();
  document.getElementById('clock').textContent = d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
}
setInterval(tickClock, 1000); tickClock();

// ----------- حالة الاتصال -----------
socket.on('connect', () => {
  const el = document.getElementById('connStatus');
  el.textContent = '🟢 متصل';
  el.style.background = '#DFF1DD';
});
socket.on('disconnect', () => {
  const el = document.getElementById('connStatus');
  el.textContent = '🔴 منقطع';
  el.style.background = '#FBD9D3';
});

// ----------- تحميل المنتجات -----------
async function loadProducts(){
  const res = await fetch('/api/products');
  products = await res.json();
  renderGrid();
}

function renderGrid(){
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  const list = products.filter(p => currentTab === 'all' || p.category === currentTab);
  for (const p of list){
    const qty = cart[p.id] || 0;
    const card = document.createElement('div');
    card.className = 'product-card' + (qty > 0 ? ' has-qty' : '');
    card.innerHTML = `
      ${qty > 0 ? `<div class="qty-badge">${qty}</div>` : ''}
      <button class="edit-qty" title="إدخال كمية يدوي">✎</button>
      <div class="icon">${p.icon}</div>
      <div class="name">${p.name}</div>
      <div class="price">${p.price.toFixed(2)} ₪</div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-qty')) {
        openQtyModal(p);
      } else {
        addOne(p.id);
      }
    });
    grid.appendChild(card);
  }
}

function addOne(productId){
  cart[productId] = (cart[productId] || 0) + 1;
  Sounds.tap();
  renderGrid();
  renderCart();
}

function setQty(productId, qty){
  qty = Math.max(0, Math.floor(qty) || 0);
  if (qty === 0) delete cart[productId];
  else cart[productId] = qty;
  renderGrid();
  renderCart();
}

// ----------- تبويبات الفئات -----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.cat;
    renderGrid();
  });
});

// ----------- نافذة إدخال الكمية اليدوي -----------
let qtyModalProductId = null;
function openQtyModal(product){
  qtyModalProductId = product.id;
  document.getElementById('qtyModalTitle').textContent = `الكمية — ${product.icon} ${product.name}`;
  const input = document.getElementById('qtyModalInput');
  input.value = cart[product.id] || '';
  document.getElementById('qtyModal').classList.add('show');
  setTimeout(() => input.focus(), 50);
}
function closeQtyModal(){
  document.getElementById('qtyModal').classList.remove('show');
  qtyModalProductId = null;
}
document.getElementById('qtyModalCancel').addEventListener('click', closeQtyModal);
document.getElementById('qtyModalOk').addEventListener('click', () => {
  const val = parseInt(document.getElementById('qtyModalInput').value, 10);
  if (qtyModalProductId != null) setQty(qtyModalProductId, val);
  closeQtyModal();
});
document.getElementById('qtyModalInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('qtyModalOk').click();
});
document.getElementById('qtyModal').addEventListener('click', (e) => {
  if (e.target.id === 'qtyModal') closeQtyModal();
});

// ----------- عرض السلة -----------
function renderCart(){
  const list = document.getElementById('cartList');
  const ids = Object.keys(cart);
  if (ids.length === 0){
    list.innerHTML = '<div class="empty-cart">اضغط على أي صنف لإضافته 👆</div>';
    document.getElementById('cartTotal').textContent = '0.00 ₪';
    document.getElementById('sendOrderBtn').disabled = true;
    return;
  }

  list.innerHTML = '';
  let total = 0;
  for (const id of ids){
    const p = products.find(pp => pp.id === parseInt(id));
    if (!p) continue;
    const qty = cart[id];
    const subtotal = p.price * qty;
    total += subtotal;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="ci-icon">${p.icon}</div>
      <div class="ci-info">
        <div class="ci-name">${p.name}</div>
        <div class="ci-price">${p.price.toFixed(2)} ₪ / للوحدة</div>
      </div>
      <div class="ci-controls">
        <button class="ci-minus">−</button>
        <input class="ci-qty" type="number" value="${qty}" min="0">
        <button class="ci-plus">+</button>
      </div>
      <div class="ci-subtotal">${subtotal.toFixed(2)}</div>
      <button class="ci-remove">✕</button>
    `;
    row.querySelector('.ci-minus').addEventListener('click', () => setQty(p.id, qty - 1));
    row.querySelector('.ci-plus').addEventListener('click', () => setQty(p.id, qty + 1));
    row.querySelector('.ci-remove').addEventListener('click', () => setQty(p.id, 0));
    row.querySelector('.ci-qty').addEventListener('change', (e) => setQty(p.id, parseInt(e.target.value, 10)));
    list.appendChild(row);
  }

  document.getElementById('cartTotal').textContent = total.toFixed(2) + ' ₪';
  document.getElementById('sendOrderBtn').disabled = false;
}

document.getElementById('clearCartBtn').addEventListener('click', () => {
  cart = {};
  document.getElementById('notesInput').value = '';
  renderGrid();
  renderCart();
});

// ----------- إرسال الطلبية -----------
document.getElementById('sendOrderBtn').addEventListener('click', async () => {
  const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id: parseInt(product_id), quantity }));
  if (items.length === 0) return;
  const notes = document.getElementById('notesInput').value.trim();

  const btn = document.getElementById('sendOrderBtn');
  btn.disabled = true; btn.textContent = 'جارٍ الإرسال...';

  try{
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, notes })
    });
    if (!res.ok) throw new Error('فشل الإرسال');
    const order = await res.json();
    Sounds.sent();
    showToast(`✅ تم إرسال الطلبية رقم ${order.order_number}`);
    cart = {};
    document.getElementById('notesInput').value = '';
    renderGrid();
    renderCart();
  } catch(err){
    Sounds.error();
    showToast('⚠️ تعذّر إرسال الطلبية، تحقّق من الاتصال');
  } finally {
    btn.textContent = 'إرسال الطلبية 🚀';
  }
});

// ----------- الطلبيات المفتوحة -----------
async function loadOpenOrders(){
  const res = await fetch('/api/orders/active');
  openOrders = await res.json();
  renderOpenOrders();
}

function renderOpenOrders(){
  const wrap = document.getElementById('openOrdersList');
  if (openOrders.length === 0){
    wrap.innerHTML = '<div style="color:#A99B86; font-size:13px;">لا توجد طلبيات مفتوحة</div>';
    return;
  }
  wrap.innerHTML = '';
  for (const o of openOrders){
    const card = document.createElement('div');
    card.className = 'open-order-card';
    const statusLabel = o.status === 'ready' ? 'جاهزة ✅' : 'قيد التحضير ⏳';
    const statusClass = o.status === 'ready' ? 'status-ready' : 'status-new';
    card.innerHTML = `
      <span>طلبية #${o.order_number} — ${o.total.toFixed(2)} ₪</span>
      <span class="oo-status ${statusClass}">${statusLabel}</span>
      <button class="oo-deliver-btn">تم التسليم</button>
    `;
    card.querySelector('.oo-deliver-btn').addEventListener('click', () => markDelivered(o.id));
    wrap.appendChild(card);
  }
}

async function markDelivered(orderId){
  await fetch(`/api/orders/${orderId}/status`, {
    method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status:'delivered'})
  });
}

// ----------- استقبال تحديثات لحظية -----------
socket.on('new-order', () => { loadOpenOrders(); });
socket.on('order-updated', (order) => {
  if (order.status === 'ready'){
    Sounds.ready();
    showToast(`🔔 الطلبية #${order.order_number} جاهزة من الفرن`);
  }
  loadOpenOrders();
});

// ----------- تنبيهات صغيرة -----------
function showToast(msg){
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

loadProducts();
loadOpenOrders();
setInterval(loadOpenOrders, 15000); // تحديث احتياطي كل 15 ثانية
