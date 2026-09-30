
let app = null;
let dbInfoCache = null;
let serverBusy = false;
const CLIENT_CACHE_KEY = 'keuangan-mandiri-github-v1';
const pageMeta = {
  dashboard:['Dashboard','Ringkasan kondisi keuanganmu.'],
  transactions:['Transaksi','Catat semua arus uang dan transfer antar akun.'],
  reports:['Laporan','Ringkasan bulanan yang siap dibaca atau diekspor.'],
  budgets:['Budget','Batasi pengeluaran sebelum dompetmu mengambil keputusan sendiri.'],
  goals:['Target','Pantau tujuan keuangan secara terpisah.'],
  debts:['Hutang & Piutang','Jangan mengandalkan ingatan untuk uang yang harus kembali.'],
  recurring:['Transaksi Berulang','Otomatisasi transaksi rutin.'],
  accounts:['Akun','Kelola kas, bank, e-wallet, dan saldo awal.'],
  settings:['Pengaturan','Identitas aplikasi, kategori, dan database.']
};

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindForms();
  bindAuth();
  setDefaultDates();
  initSession();
});

function bindAuth(){
  document.getElementById('loginForm').addEventListener('submit', login);
}

async function initSession(){
  try{
    const res=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
    const body=await res.json();
    if(body.authenticated){showAppShell();loadApp();return;}
  }catch(err){console.error(err)}
  showLoginScreen();
}

function showAppShell(){
  document.getElementById('loginScreen').classList.add('hidden');
  document.querySelectorAll('.app-protected').forEach(el=>el.classList.remove('hidden'));
}

function showLoginScreen(message){
  document.querySelectorAll('.app-protected').forEach(el=>el.classList.add('hidden'));
  document.getElementById('loginScreen').classList.remove('hidden');
  const error=document.getElementById('loginError');
  if(message){error.textContent=message;error.classList.remove('hidden')}else{error.textContent='';error.classList.add('hidden')}
  setTimeout(()=>document.getElementById('loginPassword').focus(),30);
}

async function login(e){
  e.preventDefault();
  const button=document.getElementById('loginButton');
  const password=document.getElementById('loginPassword').value;
  button.disabled=true;button.textContent='Memeriksa...';
  document.getElementById('loginError').classList.add('hidden');
  try{
    const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),credentials:'same-origin'});
    const body=await safeJson(res);
    if(!res.ok||!body.ok)throw new Error(body.error||'Login gagal.');
    document.getElementById('loginForm').reset();
    showAppShell();
    loadApp();
  }catch(err){showLoginScreen(err.message||'Login gagal.')}finally{button.disabled=false;button.textContent='Masuk'}
}

async function logout(){
  try{await fetch('/api/logout',{method:'POST',credentials:'same-origin'})}catch(err){}
  sessionStorage.removeItem(CLIENT_CACHE_KEY);
  app=null;dbInfoCache=null;serverBusy=false;
  showLoginScreen();
}

async function safeJson(response){
  try{return await response.json()}catch(err){return {ok:false,error:'Respons server tidak valid.'}}
}

async function apiFetch(url,options={}){
  const res=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  const body=await safeJson(res);
  if(res.status===401){sessionStorage.removeItem(CLIENT_CACHE_KEY);showLoginScreen('Sesi habis. Masuk lagi.');throw new Error('Sesi habis.');}
  if(!res.ok||body.ok===false)throw new Error(body.error||'Permintaan gagal.');
  return body.data!==undefined?body.data:body;
}

function bindNavigation(){
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
}

function showPage(page){
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));
  document.getElementById('pageTitle').textContent=pageMeta[page][0];
  document.getElementById('pageSubtitle').textContent=pageMeta[page][1];
  if(page==='settings') loadDatabaseInfo();
  window.scrollTo({top:0,behavior:'smooth'});
}

