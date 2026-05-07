'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { updateDisplayName, changePassword } from '@/lib/firebase/auth';
import { subscribeInventory, subscribeAllBorrows } from '@/lib/firebase/firestore';
import { InventoryItem, BorrowRequest, AdminHistory } from '@/lib/types/inventory';
import {
  collection, query, orderBy, onSnapshot, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import {
  SystemSettings, DEFAULT_SETTINGS, SETTINGS_KEY,
  loadSystemSettings, saveSystemSettings,
} from '@/lib/hooks/useSystemSettings';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  const sz = sm ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg className={`animate-spin ${sz}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

function Alert({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  const s = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700';
  const icon = type === 'success'
    ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
    : 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z';
  return (
    <div className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2.5 ${s}`}>
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d={icon} clipRule="evenodd"/>
      </svg>
      {msg}
    </div>
  );
}

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon}/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && <div className="px-6 pb-6 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── System Settings section ──────────────────────────────────────────────────

// ─── System Settings section ──────────────────────────────────────────────────

function SystemSettingsSection() {
  const [settings, setSettings]   = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    // Client-side only — safe from SSR crash
    setSettings(loadSystemSettings());
    setLoaded(true);
  }, []);

  function upd<K extends keyof SystemSettings>(key: K, val: SystemSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    saveSystemSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setSettings(DEFAULT_SETTINGS);
    saveSystemSettings(DEFAULT_SETTINGS);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!loaded) {
    return (
      <div className="pt-4 flex items-center gap-2 text-gray-400 text-sm">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-4">
      {saved && <Alert type="success" msg="Settings saved successfully." />}

      {/* Borrow defaults */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Borrow Defaults</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Return Period <span className="text-xs text-gray-400">(days)</span>
            </label>
            <input
              type="number" min={1} max={365}
              value={settings.defaultReturnDays}
              onChange={e => upd('defaultReturnDays', Math.max(1, parseInt(e.target.value) || 1))}
              className="input-base"
            />
            <p className="text-xs text-gray-400 mt-1">Pre-fills the return date field in Borrow tab.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overdue Threshold <span className="text-xs text-gray-400">(days past due)</span>
            </label>
            <input
              type="number" min={0} max={30}
              value={settings.overdueThresholdDays}
              onChange={e => upd('overdueThresholdDays', Math.max(0, parseInt(e.target.value) || 0))}
              className="input-base"
            />
            <p className="text-xs text-gray-400 mt-1">0 = flag immediately when past due date.</p>
          </div>
        </div>
      </div>

      {/* Dashboard alerts */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dashboard Alerts</p>
        <div className="space-y-3">
          {[
            { key: 'showOverdueAlerts' as const, label: 'Show Overdue Alerts', desc: 'Red banner on dashboard for overdue items' },
            { key: 'showNoDueDateAlerts' as const, label: 'Show No Due Date Alerts', desc: 'Yellow banner for borrows with no return date set' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <button
                type="button"
                onClick={() => upd(key, !settings[key])}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
                  ${settings[key] ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200
                  ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Table display */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Table Display</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Items Per Page</label>
          <select
            value={settings.itemsPerPage}
            onChange={e => upd('itemsPerPage', parseInt(e.target.value))}
            className="input-base bg-white w-40"
          >
            {[5, 8, 10, 15, 20, 25].map(n => (
              <option key={n} value={n}>{n} rows</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Applies to Inventory, Borrowed, Returned, and History tabs on next load.</p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} className="btn-primary px-6 py-2.5">Save Settings</button>
        <button onClick={handleReset} className="btn-secondary px-6 py-2.5">Reset to Defaults</button>
      </div>
    </div>
  );
}

// ─── Audit Log section ────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  add:    { bg: 'bg-green-100', text: 'text-green-700', icon: 'M12 4v16m8-8H4' },
  update: { bg: 'bg-blue-100',  text: 'text-blue-700',  icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  delete: { bg: 'bg-red-100',   text: 'text-red-700',   icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
};

function AuditLogSection() {
  const [logs, setLogs]     = useState<AdminHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'add' | 'update' | 'delete'>('all');

  useEffect(() => {
    const q = query(collection(db, 'adminHistory'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminHistory)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter);

  function fmtTs(ts: any): string {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="pt-4 space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'add', 'update', 'delete'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition
              ${filter === f
                ? f === 'all' ? 'bg-purple-700 text-white'
                  : f === 'add' ? 'bg-green-600 text-white'
                  : f === 'update' ? 'bg-blue-600 text-white'
                  : 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {f === 'all' ? 'All Actions' : f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">Last 100 actions</span>
      </div>

      {/* Log list */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
            <Spinner/><span className="text-sm">Loading audit log...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No audit entries found.</p>
        ) : filtered.map(log => {
          const style = ACTION_STYLES[log.action] || ACTION_STYLES.update;
          return (
            <div key={log.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
              <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <svg className={`w-3.5 h-3.5 ${style.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon}/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{log.details}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{log.adminName}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{fmtTs(log.timestamp)}</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${style.bg} ${style.text}`}>
                {log.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Data Export section ──────────────────────────────────────────────────────

function DataExportSection() {
  const [inventory, setInventory]   = useState<InventoryItem[]>([]);
  const [borrows, setBorrows]       = useState<BorrowRequest[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingBor, setLoadingBor] = useState(true);
  const [exporting, setExporting]   = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeInventory(d => { setInventory(d); setLoadingInv(false); });
    const u2 = subscribeAllBorrows(d => { setBorrows(d); setLoadingBor(false); });
    return () => { u1(); u2(); };
  }, []);

  function downloadCSV(filename: string, rows: string[][], headers: string[]) {
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    a.click();
  }

  async function exportInventory() {
    setExporting('inventory');
    try {
      downloadCSV(
        `inventory-export-${new Date().toISOString().split('T')[0]}.csv`,
        inventory.map(i => [
          i.name, i.category, i.isUnique ? 'Unique' : 'Bulk', String(i.quantity),
          i.condition, i.status, i.inventoryNumber, i.serialNumber,
          i.officeOwner, i.dateAcquired, i.inventoryDate, i.notes, i.borrowedBy || '',
        ]),
        ['Name','Category','Asset Type','Quantity','Condition','Status','Inventory No.',
         'Serial No.','Office Owner','Date Acquired','Inventory Date','Notes','Borrowed By'],
      );
    } finally { setExporting(null); }
  }

  async function exportBorrows(statusFilter?: 'Approved' | 'Returned') {
    const key = statusFilter?.toLowerCase() || 'all';
    setExporting(key);
    try {
      const data = statusFilter ? borrows.filter(b => b.status === statusFilter) : borrows;
      const fmtTs = (ts: any) => {
        if (!ts) return '';
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d.toISOString().split('T')[0];
      };
      downloadCSV(
        `borrows-${key}-${new Date().toISOString().split('T')[0]}.csv`,
        data.map(r => [
          r.borrowerName, r.borrowerDepartment, r.borrowerContact,
          r.items.map(i => i.itemName).join(' | '),
          r.items.map(i => i.inventoryNumber).join(' | '),
          r.borrowDate, r.returnDate || '', r.status,
          fmtTs(r.returnedAt), r.returnCondition || '', r.returnNotes || '', r.notes,
        ]),
        ['Borrower','Department','Contact','Items','Inventory Numbers',
         'Borrow Date','Return Date','Status','Returned At','Return Condition','Return Notes','Notes'],
      );
    } finally { setExporting(null); }
  }

  const loading = loadingInv || loadingBor;

  const exports = [
    {
      key: 'inventory',
      label: 'Full Inventory',
      desc: `${inventory.length} items`,
      color: 'purple',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      action: exportInventory,
    },
    {
      key: 'approved',
      label: 'Active Borrows',
      desc: `${borrows.filter(b => b.status === 'Approved').length} records`,
      color: 'blue',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      action: () => exportBorrows('Approved'),
    },
    {
      key: 'returned',
      label: 'Returned Records',
      desc: `${borrows.filter(b => b.status === 'Returned').length} records`,
      color: 'green',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => exportBorrows('Returned'),
    },
    {
      key: 'all',
      label: 'All Borrow History',
      desc: `${borrows.length} total records`,
      color: 'gray',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => exportBorrows(),
    },
  ];

  const colorMap: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    gray:   'bg-gray-100 text-gray-700',
  };

  return (
    <div className="pt-4">
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 py-6">
          <Spinner/><span className="text-sm">Loading data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {exports.map(exp => (
            <div key={exp.key} className="border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[exp.color]}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={exp.icon}/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{exp.label}</p>
                  <p className="text-xs text-gray-400">{exp.desc}</p>
                </div>
              </div>
              <button
                onClick={exp.action}
                disabled={!!exporting}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 text-sm font-medium text-gray-700 hover:text-purple-700 transition disabled:opacity-50"
              >
                {exporting === exp.key
                  ? <><Spinner sm/> Exporting...</>
                  : <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                      Export CSV
                    </>
                }
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3 text-center">CSV files open in Excel, Google Sheets, or any spreadsheet app.</p>
    </div>
  );
}

// ─── Account Security section ─────────────────────────────────────────────────

function AccountSecuritySection({ user }: { user: any }) {
  const [sessionStart] = useState(() => new Date());

  const lastSignIn = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  const accountCreated = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : '—';

  const sessionDuration = () => {
    const diff = Math.floor((new Date().getTime() - sessionStart.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const providers = user?.providerData?.map((p: any) => p.providerId) || [];
  const providerLabel = providers.includes('password') ? 'Email / Password' : providers.join(', ') || 'Unknown';

  const infoRows = [
    { label: 'Account Created',   value: accountCreated },
    { label: 'Last Sign-In',      value: lastSignIn },
    { label: 'Current Session',   value: sessionDuration() },
    { label: 'Auth Provider',     value: providerLabel },
    { label: 'User ID',           value: user?.uid || '—', mono: true },
    { label: 'Email Verified',    value: user?.emailVerified ? '✓ Verified' : '✗ Not verified',
      color: user?.emailVerified ? 'text-green-600' : 'text-red-600' },
  ];

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {infoRows.map(row => (
          <div key={row.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-500 mb-0.5">{row.label}</p>
            <p className={`text-sm font-medium break-all ${row.color || 'text-gray-800'} ${row.mono ? 'font-mono text-xs' : ''}`}>
              {row.value}
            </p>
          </div>
        ))}
      </div>

      {/* Security tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          Security Recommendations
        </p>
        <ul className="space-y-1.5 text-xs text-amber-700">
          <li>• Use a strong password (min. 12 characters with symbols)</li>
          <li>• Never share your admin credentials with others</li>
          <li>• Log out when leaving the system unattended</li>
          <li>• Change your password every 90 days</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Profile & Password (existing, unchanged logic) ───────────────────────────

function ProfileSection({ user }: { user: any }) {
  const displayName = user?.displayName || '';
  const email       = user?.email || '';
  const avatar      = (displayName || email || 'A').charAt(0).toUpperCase();

  const [nameVal, setNameVal]       = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [curPw, setCurPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [confPw, setConfPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameVal.trim()) return;
    setSavingName(true); setNameMsg(null);
    try {
      await updateDisplayName(nameVal.trim());
      setNameMsg({ type: 'success', text: 'Name updated successfully.' });
      setTimeout(() => setNameMsg(null), 4000);
    } catch {
      setNameMsg({ type: 'error', text: 'Failed to update name. Please try again.' });
    } finally { setSavingName(false); }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    if (newPw !== confPw)  { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setSavingPw(true);
    try {
      await changePassword(curPw, newPw);
      setCurPw(''); setNewPw(''); setConfPw('');
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setTimeout(() => setPwMsg(null), 4000);
    } catch (err: any) {
      const c = err?.code || '';
      if (c === 'auth/wrong-password' || c === 'auth/invalid-credential')
        setPwMsg({ type: 'error', text: 'Current password is incorrect.' });
      else if (c === 'auth/too-many-requests')
        setPwMsg({ type: 'error', text: 'Too many attempts. Please try again later.' });
      else
        setPwMsg({ type: 'error', text: 'Failed to change password. Please try again.' });
    } finally { setSavingPw(false); }
  }

  return (
    <>
      {/* Avatar + name banner */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div className="w-16 h-16 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0 shadow">
          <span className="text-white text-2xl font-bold">{avatar}</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{displayName || 'Admin'}</h2>
          <p className="text-sm text-gray-500">{email}</p>
          <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-0.5 rounded-full">
            Administrator
          </span>
        </div>
      </div>

      {/* Edit name */}
      <form onSubmit={handleSaveName} className="space-y-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Profile</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" value={nameVal} onChange={e => setNameVal(e.target.value)}
            placeholder="Your full name" className="input-base"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input type="email" value={email} disabled
            className="input-base bg-gray-50 text-gray-400 cursor-not-allowed"/>
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed here — update in Firebase console.</p>
        </div>
        {nameMsg && <Alert type={nameMsg.type} msg={nameMsg.text}/>}
        <button type="submit" disabled={savingName || !nameVal.trim()} className="btn-primary w-full py-2.5">
          {savingName ? <><Spinner/> Saving...</> : 'Save Name'}
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={handleChangePw} className="space-y-4 pt-6 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Password</p>
        {pwMsg && <Alert type={pwMsg.type} msg={pwMsg.text}/>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
          <input type="password" required value={curPw} onChange={e => setCurPw(e.target.value)}
            placeholder="••••••••" className="input-base"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input type="password" required value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="Min. 6 characters" className="input-base"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input type="password" required value={confPw} onChange={e => setConfPw(e.target.value)}
            placeholder="Repeat new password" className="input-base"/>
        </div>
        <button type="submit" disabled={savingPw} className="btn-primary w-full py-2.5">
          {savingPw ? <><Spinner/> Changing Password...</> : 'Change Password'}
        </button>
      </form>
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ProfileTab() {
  const { user } = useAuth();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">

      {/* Top two-column layout: Profile left, Security right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Profile & Password"
          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        >
          <ProfileSection user={user}/>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Account Security"
            icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            defaultOpen={true}
          >
            <AccountSecuritySection user={user}/>
          </SectionCard>

          <SectionCard
            title="System Settings"
            icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            defaultOpen={false}
          >
            <SystemSettingsSection/>
          </SectionCard>
        </div>
      </div>

      {/* Full-width bottom sections */}
      <SectionCard
        title="Data Export"
        icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        defaultOpen={false}
      >
        <DataExportSection/>
      </SectionCard>

      <SectionCard
        title="Audit Log"
        icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        defaultOpen={false}
      >
        <AuditLogSection/>
      </SectionCard>

    </div>
  );
}