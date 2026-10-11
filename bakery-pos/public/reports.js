let currentPeriod = 'day';
let currentDate = new Date().toISOString().slice(0, 10);

document.getElementById('dateInput').value = currentDate;

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    loadReport();
  });
});
document.getElementById('dateInput').addEventListener('change', (e) => {
  currentDate = e.target.value;
  loadReport();
});

const categoryNames = { bread: '🍞 خبز', pastry: '🥐 معجنات' };

async function loadReport(){
  const res = await fetch(`/api/reports?period=${currentPeriod}&date=${currentDate}`);
  const data = await res.json();
  render(data);
}

function render(data){
  const { summary, byProduct, byCategory, byDay } = data;

  document.getElementById('ordersCount').textContent = summary.orders_count;
  document.getElementById('revenue').textContent = summary.revenue.toFixed(2) + ' ₪';
  const avg = summary.orders_count > 0 ? summary.revenue / summary.orders_count : 0;
  document.getElementById('avgOrder').textContent = avg.toFixed(2) + ' ₪';

  // حسب الفئة
  const catEl = document.getElementById('categoryList');
  if (byCategory.length === 0){
    catEl.innerHTML = '<div class="empty-note">لا توجد بيانات لهذه الفترة</div>';
  } else {
    catEl.innerHTML = byCategory.map(c => `
      <div class="list-row">
        <div>
          <div class="lr-name">${categoryNames[c.category] || c.category}</div>
          <div class="lr-sub">${c.qty} قطعة</div>
        </div>
        <div class="lr-value">${c.revenue.toFixed(2)} ₪</div>
      </div>
    `).join('');
  }

  // الأصناف الأكثر مبيعاً
  const prodEl = document.getElementById('productList');
  if (byProduct.length === 0){
    prodEl.innerHTML = '<div class="empty-note">لا توجد بيانات لهذه الفترة</div>';
  } else {
    prodEl.innerHTML = byProduct.slice(0, 8).map(p => `
      <div class="list-row">
        <div>
          <div class="lr-name">${p.product_name}</div>
          <div class="lr-sub">${p.qty} قطعة</div>
        </div>
        <div class="lr-value">${p.revenue.toFixed(2)} ₪</div>
      </div>
    `).join('');
  }

  // مخطط حسب اليوم
  const chartEl = document.getElementById('dayChart');
  if (byDay.length === 0){
    chartEl.innerHTML = '<div class="empty-note">لا توجد بيانات لهذه الفترة</div>';
  } else {
    const maxRev = Math.max(...byDay.map(d => d.revenue), 1);
    chartEl.innerHTML = byDay.map(d => {
      const h = Math.max(4, Math.round((d.revenue / maxRev) * 130));
      const label = d.day.slice(5); // MM-DD
      return `
        <div class="day-bar-wrap">
          <div class="day-bar-val">${d.revenue.toFixed(0)}</div>
          <div class="day-bar" style="height:${h}px;"></div>
          <div class="day-bar-label">${label}</div>
        </div>
      `;
    }).join('');
  }
}

loadReport();
