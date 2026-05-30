/* ─────────────────────────────────────────────────────────────────────────
   Vehicle Tab Prototype — 5CRG IMS  |  pol-tracker.js
   Sections: Vehicles · POL · Expenses · Reports
   Vanilla JS, no dependencies.
───────────────────────────────────────────────────────────────────────── */

const ic = {
  truck:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  plus:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  minus:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  drop:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
  warn:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  edit:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
  chevup:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  fuel:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 00-2-2H6a2 2 0 00-2 2v18"/><path d="M14 13h2a2 2 0 012 2v2a2 2 0 002 2h0a2 2 0 002-2V9.83a2 2 0 00-.59-1.42L18 5"/></svg>`,
  list:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  user:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  map:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
  user:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  map:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
};

// ── State ─────────────────────────────────────────────────────────────────
const S = {
  view: 'vehicles',
  expandedId: null,
  polVehicleId: 1,
  expVehicleId: null,
  usageVehicleId: null,
  usageModal: null,
  usageNextId: 200,

  vehicles: [
    { id:1, name:'L300 Van',     plate:'ABC 1234', type:'Van',   year:'2019', notes:'Main transport for outreach missions.' },
    { id:2, name:'Toyota Hilux', plate:'XYZ 5678', type:'Truck', year:'2021', notes:'Used for field operations and logistics.' },
    { id:3, name:'Ford Ranger',  plate:'DEF 9012', type:'Truck', year:'2020', notes:'Standby unit.' },
  ],

  usage: {
    1: [
      { id:101, vehicleId:1, driver:'Juan dela Cruz', date:'2025-05-28', destination:'Davao City', purpose:'Outreach mission',        mileage:120 },
      { id:102, vehicleId:1, driver:'Pedro Santos',   date:'2025-05-20', destination:'Tagum City',  purpose:'Supply delivery',         mileage:80  },
    ],
    2: [
      { id:103, vehicleId:2, driver:'Carlos Reyes',   date:'2025-05-25', destination:'Panabo City', purpose:'Field operation support', mileage:45  },
    ],
    3: [],
  },

  pol: {
    1: { Diesel:{ balance:170, allocation:300 }, Octane:{ balance:20, allocation:100 } },
    2: { Diesel:{ balance:285, allocation:300 } },
    3: {},
  },

  polHistory: {
    1: [
      { type:'add',      fuel:'Diesel', liters:300, note:'Monthly allocation — May 2025', date:'2025-05-01', balance:300 },
      { type:'add',      fuel:'Octane', liters:100, note:'Monthly allocation — May 2025', date:'2025-05-01', balance:100 },
      { type:'dispense', fuel:'Octane', liters:80,  note:'Driver trip to Tagum',          date:'2025-05-15', balance:20  },
      { type:'dispense', fuel:'Diesel', liters:130, note:'Mission to Davao City',          date:'2025-05-28', balance:170 },
    ],
    2: [
      { type:'add',      fuel:'Diesel', liters:300, note:'Monthly allocation — May 2025', date:'2025-05-01', balance:300 },
      { type:'dispense', fuel:'Diesel', liters:15,  note:'Test drive',                    date:'2025-05-20', balance:285 },
    ],
    3: [],
  },

  expenses: [
    { id:1, vehicleId:1, date:'2025-05-28', type:'Oil Change',    cost:1800, vendor:'Quick Lube Center'     },
    { id:2, vehicleId:1, date:'2025-05-10', type:'Tire Rotation', cost:500,  vendor:'Gomez Tire Shop'       },
    { id:3, vehicleId:2, date:'2025-05-22', type:'Battery',       cost:3200, vendor:'Motolite Dealer'       },
    { id:4, vehicleId:2, date:'2025-05-05', type:'Oil Change',    cost:2100, vendor:'Toyota Service Center' },
    { id:5, vehicleId:3, date:'2025-04-30', type:'Brake Pads',    cost:4500, vendor:'Ford Dealership'       },
    { id:6, vehicleId:1, date:'2025-04-18', type:'Coolant Flush', cost:900,  vendor:'Quick Lube Center'     },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────
const LOW_PCT = 20;
const fmt   = n => '₱' + n.toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2});
const fmtS  = n => { if(n>=1e6) return '₱'+(n/1e6).toFixed(1)+'M'; if(n>=1e3) return '₱'+(n/1e3).toFixed(1)+'k'; return fmt(n); };
const pct   = (b,a) => a>0 ? Math.round((b/a)*100) : 0;
const today = () => new Date().toISOString().split('T')[0];
const fmtDate = s => new Date(s+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});