function bindForms(){
  document.getElementById('transactionForm').addEventListener('submit', submitTransaction);
  document.getElementById('budgetForm').addEventListener('submit', submitBudget);
  document.getElementById('goalForm').addEventListener('submit', submitGoal);
  document.getElementById('debtForm').addEventListener('submit', submitDebt);
  document.getElementById('recurringForm').addEventListener('submit', submitRecurring);
  document.getElementById('accountForm').addEventListener('submit', submitAccount);
  document.getElementById('settingsForm').addEventListener('submit', submitSettings);
  document.getElementById('categoryForm').addEventListener('submit', submitCategory);
}

async function loadApp(){
  let hasLocalCache=false;
  try{
    const raw=sessionStorage.getItem(CLIENT_CACHE_KEY);
    if(raw){app=JSON.parse(raw);renderAll();hasLocalCache=true;}
  }catch(err){sessionStorage.removeItem(CLIENT_CACHE_KEY);}

  busy(!hasLocalCache);
  try{
    const data=await apiFetch('/api/bootstrap');
    applyAppData(data);
    busy(false);
  }catch(err){busy(false);if(!hasLocalCache)fail(err);else console.error(err)}
}

function applyAppData(data){
  app=data;
  try{sessionStorage.setItem(CLIENT_CACHE_KEY,JSON.stringify(data))}catch(err){}
  renderAll();
}

function refreshFrom(data,message){applyAppData(data);busy(false);serverBusy=false;if(message)toast(message)}

function renderAll(){
  if(!app)return;
  document.getElementById('brandName').textContent=app.settings.app_name||'Keuangan Mandiri';
  document.getElementById('settingAppName').value=app.settings.app_name||'Keuangan Mandiri';
  document.getElementById('settingOwnerName').value=app.settings.owner_name||'';
  populateSelects();
  renderDashboard();renderTransactions();renderReport();renderBudgets();renderGoals();renderDebts();renderRecurring();renderAccounts();renderCategories();
}

function populateSelects(){
  const activeAccounts=app.accounts.filter(a=>a.active);
  ['txFrom','txTo','debtAccount','recFrom','recTo'].forEach(id=>fillSelect(id,activeAccounts.map(a=>({value:a.id,label:a.name+' · '+money(a.balance)})),true));
  const expenseCats=app.categories.filter(c=>c.active&&c.type==='Pengeluaran');
  fillSelect('budgetCategory',expenseCats.map(c=>({value:c.id,label:c.name})),false);
  syncTransactionForm();syncRecurringForm();
}

function fillSelect(id,items,allowBlank){
  const el=document.getElementById(id);if(!el)return;const old=el.value;el.innerHTML=allowBlank?'<option value="">Pilih...</option>':'';
  items.forEach(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.label;el.appendChild(o)});if([...el.options].some(o=>o.value===old))el.value=old;
}

function syncTransactionForm(){
  if(!app)return;const type=document.getElementById('txType').value;
  document.getElementById('txFromWrap').classList.toggle('hidden',type==='Pemasukan');
  document.getElementById('txToWrap').classList.toggle('hidden',type==='Pengeluaran');
  document.getElementById('txCategoryWrap').classList.toggle('hidden',type==='Transfer');
  if(type!=='Transfer')fillSelect('txCategory',app.categories.filter(c=>c.active&&c.type===type).map(c=>({value:c.id,label:c.name})),false);
}
function syncRecurringForm(){
  if(!app)return;const type=document.getElementById('recType').value;
  document.getElementById('recFromWrap').classList.toggle('hidden',type==='Pemasukan');
  document.getElementById('recToWrap').classList.toggle('hidden',type==='Pengeluaran');
  document.getElementById('recCategoryWrap').classList.toggle('hidden',type==='Transfer');
  if(type!=='Transfer')fillSelect('recCategory',app.categories.filter(c=>c.active&&c.type===type).map(c=>({value:c.id,label:c.name})),false);
}

