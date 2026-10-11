let suppliers = [];
let items = [];
let movements = [];
let selectedItemId = null;

function showToast(msg){
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

async function api(path, options){
  const res = await fetch(path, options);
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(txt || 'request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

function fillSelect(sel, values, {valueKey='id', labelKey='name', placeholder}={}){
  sel.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }
  for (const v of values){
    const opt = document.createElement('option');
    opt.value = v[valueKey];
    opt.textContent = v[labelKey];
    sel.appendChild(opt);
  }
}

function renderItemsTable(){
  const body = document.getElementById('itemsTableBody');
  body.innerHTML = '';

  for (const it of items){
    const tr = document.createElement('tr');
    const statusBadge = it.active ? '<span class="badge badge-green">فعّال</span>' : '<span class="badge badge-red">متوقف</span>';
    tr.innerHTML = `
      <td>${it.name}</td>
      <td><strong>${Number(it.balance_qty || 0).toFixed(2)}</strong></td>
      <td>${it.unit || 'قطعة'}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-ghost" style="padding:6px 10px;" onclick="selectItem(${it.id})">اختيار</button>
      </td>
    `;
    body.appendChild(tr);
  }
}

function selectItem(id){
  const it = items.find(x=>x.id===id);
  if (!it) return;
  selectedItemId = id;
  document.getElementById('itemName').value = it.name;
  document.getElementById('itemUnit').value = it.unit || 'قطعة';
  showToast('تم اختيار: ' + it.name);
}

document.getElementById('addItemBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('itemName').value.trim();
  const unit = document.getElementById('itemUnit').value.trim() || 'قطعة';
  if (!name) return showToast('⚠️ أدخل اسم المادة');

  await api('/api/inventory/items', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, unit })
  });
  showToast('✅ تمت إضافة المادة');
  await loadAll();
});

document.getElementById('toggleItemBtn').addEventListener('click', async ()=>{
  if (!selectedItemId) return showToast('⚠️ اختر مادة أولاً');
  const it = items.find(x=>x.id===selectedItemId);
  if (!it) return;
  const nextActive = it.active ? 0 : 1;

  await api(`/api/inventory/items/${selectedItemId}/active`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ active: nextActive })
  });
  showToast('✅ تم تحديث الحالة');
  await loadAll();
});

document.getElementById('addEntryBtn').addEventListener('click', async ()=>{
  const itemId = document.getElementById('entryItemSelect').value;
  const supplierId = document.getElementById('entrySupplierSelect').value || null;
  const qty = Number(document.getElementById('entryQty').value || 0);
  const unitCostStr = document.getElementById('entryUnitCost').value;
  const unitCost = unitCostStr === '' ? null : Number(unitCostStr);
  const notes = document.getElementById('entryNotes').value.trim() || null;

  if (!itemId) return showToast('⚠️ اختر مادة');
  if (qty <= 0) return showToast('⚠️ الكمية لازم تكون > 0');

  await api('/api/inventory/entries', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      item_id: Number(itemId),
      supplier_id: supplierId ? Number(supplierId) : null,
      qty_in: qty,
      unit_cost: unitCost,
      notes
    })
  });

  showToast('✅ تم تسجيل الدخول');
  document.getElementById('entryQty').value = '';
  document.getElementById('entryUnitCost').value = '';
  document.getElementById('entryNotes').value = '';
  await loadAll();
});

document.getElementById('addExitBtn').addEventListener('click', async ()=>{
  const itemId = document.getElementById('exitItemSelect').value;
  const qty = Number(document.getElementById('exitQty').value || 0);
  const reason = document.getElementById('exitReason').value.trim() || 'صرف/استهلاك';
  const notes = document.getElementById('exitNotes').value.trim() || null;

  if (!itemId) return showToast('⚠️ اختر مادة');
  if (qty <= 0) return showToast('⚠️ الكمية لازم تكون > 0');

  await api('/api/inventory/exits', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ item_id: Number(itemId), qty_out: qty, reason, notes })
  });

  showToast('✅ تم تسجيل الخروج');
  document.getElementById('exitQty').value = '';
  document.getElementById('exitReason').value = '';
  document.getElementById('exitNotes').value = '';
  await loadAll();
});

async function loadSuppliers(){
  suppliers = await api('/api/suppliers').catch(()=>[]);
}

async function loadItems(){
  items = await api('/api/inventory/items').catch(()=>[]);
}

async function loadMovements(){
  movements = await api('/api/inventory/movements').catch(()=>[]);
}

function renderMovements(){
  const body = document.getElementById('movementsBody');
  body.innerHTML = '';

  for (const m of movements){
    const typeLabel = m.kind === 'in' ? '📥 دخول' : '📤 خروج';
    const qty = m.kind === 'in' ? '+' + Number(m.qty).toFixed(2) : '-' + Number(m.qty).toFixed(2);

    const details = m.kind === 'in'
      ? `سعر/تكلفة: ${m.unit_cost != null ? Number(m.unit_cost).toFixed(2) : '—'}${m.supplier_name ? (' · من: ' + m.supplier_name) : ''}`
      : `${m.reason ? m.reason : ''}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.at ? String(m.at).slice(0,16).replace('T',' ') : '—'}</td>
      <td>${typeLabel}</td>
      <td>${m.item_name}</td>
      <td><strong>${qty}</strong></td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${details}">${details}</td>
    `;
    body.appendChild(tr);
  }
}

async function loadAll(){
  await loadSuppliers();
  await loadItems();
  await loadMovements();

  fillSelect(document.getElementById('entryItemSelect'), items.filter(x=>x.active), {placeholder:'اختر مادة'});
  fillSelect(document.getElementById('exitItemSelect'), items.filter(x=>x.active), {placeholder:'اختر مادة'});
  fillSelect(document.getElementById('entrySupplierSelect'), suppliers, {placeholder:'(اختياري) لا يوجد مورد'});

  renderItemsTable();
  renderMovements();
}

window.selectItem = selectItem;
loadAll().catch(err=>{
  console.error(err);
  showToast('⚠️ فشل تحميل المخزون');
});

