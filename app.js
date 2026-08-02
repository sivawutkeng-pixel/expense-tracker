const $ = id => document.getElementById(id);
let currentType = 'personal';
let items = JSON.parse(localStorage.getItem('expenseItemsV1') || '[]');

function money(n){ return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(n||0); }
function setType(t){
  currentType=t;
  $('btnPersonal').classList.toggle('active',t==='personal');
  $('btnSponsor').classList.toggle('active',t==='sponsor');
}
$('btnPersonal').onclick=()=>setType('personal');
$('btnSponsor').onclick=()=>setType('sponsor');

function compressImage(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve('');
    const img=new Image(), reader=new FileReader();
    reader.onload=e=>img.src=e.target.result;
    reader.onerror=reject;
    img.onload=()=>{
      const max=1100, scale=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');
      c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      resolve(c.toDataURL('image/jpeg',0.72));
    };
    reader.readAsDataURL(file);
  });
}

function updateConversion(){
  const currency=$('currency').value;
  const amount=parseFloat($('amount').value)||0;
  const rate=currency==='THB' ? 1 : (parseFloat($('rate').value)||0);
  $('rate').disabled = currency==='THB';
  $('rate').value = currency==='THB' ? 1 : $('rate').value;
  $('rateHint').textContent = `1 ${currency} = ${rate.toFixed(4)} บาท`;
  $('convertedAmount').textContent = money(amount*rate);
}

$('currency').onchange=()=>{
  const savedRates=JSON.parse(localStorage.getItem('expenseRatesV1')||'{}');
  const c=$('currency').value;
  $('rate').value = c==='THB' ? 1 : (savedRates[c] || '');
  updateConversion();
};
$('amount').oninput=updateConversion;
$('rate').oninput=updateConversion;

$('saveBtn').onclick=async()=>{
  const amount=parseFloat($('amount').value);
  const currency=$('currency').value;
  const rate=currency==='THB' ? 1 : parseFloat($('rate').value);
  if(!amount || amount<=0){ alert('กรุณาระบุจำนวนเงิน'); return; }
  if(!rate || rate<=0){ alert('กรุณาระบุอัตราแลกเปลี่ยน'); return; }

  const savedRates=JSON.parse(localStorage.getItem('expenseRatesV1')||'{}');
  savedRates[currency]=rate;
  localStorage.setItem('expenseRatesV1',JSON.stringify(savedRates));

  const photo=await compressImage($('receipt').files[0]);
  const now=new Date();
  items.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: currentType,
    amount,
    currency,
    rate,
    amountTHB: amount*rate,
    note: $('note').value.trim(),
    photo,
    createdAt: now.toISOString()
  });
  localStorage.setItem('expenseItemsV1',JSON.stringify(items));
  $('amount').value=''; $('note').value=''; $('receipt').value='';
  updateConversion();
  render();
};

function filtered(){
  const type=$('filterType').value, month=$('filterMonth').value;
  return items.filter(x=>{
    const okType=type==='all'||x.type===type;
    const d=new Date(x.createdAt);
    const ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    return okType && (!month || month===ym);
  });
}

function render(){
  const valueTHB=x=>Number(x.amountTHB ?? x.amount ?? 0);
  const all=items.reduce((s,x)=>s+valueTHB(x),0);
  const p=items.filter(x=>x.type==='personal').reduce((s,x)=>s+valueTHB(x),0);
  const sp=items.filter(x=>x.type==='sponsor').reduce((s,x)=>s+valueTHB(x),0);
  $('sumAll').textContent=money(all); $('sumPersonal').textContent=money(p); $('sumSponsor').textContent=money(sp);

  const data=filtered();
  if(!data.length){ $('list').innerHTML='<div class="empty">ยังไม่มีรายการ</div>'; return; }
  $('list').innerHTML=data.map(x=>{
    const d=new Date(x.createdAt);
    const date=d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
    return `<div class="item">
      ${x.photo?`<img class="thumb" src="${x.photo}" alt="ใบเสร็จ">`:`<div class="thumb"></div>`}
      <div>
        <div><span class="tag">${x.type==='personal'?'ส่วนตัว':'สปอนเซอร์'}</span></div>
        <div style="font-weight:700;margin-top:5px">${escapeHtml(x.note||'ไม่ระบุรายการ')}</div>
        <div class="meta">${date}</div>
        <button class="del" onclick="removeItem('${x.id}')">ลบรายการ</button>
      </div>
      <div class="amt">
        ${x.currency && x.currency!=='THB' ? `${Number(x.amount).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})} ${x.currency}<br><span class="meta">≈ ${money(x.amountTHB)}</span>` : money(x.amountTHB ?? x.amount)}
      </div>
    </div>`;
  }).join('');
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
window.removeItem=id=>{
  if(confirm('ลบรายการนี้หรือไม่?')){
    items=items.filter(x=>x.id!==id);
    localStorage.setItem('expenseItemsV1',JSON.stringify(items));
    render();
  }
};
$('filterType').onchange=render; $('filterMonth').onchange=render;

$('exportBtn').onclick=()=>{
  const rows=[['วันที่เวลา','หมวด','จำนวนเงินเดิม','สกุลเงิน','อัตราเป็นบาท','ยอดเงินบาท','รายการ']];
  items.slice().reverse().forEach(x=>{
    rows.push([
      new Date(x.createdAt).toLocaleString('th-TH'),
      x.type==='personal'?'ส่วนตัว':'สปอนเซอร์',
      x.amount,
      x.currency||'THB',
      x.rate||1,
      x.amountTHB ?? x.amount,
      x.note||''
    ]);
  });
  const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='ค่าใช้จ่าย.csv'; a.click(); URL.revokeObjectURL(a.href);
};
updateConversion();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}