function renderDashboard(){
  const d=app.dashboard;setText('mBalance',money(d.totalBalance));setText('mIncome',money(d.monthIncome));setText('mExpense',money(d.monthExpense));setText('mNet',money(d.monthNet));setText('mDebt',money(d.totalDebt));setText('mReceivable',money(d.totalReceivable));setText('mSavings','Rasio tabungan '+d.savingsRate+'%');setText('mMonth1',monthLabel(app.currentMonth));setText('mMonth2',monthLabel(app.currentMonth));
  const net=document.getElementById('mNet');net.className=d.monthNet>=0?'good':'bad';
  const accountMini=document.getElementById('accountMini');accountMini.innerHTML=app.accounts.filter(a=>a.active).slice(0,5).map(a=>stackItem(a.name,a.type,money(a.balance))).join('')||emptyHtml('Belum ada akun.');
  document.getElementById('recentTransactions').innerHTML=d.recentTransactions.map(tx=>stackItem(tx.description||tx.categoryName||tx.type,formatDate(tx.date)+' · '+accountFlow(tx),signedMoney(tx))).join('')||emptyHtml('Belum ada transaksi.');
  const maxCat=Math.max(1,...d.expenseCategories.map(x=>x.amount));document.getElementById('expenseCategory').innerHTML=d.expenseCategories.map(x=>`<div class="bar-row"><div class="bar-head"><span>${esc(x.categoryName)}</span><strong>${money(x.amount)}</strong></div><div class="bar-bg"><div class="bar-fill" style="width:${Math.round(x.amount/maxCat*100)}%"></div></div></div>`).join('')||emptyHtml('Belum ada pengeluaran bulan ini.');
  renderTrend();
}

function renderTrend(){
  const data=app.dashboard.monthlyTrend;const max=Math.max(1,...data.flatMap(x=>[x.income,x.expense]));document.getElementById('trendChart').innerHTML=data.map(x=>`<div class="trend-col"><div class="trend-bars"><div class="trend-bar income" title="Pemasukan ${money(x.income)}" style="height:${Math.max(2,x.income/max*150)}px"></div><div class="trend-bar expense" title="Pengeluaran ${money(x.expense)}" style="height:${Math.max(2,x.expense/max*150)}px"></div></div><div class="trend-label">${monthLabel(x.month,true)}</div></div>`).join('');
}

function renderTransactions(){
  if(!app)return;const q=(document.getElementById('txSearch').value||'').toLowerCase();const type=document.getElementById('txFilterType').value;const month=document.getElementById('txFilterMonth').value;
  const rows=app.transactions.filter(tx=>(!type||tx.type===type)&&(!month||tx.date.startsWith(month))&&(!q||[tx.description,tx.categoryName,tx.fromAccountName,tx.toAccountName,tx.note].join(' ').toLowerCase().includes(q)));
  document.getElementById('txTable').innerHTML=rows.map(tx=>`<tr><td>${formatDate(tx.date)}</td><td><strong>${esc(tx.description||tx.categoryName||tx.type)}</strong><div class="muted">${esc(tx.categoryName||'')}</div></td><td>${typeBadge(tx.type)}</td><td>${esc(accountFlow(tx))}</td><td class="${tx.type==='Pemasukan'?'good':tx.type==='Pengeluaran'?'bad':''}"><strong>${signedMoney(tx)}</strong></td><td><div class="row-actions"><button class="icon-btn" onclick="editTransaction('${tx.id}')">Edit</button><button class="icon-btn danger" onclick="removeTransaction('${tx.id}')">Hapus</button></div></td></tr>`).join('');
  document.getElementById('txEmpty').classList.toggle('hidden',rows.length>0);
}

function submitTransaction(e){e.preventDefault();const data={id:v('txId'),date:v('txDate'),type:v('txType'),fromAccountId:v('txFrom'),toAccountId:v('txTo'),categoryId:v('txCategory'),amount:Number(v('txAmount')),description:v('txDescription'),note:v('txNote')};callServer('saveTransaction',data,'Transaksi tersimpan.');}
function editTransaction(id){const tx=app.transactions.find(x=>x.id===id);if(!tx)return;showPage('transactions');setv('txId',tx.id);setv('txDate',tx.date);setv('txType',tx.type);syncTransactionForm();setv('txFrom',tx.fromAccountId);setv('txTo',tx.toAccountId);setv('txCategory',tx.categoryId);setv('txAmount',tx.amount);setv('txDescription',tx.description);setv('txNote',tx.note);setText('txFormTitle','Edit Transaksi');document.getElementById('txCancel').classList.remove('hidden');}
function resetTransactionForm(){document.getElementById('transactionForm').reset();setv('txId','');setText('txFormTitle','Tambah Transaksi');document.getElementById('txCancel').classList.add('hidden');setv('txDate',today());setv('txType','Pemasukan');syncTransactionForm();}
function removeTransaction(id){if(!confirm('Hapus transaksi ini?'))return;callServer('deleteTransaction',id,'Transaksi dihapus.');}
function quickTransaction(){showPage('transactions');resetTransactionForm();document.getElementById('txAmount').focus();}

