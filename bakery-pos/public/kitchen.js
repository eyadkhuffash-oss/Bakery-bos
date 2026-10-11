const socket = io();
let orders = []; // كل الطلبيات النشطة (new/ready) القادمة من السيرفر
let soundUnlocked = false;

function tickClock(){
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
}
setInterval(tickClock, 1000); tickClock();

socket.on('connect', () => {
  const el = document.getElementById('connStatus');
  el.textContent = '🟢 متصل';
});
socket.on('disconnect', () => {
  const el = document.getElementById('connStatus');
  el.textContent = '🔴 منقطع';
});

// ----------- فتح الصوت بأول لمسة (متطلب من المتصفحات على الموبايل) -----------
function unlockSound(){
  if (soundUnlocked) return;
  soundUnlocked = true;
  Sounds.tap();
  document.removeEventListener('touchstart', unlockSound);
  document.removeEventListener('click', unlockSound);
}
document.addEventListener('touchstart', unlockSound, { once:true });
document.addEventListener('click', unlockSound, { once:true });

// ----------- فلترة الأصناف: الفرن يهمه فقط "المعجنات" -----------
function pastryItems(order){
  return order.items.filter(it => it.category === 'pastry');
}

function timeAgo(createdAt){
  const created = new Date(createdAt.replace(' ', 'T'));
  const diffMin = Math.max(0, Math.round((Date.now() - created.getTime()) / 60000));
  if (diffMin < 1) return 'الآن';
  return `منذ ${diffMin} د`;
}

function render(){
  const wrap = document.getElementById('ordersWrap');
  const visible = orders.filter(o => pastryItems(o).length > 0);

  document.getElementById('emptyState').classList.toggle('hide', visible.length > 0);
  wrap.innerHTML = '';

  for (const o of visible){
    const items = pastryItems(o);
    const card = document.createElement('div');
    card.className = 'order-card ' + (o.status === 'ready' ? 'is-ready' : 'is-new');
    card.innerHTML = `
      <div class="oc-head">
        <span class="oc-num">طلبية #${o.order_number}</span>
        <span class="oc-time">${timeAgo(o.created_at)}</span>
      </div>
      <div class="oc-items">
        ${items.map(it => `
          <div class="oc-item">
            <span class="oi-icon">${it.icon || '🥐'}</span>
            <span class="oi-name">${it.product_name}</span>
            <span class="oi-qty">×${it.quantity}</span>
          </div>
        `).join('')}
      </div>
      ${o.notes ? `<div class="oc-notes">📝 ${escapeHtml(o.notes)}</div>` : ''}
      <div class="oc-actions">
        ${o.status === 'ready'
          ? `<div class="oc-btn oc-btn-done-label">✅ جاهزة — بانتظار التسليم</div>`
          : `<button class="oc-btn oc-btn-ready">✅ تمّ التحضير</button>`}
      </div>
    `;
    if (o.status !== 'ready'){
      card.querySelector('.oc-btn-ready').addEventListener('click', () => markReady(o.id));
    }
    wrap.appendChild(card);
  }
}

function escapeHtml(s){
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

async function markReady(orderId){
  await fetch(`/api/orders/${orderId}/status`, {
    method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status:'ready'})
  });
}

async function loadActiveOrders(){
  const res = await fetch('/api/orders/active');
  orders = await res.json();
  render();
}

socket.on('new-order', (order) => {
  if (pastryItems(order).length === 0) return; // طلبية خبز فقط، لا تهم الفرن
  orders.push(order);
  render();
  if (soundUnlocked) Sounds.newOrder();
  if (navigator.vibrate) navigator.vibrate([200,100,200]);
});

socket.on('order-updated', (order) => {
  const idx = orders.findIndex(o => o.id === order.id);
  if (order.status === 'delivered' || order.status === 'cancelled'){
    if (idx >= 0) orders.splice(idx, 1);
  } else {
    if (idx >= 0) orders[idx] = order; else orders.push(order);
  }
  render();
});

setInterval(() => render(), 30000); // لتحديث "منذ كم دقيقة"
loadActiveOrders();