function totalExpenses(vid) {
  return (vid ? S.expenses.filter(e=>e.vehicleId===vid) : S.expenses).reduce((s,e)=>s+e.cost,0);
}
function thisMonthExpenses(vid) {
  const m = today().slice(0,7);
  return (vid ? S.expenses.filter(e=>e.vehicleId===vid) : S.expenses).filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.cost,0);
}
function lastExpenseDate(vid) {
  const rows = S.expenses.filter(e=>e.vehicleId===vid).sort((a,b)=>b.date.localeCompare(a.date));
  return rows[0]?.date||null;
}
function hasLowFuel(vid) {
  return Object.values(S.pol[vid]||{}).some(f=>pct(f.balance,f.allocation)<=LOW_PCT);
}
function vname(id) { return S.vehicles.find(v=>v.id===id)?.name||''; }

// ── Nav ───────────────────────────────────────────────────────────────────
function goView(v, opts={}) {
  S.view = v;
  if (opts.vehicleId !== undefined) {
    if (v==='pol')      S.polVehicleId  = opts.vehicleId;
    if (v==='expenses') S.expVehicleId  = opts.vehicleId;
    if (v==='usage')    S.usageVehicleId = opts.vehicleId;
  }
  if (v!=='vehicles') S.expandedId = null;
  S.usageModal = null;
  render();
}
function toggleExpand(id) { S.expandedId = S.expandedId===id ? null : id; render(); }
function collapse()        { S.expandedId = null; render(); }

// ── Root render ───────────────────────────────────────────────────────────
function render() {
  document.getElementById('app-root').innerHTML = renderSubnav() + renderView();
}

function renderSubnav() {
  const tabs = [
    {id:'vehicles',label:'🚗 Vehicles'},
    {id:'pol',     label:'⛽ POL'},
    {id:'usage',   label:'🗺 Usage Log'},
    {id:'expenses',label:'📋 Expenses'},
    {id:'reports', label:'📊 Reports'},
  ];
  return `<div class="subnav">${tabs.map(t=>`
    <div class="subnav-tab${S.view===t.id?' active':''}" onclick="goView('${t.id}')">${t.label}</div>
  `).join('')}</div>`;
}