function renderReport(){
  if(!app)return;const month=v('reportMonth')||app.currentMonth;const txs=app.transactions.filter(tx=>tx.date.startsWith(month));let income=0,expense=0;const cats={};
  txs.forEach(tx=>{if(tx.type==='Pemasukan')income+=tx.amount;if(tx.type==='Pengeluaran'){expense+=tx.amount;cats[tx.categoryName||'Tanpa kategori']=(cats[tx.categoryName||'Tanpa kategori']||0)+tx.amount;}});
  setText('rIncome',money(income));setText('rExpense',money(expense));setText('rNet',money(income-expense));document.getElementById('rNet').className=income-expense>=0?'good':'bad';setText('rCount',String(txs.length));setText('reportCategorySub',monthLabel(month));setText('reportTxSub',monthLabel(month));
  const catRows=Object.entries(cats).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...catRows.map(x=>x[1]));document.getElementById('reportCategories').innerHTML=catRows.map(([name,amount])=>`<div class="bar-row"><div class="bar-head"><span>${esc(name)}</span><strong>${money(amount)}</strong></div><div class="bar-bg"><div class="bar-fill" style="width:${Math.round(amount/max*100)}%"></div></div></div>`).join('')||emptyHtml('Tidak ada pengeluaran.');
  document.getElementById('reportAccounts').innerHTML=app.accounts.filter(a=>a.active).map(a=>stackItem(a.name,a.type,money(a.balance))).join('')||emptyHtml('Belum ada akun.');
  document.getElementById('reportTable').innerHTML=txs.map(tx=>`<tr><td>${formatDate(tx.date)}</td><td>${esc(tx.description||'-')}</td><td>${typeBadge(tx.type)}</td><td>${esc(tx.categoryName||'-')}</td><td>${esc(accountFlow(tx))}</td><td class="${tx.type==='Pemasukan'?'good':tx.type==='Pengeluaran'?'bad':''}"><strong>${signedMoney(tx)}</strong></td></tr>`).join('');document.getElementById('reportEmpty').classList.toggle('hidden',txs.length>0);
}
function exportReportCSV(){
  const month=v('reportMonth')||app.currentMonth;const rows=app.transactions.filter(tx=>tx.date.startsWith(month));const header=['Tanggal','Jenis','Kategori','Deskripsi','Akun Asal','Akun Tujuan','Nominal','Catatan'];const csv=[header,...rows.map(tx=>[tx.date,tx.type,tx.categoryName,tx.description,tx.fromAccountName,tx.toAccountName,tx.amount,tx.note])].map(row=>row.map(csvCell).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`laporan-keuangan-${month}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Laporan CSV dibuat.');
}
function csvCell(value){const s=String(value==null?'':value);return '"'+s.replace(/"/g,'""')+'"'}

function renderBudgets(){
  const rows=app.budgets;document.getElementById('budgetCards').innerHTML=rows.map(b=>{const over=b.percent>100;return `<article class="mini-card"><div class="mini-card-head"><div><h3>${esc(b.categoryName)}</h3><p>${monthLabel(b.month)}</p></div><strong class="${over?'bad':''}">${b.percent}%</strong></div><div class="big">${money(b.used)} <span class="muted-small">/ ${money(b.limit)}</span></div><div class="progress ${over?'over':''}"><i style="width:${Math.min(100,b.percent)}%"></i></div><div class="progress-label"><span>${over?'Lewat budget':'Sisa'}</span><span>${money(Math.abs(b.remaining))}</span></div><div class="mini-actions"><button class="secondary small" onclick="editBudget('${b.id}')">Edit</button><button class="danger small" onclick="removeBudget('${b.id}')">Hapus</button></div></article>`}).join('')||emptyHtml('Belum ada budget.');
}
function submitBudget(e){e.preventDefault();callServer('saveBudget',{id:v('budgetId'),month:v('budgetMonth'),categoryId:v('budgetCategory'),limit:Number(v('budgetLimit'))},'Budget tersimpan.');}
function editBudget(id){const b=app.budgets.find(x=>x.id===id);if(!b)return;setv('budgetId',b.id);setv('budgetMonth',b.month);setv('budgetCategory',b.categoryId);setv('budgetLimit',b.limit);document.getElementById('budgetCancel').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}
function resetBudgetForm(){document.getElementById('budgetForm').reset();setv('budgetId','');setv('budgetMonth',app.currentMonth);document.getElementById('budgetCancel').classList.add('hidden');}
function removeBudget(id){if(confirm('Hapus budget ini?'))callServer('deleteBudget',id,'Budget dihapus.');}

function renderGoals(){
  document.getElementById('goalCards').innerHTML=app.goals.map(g=>`<article class="mini-card"><div class="mini-card-head"><div><h3>${esc(g.name)}</h3><p>${g.deadline?'Deadline '+formatDate(g.deadline):'Tanpa deadline'}</p></div><strong>${g.percent}%</strong></div><div class="big">${money(g.current)}</div><div class="progress"><i style="width:${g.percent}%"></i></div><div class="progress-label"><span>Target ${money(g.target)}</span><span>Sisa ${money(g.remaining)}</span></div><div class="mini-actions"><button class="primary small" onclick="goalDepositModal('${g.id}')">+ Setoran</button><button class="secondary small" onclick="editGoal('${g.id}')">Edit</button><button class="danger small" onclick="removeGoal('${g.id}')">Hapus</button></div></article>`).join('')||emptyHtml('Belum ada target keuangan.');
}
function submitGoal(e){e.preventDefault();callServer('saveGoal',{id:v('goalId'),name:v('goalName'),target:Number(v('goalTarget')),deadline:v('goalDeadline'),note:v('goalNote')},'Target tersimpan.');}
function editGoal(id){const g=app.goals.find(x=>x.id===id);if(!g)return;setv('goalId',g.id);setv('goalName',g.name);setv('goalTarget',g.target);setv('goalDeadline',g.deadline);setv('goalNote',g.note);setText('goalFormTitle','Edit Target');document.getElementById('goalCancel').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}
function resetGoalForm(){document.getElementById('goalForm').reset();setv('goalId','');setText('goalFormTitle','Target Keuangan');document.getElementById('goalCancel').classList.add('hidden');}
function removeGoal(id){if(confirm('Hapus target dan riwayat setorannya?'))callServer('deleteGoal',id,'Target dihapus.');}
function goalDepositModal(id){const g=app.goals.find(x=>x.id===id);openModal(`<h2>Setoran Target</h2><p class="muted">${esc(g.name)} · tersisa ${money(g.remaining)}</p><form onsubmit="submitGoalDeposit(event,'${id}')" class="form-grid compact"><label>Tanggal<input id="modalGoalDate" type="date" value="${today()}" required></label><label>Nominal<input id="modalGoalAmount" type="number" min="1" required></label><label class="span-2">Catatan<input id="modalGoalNote"></label><div class="form-actions span-2"><button class="primary" type="submit">Simpan Setoran</button></div></form>`);}
function submitGoalDeposit(e,id){e.preventDefault();const data={goalId:id,date:v('modalGoalDate'),amount:Number(v('modalGoalAmount')),note:v('modalGoalNote')};closeModal();callServer('addGoalContribution',data,'Setoran target dicatat.');}

function renderDebts(){
  document.getElementById('debtCards').innerHTML=app.debts.map(d=>`<article class="mini-card"><div class="mini-card-head"><div><h3>${esc(d.party)}</h3><p>${esc(d.direction)}${d.dueDate?' · '+formatDate(d.dueDate):''}</p></div>${typeBadge(d.direction==='Hutang'?'Pengeluaran':'Pemasukan')}</div><div class="big">${money(d.remaining)}</div><div class="progress"><i style="width:${d.principal?Math.min(100,d.paid/d.principal*100):0}%"></i></div><div class="progress-label"><span>Terbayar ${money(d.paid)}</span><span>Pokok ${money(d.principal)}</span></div><div class="mini-actions">${d.remaining>0?`<button class="primary small" onclick="debtPaymentModal('${d.id}')">Catat Bayar</button>`:''}<button class="secondary small" onclick="editDebt('${d.id}')">Edit</button><button class="danger small" onclick="removeDebt('${d.id}')">Hapus</button></div></article>`).join('')||emptyHtml('Belum ada hutang atau piutang.');
}
function submitDebt(e){e.preventDefault();callServer('saveDebt',{id:v('debtId'),direction:v('debtDirection'),party:v('debtParty'),principal:Number(v('debtPrincipal')),dueDate:v('debtDue'),accountId:v('debtAccount'),description:v('debtDescription'),note:v('debtNote')},'Data hutang/piutang tersimpan.');}
function editDebt(id){const d=app.debts.find(x=>x.id===id);if(!d)return;setv('debtId',d.id);setv('debtDirection',d.direction);setv('debtParty',d.party);setv('debtPrincipal',d.principal);setv('debtDue',d.dueDate);setv('debtAccount',d.accountId);setv('debtDescription',d.description);setv('debtNote',d.note);setText('debtFormTitle','Edit Hutang/Piutang');document.getElementById('debtCancel').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}
function resetDebtForm(){document.getElementById('debtForm').reset();setv('debtId','');setText('debtFormTitle','Hutang & Piutang');document.getElementById('debtCancel').classList.add('hidden');}
function removeDebt(id){if(confirm('Hapus data beserta riwayat pembayarannya? Transaksi kas yang sudah dibuat tidak ikut dihapus.'))callServer('deleteDebt',id,'Data dihapus.');}
function debtPaymentModal(id){const d=app.debts.find(x=>x.id===id);const options=app.accounts.filter(a=>a.active).map(a=>`<option value="${a.id}" ${a.id===d.accountId?'selected':''}>${esc(a.name)}</option>`).join('');openModal(`<h2>Catat Pembayaran</h2><p class="muted">${esc(d.direction)} · ${esc(d.party)} · sisa ${money(d.remaining)}</p><form onsubmit="submitDebtPayment(event,'${id}')" class="form-grid compact"><label>Tanggal<input id="modalDebtDate" type="date" value="${today()}" required></label><label>Nominal<input id="modalDebtAmount" type="number" min="1" max="${d.remaining}" required></label><label>Akun<select id="modalDebtAccount">${options}</select></label><label>Catatan<input id="modalDebtNote"></label><div class="form-actions span-2"><button class="primary" type="submit">Simpan Pembayaran</button></div></form><div class="hint-box top-gap">Pembayaran ini otomatis membuat transaksi ${d.direction==='Hutang'?'pengeluaran':'pemasukan'} agar saldo akun ikut berubah.</div>`);}
function submitDebtPayment(e,id){e.preventDefault();const data={debtId:id,date:v('modalDebtDate'),amount:Number(v('modalDebtAmount')),accountId:v('modalDebtAccount'),note:v('modalDebtNote')};closeModal();callServer('addDebtPayment',data,'Pembayaran dicatat.');}

function renderRecurring(){
  document.getElementById('recTable').innerHTML=app.recurring.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${typeBadge(r.type)}</td><td>${money(r.amount)}</td><td>${esc(r.frequency)}</td><td>${formatDate(r.nextDate)}</td><td>${r.active?'<span class="badge income">Aktif</span>':'<span class="badge expense">Selesai</span>'}</td><td><div class="row-actions"><button class="icon-btn" onclick="editRecurring('${r.id}')">Edit</button><button class="icon-btn danger" onclick="removeRecurring('${r.id}')">Hapus</button></div></td></tr>`).join('');
}
function submitRecurring(e){e.preventDefault();callServer('saveRecurring',{id:v('recId'),name:v('recName'),type:v('recType'),fromAccountId:v('recFrom'),toAccountId:v('recTo'),categoryId:v('recCategory'),amount:Number(v('recAmount')),frequency:v('recFrequency'),nextDate:v('recNext'),endDate:v('recEnd'),note:v('recNote')},'Transaksi berulang tersimpan.');}
function editRecurring(id){const r=app.recurring.find(x=>x.id===id);if(!r)return;setv('recId',r.id);setv('recName',r.name);setv('recType',r.type);syncRecurringForm();setv('recFrom',r.fromAccountId);setv('recTo',r.toAccountId);setv('recCategory',r.categoryId);setv('recAmount',r.amount);setv('recFrequency',r.frequency);setv('recNext',r.nextDate);setv('recEnd',r.endDate);setv('recNote',r.note);setText('recFormTitle','Edit Transaksi Berulang');document.getElementById('recCancel').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}
function resetRecurringForm(){document.getElementById('recurringForm').reset();setv('recId','');setText('recFormTitle','Transaksi Berulang');document.getElementById('recCancel').classList.add('hidden');setv('recNext',today());setv('recType','Pemasukan');syncRecurringForm();}
function removeRecurring(id){if(confirm('Hapus jadwal berulang ini? Transaksi yang sudah tercatat tetap aman.'))callServer('deleteRecurring',id,'Jadwal dihapus.');}
async function runRecurringNowUI(){busy(true);try{const d=await postAction('runRecurringNow',null);refreshFrom(d,'Transaksi berulang diproses.')}catch(err){fail(err)}}

