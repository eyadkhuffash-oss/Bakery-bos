let products = [];

async function loadProducts(){
  const res = await fetch('/api/products/all');
  products = await res.json();
  renderTable();
}

function renderTable(){
  const tbody = document.getElementById('prodTableBody');
  tbody.innerHTML = '';
  for (const p of products){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="icon-cell">${p.icon}</td>
      <td><input type="text" value="${p.name}" data-field="name"></td>
      <td>
        <select data-field="category">
          <option value="pastry" ${p.category==='pastry'?'selected':''}>معجنات</option>
          <option value="bread" ${p.category==='bread'?'selected':''}>خبز</option>
        </select>
      </td>
      <td><input type="number" step="0.25" min="0" value="${p.price}" data-field="price" style="width:80px;"></td>
      <td>${p.active ? '<span class="badge-active">فعّال</span>' : '<span class="badge-inactive">متوقف</span>'}</td>
      <td class="row-actions">
        <button class="btn btn-primary saveBtn">حفظ</button>
        <button class="btn ${p.active ? 'btn-ghost' : 'btn-secondary'} toggleBtn">${p.active ? 'إيقاف' : 'تفعيل'}</button>
      </td>
    `;
    tr.querySelector('.saveBtn').addEventListener('click', () => saveProduct(p.id, tr));
    tr.querySelector('.toggleBtn').addEventListener('click', () => toggleActive(p.id, !p.active));
    tbody.appendChild(tr);
  }
}

async function saveProduct(id, tr){
  const name = tr.querySelector('[data-field="name"]').value.trim();
  const category = tr.querySelector('[data-field="category"]').value;
  const price = parseFloat(tr.querySelector('[data-field="price"]').value);
  if (!name || isNaN(price)) { showToast('⚠️ تحقق من الاسم والسعر'); return; }

  await fetch(`/api/products/${id}`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, category, price })
  });
  showToast('✅ تم الحفظ');
  loadProducts();
}

async function toggleActive(id, active){
  await fetch(`/api/products/${id}`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ active: active ? 1 : 0 })
  });
  loadProducts();
}

document.getElementById('addBtn').addEventListener('click', async () => {
  const icon = document.getElementById('newIcon').value.trim() || '🥐';
  const name = document.getElementById('newName').value.trim();
  const category = document.getElementById('newCategory').value;
  const price = parseFloat(document.getElementById('newPrice').value);

  if (!name || isNaN(price)){ showToast('⚠️ أدخل اسم الصنف والسعر'); return; }

  await fetch('/api/products', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ icon, name, category, price })
  });
  document.getElementById('newName').value = '';
  document.getElementById('newPrice').value = '';
  document.getElementById('newIcon').value = '';
  showToast('✅ تمت إضافة الصنف');
  loadProducts();
});

function showToast(msg){
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

loadProducts();