function renderView() {
  if (S.view==='vehicles') return renderVehicles();
  if (S.view==='pol')      return renderPOL();
  if (S.view==='usage')    return renderUsage();
  if (S.view==='expenses') return renderExpenses();
  if (S.view==='reports')  return renderReports();
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLES
// ═══════════════════════════════════════════════════════════════════════════
function renderVehicles() {
  let html = `
    <div class="toolbar">
      <div class="stat-chips" style="margin-bottom:0;display:flex;gap:8px">
        <div class="chip">Vehicles: <strong>${S.vehicles.length}</strong></div>
        <div class="chip">Total expenses: <strong>${fmtS(totalExpenses(null))}</strong></div>
        <div class="chip">This month: <strong>${fmtS(thisMonthExpenses(null))}</strong></div>
      </div>
      <button class="btn btn-primary" onclick="alert('Wire to Add Vehicle modal in real build')">${ic.plus} Add Vehicle</button>
    </div>
    <div class="vehicle-grid">
  `;
  S.vehicles.forEach(v => {
    html += S.expandedId===v.id ? renderExpandedCard(v) : renderCollapsedCard(v);
  });
  html += `</div>`;
  return html;
}

function renderCollapsedCard(v) {
  const low = hasLowFuel(v.id);
  const lastDate = lastExpenseDate(v.id);
  return `
    <div class="vcard" onclick="toggleExpand(${v.id})">
      <div class="vcard-collapsed">
        <div class="vcard-head">
          <div class="vcard-icon">${ic.truck}</div>
          <div>
            <div class="vcard-name">${v.name}</div>
            <div class="vcard-plate">${v.plate}</div>
          </div>
          <div class="vcard-badges">
            ${low?`<span class="badge badge-low">${ic.warn} Low fuel</span>`:''}
            <span class="badge badge-type">${v.type}</span>
          </div>
        </div>
        <div class="vcard-meta">
          <div class="vmeta-item"><div class="vmeta-label">Type</div><div class="vmeta-val">${v.type}</div></div>
          <div class="vmeta-item"><div class="vmeta-label">Year</div><div class="vmeta-val">${v.year}</div></div>
        </div>
        <div class="vcard-footer">
          <div class="vcard-expense">${fmtS(totalExpenses(v.id))}<span style="font-size:11px;font-weight:400;color:var(--gray-400);margin-left:4px">total expenses</span></div>
          <div class="vcard-last">${lastDate?'Last: '+fmtDate(lastDate):'No expenses yet'}</div>
        </div>
      </div>
    </div>
  `;
}

function renderExpandedCard(v) {
  const fuels    = S.pol[v.id]||{};
  const fuelKeys = Object.keys(fuels);
  const exp      = totalExpenses(v.id);
  const monthExp = thisMonthExpenses(v.id);
  const expCount = S.expenses.filter(e=>e.vehicleId===v.id).length;

  // Column 1 — Vehicle Info
  const infoCol = `
    <div class="exp-section">
      <div class="exp-section-title">Vehicle Info</div>
      <div class="detail-list">
        <div class="detail-row"><span class="detail-label">Name</span><span class="detail-val plain">${v.name}</span></div>
        <div class="detail-row"><span class="detail-label">Plate</span><span class="detail-val">${v.plate}</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-val plain">${v.type}</span></div>
        <div class="detail-row"><span class="detail-label">Year</span><span class="detail-val plain">${v.year}</span></div>

        ${v.notes?`<div class="detail-row" style="flex-direction:column;align-items:flex-start;gap:3px">
          <span class="detail-label">Notes</span>
          <span style="font-size:12px;color:var(--gray-600)">${v.notes}</span>
        </div>`:''}
      </div>
    </div>`;

  // Column 2 — POL
  let polCol = `<div class="exp-section"><div class="exp-section-title">POL — Fuel Allocation</div>`;
  if (fuelKeys.length===0) {
    polCol += `<p style="font-size:12px;color:var(--gray-400);font-style:italic">No fuel types set up for this vehicle.</p>`;
  } else {
    polCol += `<div class="pol-mini-grid">`;
    fuelKeys.forEach(k => {
      const f = fuels[k];
      const p = pct(f.balance,f.allocation);
      const low = p<=LOW_PCT;
      polCol += `
        <div class="pol-mini">
          <div class="pol-mini-top">
            <span class="pol-mini-fuel">${k}</span>
            <span class="pol-mini-pct${low?' low':''}">${p}%</span>
          </div>
          <div class="pol-mini-bal">${f.balance.toLocaleString()}<span style="font-size:12px;font-weight:400;color:var(--gray-400);margin-left:3px">L</span></div>
          <div class="pol-mini-alloc">of ${f.allocation.toLocaleString()} L</div>
          <div class="mini-bar"><div class="mini-bar-fill${low?' low':''}" style="width:${p}%"></div></div>
        </div>`;
    });
    polCol += `</div>`;
  }
  polCol += `</div>`;

  // Column 3 — Expenses
  const expCol = `
    <div class="exp-section">
      <div class="exp-section-title">Expenses Summary</div>
      <div class="exp-summary-grid">
        <div class="exp-sum-row"><span class="exp-sum-label">Total all-time</span><span class="exp-sum-val accent">${fmtS(exp)}</span></div>
        <div class="exp-sum-row"><span class="exp-sum-label">This month</span><span class="exp-sum-val">${fmtS(monthExp)}</span></div>
        <div class="exp-sum-row"><span class="exp-sum-label">Records</span><span class="exp-sum-val">${expCount}</span></div>
      </div>
    </div>`;

  return `
    <div class="vcard expanded">
      <div class="vcard-collapsed" style="cursor:default">
        <div class="vcard-head">
          <div class="vcard-icon">${ic.truck}</div>
          <div><div class="vcard-name">${v.name}</div><div class="vcard-plate">${v.plate}</div></div>
          <div class="vcard-badges">
            ${hasLowFuel(v.id)?`<span class="badge badge-low">${ic.warn} Low fuel</span>`:''}
            <span class="badge badge-type">${v.type} · ${v.year}</span>
          </div>
        </div>
      </div>

      <div class="vcard-expanded-body">
        <div class="expanded-grid">
          ${infoCol}${polCol}${expCol}
        </div>
      </div>

      <div class="vcard-actions">
        <button class="btn btn-secondary" onclick="event.stopPropagation();goView('expenses',{vehicleId:${v.id}})">
          ${ic.list} View Expenses
        </button>
        <button class="btn btn-secondary" onclick="event.stopPropagation();goView('pol',{vehicleId:${v.id}})">
          ${ic.fuel} View POL
        </button>
        <button class="btn btn-secondary" onclick="event.stopPropagation();openUsageModal(${v.id})">
          ${ic.user} Log Usage
        </button>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();alert('Edit — wire to modal in real build')">
          ${ic.edit} Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();alert('Delete — wire to confirm modal in real build')">
          ${ic.trash} Delete
        </button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();collapse()">
          ${ic.chevup} Collapse
        </button>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// POL
// ═══════════════════════════════════════════════════════════════════════════
function renderPOL() {
  const vid      = S.polVehicleId;
  const fuels    = S.pol[vid]||{};
  const hist     = S.polHistory[vid]||[];
  const fuelKeys = Object.keys(fuels);
  const lowFuels = fuelKeys.filter(k=>pct(fuels[k].balance,fuels[k].allocation)<=LOW_PCT);

  let html = `<div class="pol-view">`;

  // Vehicle switcher
  html += `<div class="pol-vehicle-select">`;
  S.vehicles.forEach(v => {
    html += `<button class="pveh-btn${vid===v.id?' active':''}" onclick="S.polVehicleId=${v.id};render()">${v.name}</button>`;
  });
  html += `</div>`;

  if (lowFuels.length>0) {
    html += `<div class="alert alert-warn">${ic.warn} ${lowFuels.join(' and ')} allocation is running low (below ${LOW_PCT}%)</div>`;
  }

  // Fuel balance cards
  html += `<p class="section-label">Current allocation — ${vname(vid)}</p>`;
  if (fuelKeys.length===0) {
    html += `<div class="empty-block">${ic.fuel}<p>No fuel types yet.</p><small>Add one below to start tracking.</small></div>`;
  } else {
    html += `<div class="pol-fuel-grid">`;
    fuelKeys.forEach(k => {
      const f = fuels[k];
      const p = pct(f.balance,f.allocation);
      const low = p<=LOW_PCT;
      html += `
        <div class="pol-fuel-card">
          <div class="pfc-head">
            <span class="pfc-badge">${k}</span>
            <span class="pfc-pct${low?' low':''}">${p}%</span>
          </div>
          <div class="pfc-balance">${f.balance.toLocaleString()}<span>L</span></div>
          <div class="pfc-alloc">of ${f.allocation.toLocaleString()} L allocated</div>
          <div class="pfc-bar-wrap"><div class="pfc-bar${low?' low':''}" style="width:${p}%"></div></div>
          <div class="pfc-actions">
            <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="setPolAction('${k}','dispense')">${ic.minus} Dispense</button>
            <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="setPolAction('${k}','add')">${ic.plus} Top up</button>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  // Action + manage
  html += `<p class="section-label">Actions</p><div class="pol-action-grid">`;

  // Dispense/topup card
  html += `<div class="pol-card"><div class="pol-card-title">Dispense or top up</div><div class="pol-card-desc">Record fuel used from allocation, or add a top-up.</div>`;
  if (fuelKeys.length===0) {
    html += `<p style="font-size:12px;color:var(--gray-400)">Add a fuel type first.</p>`;
  } else {
    html += `
      <div class="field"><label>Fuel type</label>
        <select id="tx-fuel">${fuelKeys.map(k=>`<option value="${k}">${k} — ${fuels[k].balance} L left</option>`).join('')}</select>
      </div>
      <div class="field field-row">
        <div><label>Liters</label><input type="number" id="tx-liters" min="1" placeholder="e.g. 50"/></div>
        <div><label>Action</label><select id="tx-type"><option value="dispense">Dispense</option><option value="add">Top up</option></select></div>
      </div>
      <div class="field"><label>Note <span style="font-weight:400;color:var(--gray-400)">(optional)</span></label>
        <textarea id="tx-note" rows="2" placeholder="e.g. Mission to Davao, Monthly refill…"></textarea>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="doPolTransaction()">
        ${ic.drop} Confirm
      </button>
      <div class="toast" id="tx-toast"></div>`;
  }
  html += `</div>`;

  // Manage fuel types card
  html += `<div class="pol-card"><div class="pol-card-title">Manage fuel types</div><div class="pol-card-desc">Add or remove fuel types for ${vname(vid)}.</div>`;
  if (fuelKeys.length>0) {
    html += `<div class="fuel-pill-list">${fuelKeys.map(k=>
      `<span class="fuel-pill">${k}<button class="pill-del" onclick="polRemoveFuel('${k}')">✕</button></span>`
    ).join('')}</div>`;
  }
  html += `
    <div class="field"><label>Fuel name</label><input type="text" id="nf-name" placeholder="e.g. Diesel, Octane, LPG…"/></div>
    <div class="field"><label>Starting allocation (liters)</label><input type="number" id="nf-liters" min="1" placeholder="e.g. 300"/></div>
    <button class="btn btn-secondary" style="width:100%;justify-content:center" onclick="polAddFuel()">${ic.plus} Add fuel type</button>
    <div class="toast" id="fuel-toast"></div>
  </div></div>`;

  // History
  html += `<p class="section-label">Transaction history</p><div class="history-wrap">`;
  if (hist.length===0) {
    html += `<div class="hist-empty">No transactions recorded yet.</div>`;
  } else {
    [...hist].reverse().forEach(h => {
      const isAdd = h.type==='add';
      html += `
        <div class="hist-row">
          <div class="hist-dot ${isAdd?'dot-add':'dot-disp'}">${isAdd?ic.plus:ic.minus}</div>
          <div class="hist-body">
            <div class="hist-main">${h.fuel} — ${isAdd?'Allocation added':'Fuel dispensed'}</div>
            <div class="hist-note">${h.note||'No note'}</div>
            <div class="hist-date">${fmtDate(h.date)}</div>
          </div>
          <div class="hist-right">
            <div class="hist-change ${isAdd?'add':'disp'}">${isAdd?'+':'−'}${h.liters} L</div>
            <div class="hist-bal">${h.balance} L remaining</div>
          </div>
        </div>`;
    });
  }
  html += `</div></div>`;
  return html;
}

function setPolAction(fuel, type) {
  render();
  setTimeout(()=>{
    const sf=document.getElementById('tx-fuel');
    const st=document.getElementById('tx-type');
    if(sf) sf.value=fuel;
    if(st) st.value=type;
  },0);
}

function doPolTransaction() {
  const fuel   = document.getElementById('tx-fuel')?.value;
  const liters = parseInt(document.getElementById('tx-liters')?.value)||0;
  const type   = document.getElementById('tx-type')?.value;
  const note   = document.getElementById('tx-note')?.value.trim()||'';
  const toast  = document.getElementById('tx-toast');
  if(!fuel) return;
  if(liters<=0){ showToast(toast,'Enter a valid number of liters.',true); return; }
  const f = S.pol[S.polVehicleId][fuel];
  if(type==='dispense'&&liters>f.balance){ showToast(toast,`Only ${f.balance} L available.`,true); return; }
  if(type==='dispense') f.balance-=liters;
  else { f.balance+=liters; f.allocation=Math.max(f.allocation,f.balance); }
  S.polHistory[S.polVehicleId].push({type,fuel,liters,note,date:today(),balance:f.balance});
  render();
}

function polAddFuel() {
  const name   = (document.getElementById('nf-name')?.value||'').trim();
  const liters = parseInt(document.getElementById('nf-liters')?.value)||0;
  const toast  = document.getElementById('fuel-toast');
  if(!name)   { showToast(toast,'Enter a fuel name.',true); return; }
  if(S.pol[S.polVehicleId][name]){ showToast(toast,`${name} already exists.`,true); return; }
  if(liters<=0){ showToast(toast,'Enter a starting allocation.',true); return; }
  S.pol[S.polVehicleId][name]={balance:liters,allocation:liters};
  S.polHistory[S.polVehicleId].push({type:'add',fuel:name,liters,note:'Initial allocation',date:today(),balance:liters});
  render();
}

function polRemoveFuel(name) {
  if(!confirm(`Remove "${name}" from this vehicle? This cannot be undone.`)) return;
  delete S.pol[S.polVehicleId][name];
  render();
}


// ═══════════════════════════════════════════════════════════════════════════
// USAGE LOG
// ═══════════════════════════════════════════════════════════════════════════
function renderUsage() {
  const vid   = S.usageVehicleId;
  const rows  = vid
    ? (S.usage[vid]||[])
    : S.vehicles.flatMap(v => (S.usage[v.id]||[]).map(u=>({...u})));
  const sorted = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  let html = ``;

  // Usage log modal
  if (S.usageModal) {
    const m   = S.usageModal;
    const f   = m.form;
    const title = m.mode==='add' ? 'Log Vehicle Usage' : 'Edit Usage Entry';
    html += `
      <div class="modal-overlay" onclick="S.usageModal=null;render()">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-head">
            <span class="modal-title">${title}</span>
            <button class="btn btn-ghost btn-sm" onclick="S.usageModal=null;render()">${ic.chevup}</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label>Vehicle <span class="req">*</span></label>
              <select id="um-vid" onchange="S.usageModal.form.vehicleId=parseInt(this.value)">
                ${S.vehicles.map(v=>`<option value="${v.id}"${f.vehicleId===v.id?' selected':''}>${v.name} — ${v.plate}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Driver Name <span class="req">*</span></label>
              <input type="text" id="um-driver" value="${f.driver}" placeholder="e.g. Juan dela Cruz" oninput="S.usageModal.form.driver=this.value"/>
            </div>
            <div class="field">
              <label>Date <span class="req">*</span></label>
              <input type="date" id="um-date" value="${f.date}" oninput="S.usageModal.form.date=this.value"/>
            </div>
            <div class="field">
              <label>Destination <span class="req">*</span></label>
              <input type="text" id="um-dest" value="${f.destination}" placeholder="e.g. Davao City" oninput="S.usageModal.form.destination=this.value"/>
            </div>
            <div class="field">
              <label>Purpose <span class="req">*</span></label>
              <input type="text" id="um-purpose" value="${f.purpose}" placeholder="e.g. Outreach mission, Supply delivery…" oninput="S.usageModal.form.purpose=this.value"/>
            </div>
            <div class="field">
              <label>Mileage <span style="font-weight:400;color:var(--gray-400)">(optional, km)</span></label>
              <input type="number" id="um-mileage" value="${f.mileage||''}" min="0" placeholder="e.g. 120" oninput="S.usageModal.form.mileage=this.value?parseInt(this.value):null"/>
            </div>
            <div class="toast" id="um-toast"></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-secondary" onclick="S.usageModal=null;render()">Cancel</button>
            <button class="btn btn-primary" onclick="saveUsage()">${m.mode==='add'?ic.plus+' Log Usage':ic.edit+' Save Changes'}</button>
          </div>
        </div>
      </div>`;
  }

  html += `
    <div class="toolbar">
      <div style="display:flex;gap:8px;align-items:center">
        <select onchange="S.usageVehicleId=this.value?parseInt(this.value):null;render()" style="font-size:13px;padding:8px 10px;border:1px solid var(--gray-200);border-radius:8px;background:var(--white);min-width:160px">
          <option value="">All Vehicles</option>
          ${S.vehicles.map(v=>`<option value="${v.id}"${S.usageVehicleId===v.id?' selected':''}>${v.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" onclick="openUsageModal(${vid||S.vehicles[0].id})">${ic.user} Log Usage</button>
    </div>
    <div class="exp-table-wrap">
      <div class="exp-table-head">
        <h3>Usage Log <span style="background:var(--gray-100);color:var(--gray-500);font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;margin-left:6px">${sorted.length}</span></h3>
      </div>
      <table><thead><tr>
        <th>Date</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Purpose</th><th>Mileage</th><th>Actions</th>
      </tr></thead><tbody>`;

  if (sorted.length===0) {
    html += `<tr class="empty-row"><td colspan="7">No usage records yet. Log a trip above.</td></tr>`;
  } else {
    sorted.forEach(u => {
      html += `
        <tr>
          <td>${fmtDate(u.date)}</td>
          <td class="td-name">${vname(u.vehicleId)}</td>
          <td>${u.driver}</td>
          <td>${u.destination}</td>
          <td style="color:var(--gray-500);font-size:12px">${u.purpose}</td>
          <td>${u.mileage!=null?u.mileage+' km':'—'}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" onclick="editUsage(${u.id})" title="Edit">${ic.edit}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteUsage(${u.id})" title="Delete">${ic.trash}</button>
            </div>
          </td>
        </tr>`;
    });
  }

  html += `</tbody></table></div>`;
  return html;
}

function openUsageModal(vid) {
  S.view = 'usage';
  S.usageModal = {
    mode: 'add',
    editId: null,
    form: { vehicleId: vid||S.vehicles[0].id, driver:'', date:today(), destination:'', purpose:'', mileage:null },
  };
  render();
}

function editUsage(id) {
  const all = S.vehicles.flatMap(v=>(S.usage[v.id]||[]));
  const u   = all.find(x=>x.id===id);
  if (!u) return;
  S.usageModal = {
    mode: 'edit',
    editId: id,
    form: { vehicleId:u.vehicleId, driver:u.driver, date:u.date, destination:u.destination, purpose:u.purpose, mileage:u.mileage },
  };
  render();
}

function saveUsage() {
  const f     = S.usageModal.form;
  const toast = document.getElementById('um-toast');
  if (!f.driver.trim())      { showToast(toast,'Enter a driver name.',true); return; }
  if (!f.date)               { showToast(toast,'Select a date.',true); return; }
  if (!f.destination.trim()) { showToast(toast,'Enter a destination.',true); return; }
  if (!f.purpose.trim())     { showToast(toast,'Enter a purpose.',true); return; }

  if (!S.usage[f.vehicleId]) S.usage[f.vehicleId] = [];

  if (S.usageModal.mode==='add') {
    S.usage[f.vehicleId].push({ id:S.usageNextId++, ...f });
  } else {
    const vid = f.vehicleId;
    // find and update — may have changed vehicle
    for (const v of S.vehicles) {
      const idx = (S.usage[v.id]||[]).findIndex(u=>u.id===S.usageModal.editId);
      if (idx!==-1) { S.usage[v.id].splice(idx,1); break; }
    }
    S.usage[vid].push({ id:S.usageModal.editId, ...f });
  }

  S.usageModal = null;
  render();
}

function deleteUsage(id) {
  if (!confirm('Delete this usage record? This cannot be undone.')) return;
  for (const v of S.vehicles) {
    const idx = (S.usage[v.id]||[]).findIndex(u=>u.id===id);
    if (idx!==-1) { S.usage[v.id].splice(idx,1); break; }
  }
  render();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════════════════════════════════
function renderExpenses() {
  const rows    = S.expVehicleId ? S.expenses.filter(e=>e.vehicleId===S.expVehicleId) : S.expenses;
  const sorted  = [...rows].sort((a,b)=>b.date.localeCompare(a.date));
  const total   = rows.reduce((s,e)=>s+e.cost,0);

  let html = `
    <div class="toolbar">
      <div style="display:flex;gap:8px;align-items:center">
        <select onchange="S.expVehicleId=this.value?parseInt(this.value):null;render()" style="font-size:13px;padding:8px 10px;border:1px solid var(--gray-200);border-radius:8px;background:var(--white);min-width:160px">
          <option value="">All Vehicles</option>
          ${S.vehicles.map(v=>`<option value="${v.id}"${S.expVehicleId===v.id?' selected':''}>${v.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" onclick="alert('Wire to Log Expense modal in real build')">${ic.plus} Log Expense</button>
    </div>
    <div class="exp-table-wrap">
      <div class="exp-table-head">
        <h3>Expense Log <span style="background:var(--gray-100);color:var(--gray-500);font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;margin-left:6px">${rows.length}</span></h3>
        <span class="exp-table-total">Total: ${fmt(total)}</span>
      </div>
      <table><thead><tr>
        <th>Date</th><th>Vehicle</th><th>Expense Type</th><th>Cost</th><th>Vendor</th>
      </tr></thead><tbody>`;

  if (sorted.length===0) {
    html += `<tr class="empty-row"><td colspan="5">No expense records found.</td></tr>`;
  } else {
    sorted.forEach(e => {
      html += `
        <tr>
          <td>${fmtDate(e.date)}</td>
          <td class="td-name">${vname(e.vehicleId)}</td>
          <td><span class="td-badge">${e.type}</span></td>
          <td class="td-cost">${fmt(e.cost)}</td>
          <td>${e.vendor||'—'}</td>
        </tr>`;
    });
  }

  html += `</tbody></table></div>`;
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════
function renderReports() {
  const grand = totalExpenses(null);
  const month = thisMonthExpenses(null);

  const byType = {};
  S.expenses.forEach(e=>{ byType[e.type]=(byType[e.type]||0)+e.cost; });
  const typeRows = Object.entries(byType).sort((a,b)=>b[1]-a[1]);

  const byVehicle = S.vehicles.map(v=>({name:v.name,total:totalExpenses(v.id)})).sort((a,b)=>b.total-a.total);

  return `
    <div class="report-stats">
      <div class="rstat"><div class="rstat-label">Grand Total</div><div class="rstat-val">${fmtS(grand)}</div><div class="rstat-sub">${S.expenses.length} records</div></div>
      <div class="rstat"><div class="rstat-label">This Month</div><div class="rstat-val">${fmtS(month)}</div><div class="rstat-sub">${today().slice(0,7)}</div></div>
      <div class="rstat"><div class="rstat-label">Vehicles</div><div class="rstat-val">${S.vehicles.length}</div><div class="rstat-sub">tracked</div></div>
    </div>
    <div class="report-charts">
      <div class="rchart">
        <div class="rchart-title">By Expense Type</div>
        ${typeRows.map(([type,val])=>{
          const p=grand>0?Math.round((val/grand)*100):0;
          return `<div class="bar-row"><div class="bar-row-head"><span>${type}</span><span>${fmtS(val)} (${p}%)</span></div><div class="bar-track"><div class="bar-fill-purple" style="width:${p}%"></div></div></div>`;
        }).join('')}
      </div>
      <div class="rchart">
        <div class="rchart-title">By Vehicle</div>
        ${byVehicle.map(({name,total})=>{
          const p=grand>0?Math.round((total/grand)*100):0;
          return `<div class="bar-row"><div class="bar-row-head"><span>${name}</span><span>${fmtS(total)} (${p}%)</span></div><div class="bar-track"><div class="bar-fill-purple" style="width:${p}%"></div></div></div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(el,msg,isErr=false) {
  if(!el) return;
  el.textContent=msg;
  el.className='toast'+(isErr?' err':'');
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.textContent='';},3000);
}

render();