function renderAccounts(){
  setText('accountTotal',money(app.accounts.filter(a=>a.active).reduce((s,a)=>s+a.balance,0)));document.getElementById('accountCards').innerHTML=app.accounts.map(a=>`<article class="mini-card"><div class="mini-card-head"><div><h3>${esc(a.name)}</h3><p>${esc(a.type)}${a.active?'':' · Diarsipkan'}</p></div></div><div class="big ${a.balance<0?'bad':''}">${money(a.balance)}</div><p>Saldo awal ${money(a.openingBalance)}</p><div class="mini-actions"><button class="secondary small" onclick="editAccount('${a.id}')">Edit</button>${a.active?`<button class="danger small" onclick="archiveAccountUI('${a.id}')">Arsipkan</button>`:''}</div></article>`).join('');
}
function submitAccount(e){e.preventDefault();callServer('saveAccount',{id:v('accountId'),name:v('accountName'),type:v('accountType'),openingBalance:Number(v('accountOpening'))},'Akun tersimpan.');}
function editAccount(id){const a=app.accounts.find(x=>x.id===id);if(!a)return;setv('accountId',a.id);setv('accountName',a.name);setv('accountType',a.type);setv('accountOpening',a.openingBalance);setText('accountFormTitle','Edit Akun');document.getElementById('accountCancel').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}
function resetAccountForm(){document.getElementById('accountForm').reset();setv('accountId','');setv('accountOpening',0);setText('accountFormTitle','Tambah Akun');document.getElementById('accountCancel').classList.add('hidden');}
function archiveAccountUI(id){if(confirm('Arsipkan akun? Histori transaksi tetap ada.'))callServer('archiveAccount',id,'Akun diarsipkan.');}

function renderCategories(){
  document.getElementById('categoryList').innerHTML=app.categories.map(c=>`<div class="stack-item"><div class="stack-main"><strong>${esc(c.name)}</strong><span>${esc(c.type)}${c.active?'':' · Diarsipkan'}</span></div><div class="row-actions"><button class="icon-btn" onclick="editCategory('${c.id}')">Edit</button>${c.active?`<button class="icon-btn danger" onclick="archiveCategoryUI('${c.id}')">Arsipkan</button>`:''}</div></div>`).join('');
}
function submitCategory(e){e.preventDefault();callServer('saveCategory',{id:v('categoryId'),type:v('categoryType'),name:v('categoryName')},'Kategori tersimpan.');}
function editCategory(id){const c=app.categories.find(x=>x.id===id);if(!c)return;setv('categoryId',c.id);setv('categoryType',c.type);setv('categoryName',c.name);document.getElementById('categoryCancel').classList.remove('hidden');}
function resetCategoryForm(){document.getElementById('categoryForm').reset();setv('categoryId','');document.getElementById('categoryCancel').classList.add('hidden');}
function archiveCategoryUI(id){if(confirm('Arsipkan kategori? Histori transaksi tetap ada.'))callServer('archiveCategory',id,'Kategori diarsipkan.');}
function submitSettings(e){e.preventDefault();callServer('saveSettings',{appName:v('settingAppName'),ownerName:v('settingOwnerName')},'Pengaturan tersimpan.');}

async function loadDatabaseInfo(){
  if(dbInfoCache){renderDbInfo();return}
  try{dbInfoCache=await apiFetch('/api/database');renderDbInfo()}catch(err){fail(err)}
}
function renderDbInfo(){if(!dbInfoCache)return;document.getElementById('dbInfo').textContent=`${dbInfoCache.name}\n${dbInfoCache.id}\nTimezone: ${dbInfoCache.timezone}`;}
async function openDatabase(){busy(true);try{dbInfoCache=await apiFetch('/api/database');busy(false);window.open(dbInfoCache.url,'_blank','noopener')}catch(err){fail(err)}}

async function postAction(action,data){
  return apiFetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
}

async function callServer(fn,data,message){
  if(serverBusy){toast('Masih memproses data sebelumnya.');return}
  serverBusy=true;toast('Menyimpan...');
  try{const d=await postAction(fn,data);refreshFrom(d,message);resetFormsAfterSave(fn)}catch(err){serverBusy=false;fail(err)}
}
function resetFormsAfterSave(fn){if(fn==='saveTransaction')resetTransactionForm();if(fn==='saveBudget')resetBudgetForm();if(fn==='saveGoal')resetGoalForm();if(fn==='saveDebt')resetDebtForm();if(fn==='saveRecurring')resetRecurringForm();if(fn==='saveAccount')resetAccountForm();if(fn==='saveCategory')resetCategoryForm();}
function fail(err){busy(false);toast((err&&err.message)||'Terjadi kesalahan.',true);console.error(err)}
function busy(on){document.getElementById('loading').classList.toggle('show',!!on)}
function toast(msg,error){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show'+(error?' error':'');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.className='toast',2600)}
function openModal(html){document.getElementById('modalContent').innerHTML=html;document.getElementById('modal').classList.remove('hidden')}
function closeModal(){document.getElementById('modal').classList.add('hidden');document.getElementById('modalContent').innerHTML=''}
function setDefaultDates(){const t=today();setv('txDate',t);setv('recNext',t);setv('txFilterMonth',t.slice(0,7));setv('reportMonth',t.slice(0,7));setv('budgetMonth',t.slice(0,7));}
function today(){const d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}-${m}-${day}`}
function v(id){const el=document.getElementById(id);return el?el.value:''}
function setv(id,val){const el=document.getElementById(id);if(el)el.value=val==null?'':val}
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val}
function money(n){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0))}
function signedMoney(tx){return (tx.type==='Pemasukan'?'+ ':tx.type==='Pengeluaran'?'- ':'')+money(tx.amount)}
function formatDate(s){if(!s)return '-';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
function monthLabel(s,short){if(!s)return '-';const [y,m]=s.split('-').map(Number);return new Intl.DateTimeFormat('id-ID',{month:short?'short':'long',year:short?undefined:'numeric'}).format(new Date(y,m-1,1))}
function typeBadge(type){const cls=type==='Pemasukan'?'income':type==='Pengeluaran'?'expense':'transfer';return `<span class="badge ${cls}">${esc(type)}</span>`}
function accountFlow(tx){if(tx.type==='Pemasukan')return tx.toAccountName;if(tx.type==='Pengeluaran')return tx.fromAccountName;return `${tx.fromAccountName} → ${tx.toAccountName}`}
function stackItem(title,sub,value){return `<div class="stack-item"><div class="stack-main"><strong>${esc(title)}</strong><span>${esc(sub||'')}</span></div><div class="stack-value">${esc(value||'')}</div></div>`}
function emptyHtml(text){return `<div class="empty">${esc(text)}</div>`}
function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
