'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { subscribeAllBorrows, subscribeInventory } from '@/lib/firebase/firestore';
import { BorrowRequest, InventoryItem, TabId } from '@/lib/types/inventory';

function StatCard({ label, value, color, icon }: {
  label: string; value: number;
  color: 'purple'|'blue'|'red'|'yellow'|'green'; icon: React.ReactNode;
}) {
  const styles = {
    purple: { wrap: 'bg-purple-50 border-purple-200 text-purple-700', icon: 'bg-purple-100' },
    blue:   { wrap: 'bg-blue-50 border-blue-200 text-blue-700',       icon: 'bg-blue-100' },
    red:    { wrap: 'bg-red-50 border-red-200 text-red-700',           icon: 'bg-red-100' },
    yellow: { wrap: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: 'bg-yellow-100' },
    green:  { wrap: 'bg-green-50 border-green-200 text-green-700',    icon: 'bg-green-100' },
  };
  return (
    <div className={`rounded-xl border p-5 ${styles[color].wrap}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${styles[color].icon}`}>{icon}</div>
      </div>
    </div>
  );
}

// ── Helpers shared with sticker ─────────────────────────────────────────────

function formatDate(val: string): string {
  if (!val) return '—';
  const d = new Date(val + 'T00:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Property Sticker (inline, read-only) ────────────────────────────────────

function PropertySticker({ item }: { item: InventoryItem }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 280,
        background: '#1e56b0',
        borderRadius: 10,
        padding: '12px 14px 10px',
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        border: '2px solid #174496',
        margin: '0 auto',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05,
        backgroundImage: 'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 10px)',
      }}/>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.6 9h16.8M3.6 15h16.8" strokeLinecap="round" opacity="0.5"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 7, letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 1px' }}>
            5th Civil Relations Group
          </p>
          <p style={{ color: 'white', fontSize: 16, fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
            PROPERTY
          </p>
        </div>
        <div style={{ width: 30 }}/>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.3)', marginBottom: 8 }}/>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { label: 'Office:',         value: item.officeOwner },
          { label: 'Inventory Nr.:',  value: item.inventoryNumber },
          { label: 'Date Acquired:',  value: formatDate(item.dateAcquired) },
          { label: 'Inventory Date:', value: formatDate(item.inventoryDate) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              color: 'rgba(255,255,255,0.78)', fontSize: 8.5,
              textTransform: 'uppercase', letterSpacing: '0.6px',
              width: 94, flexShrink: 0,
            }}>
              {label}
            </span>
            <div style={{
              flex: 1, background: 'white', borderRadius: 3,
              padding: '2px 6px', minHeight: 18,
            }}>
              <span style={{
                color: value ? '#1a3870' : '#aab4c8',
                fontSize: 10, fontWeight: 600,
                fontFamily: label === 'Inventory Nr.:' ? 'monospace' : 'Arial, sans-serif',
              }}>
                {value || '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 6 }}>
        <p style={{
          color: 'rgba(255,255,255,0.5)', fontSize: 7,
          textAlign: 'center', textTransform: 'uppercase',
          letterSpacing: '0.9px', margin: 0,
        }}>
          Tampering of this sticker is punishable by law
        </p>
      </div>
    </div>
  );
}

// ── Expanded Borrowed Item Card ──────────────────────────────────────────────

function BorrowedItemCard({
  borrowedItem,
  inventoryItems,
}: {
  borrowedItem: { itemName: string; quantity?: number };
  inventoryItems: InventoryItem[];
}) {
  const [open, setOpen] = useState(false);

  // Match by name (adapt to id if available)
  const inv = inventoryItems.find(i => i.name === borrowedItem.itemName) ?? null;

  const COND_COLOR: Record<string, string> = {
    Good: 'bg-green-100 text-green-700',
    Fair: 'bg-yellow-100 text-yellow-700',
    Damaged: 'bg-red-100 text-red-700',
    'Under Repair': 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      {/* Row — always visible */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-100 transition text-left"
        aria-expanded={open}
      >
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {inv?.imageUrl
            ? <img src={inv.imageUrl} alt={inv.name} className="w-full h-full object-cover"/>
            : (
              <svg className="w-4 h-4 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            )
          }
        </div>

        {/* Name + qty */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{borrowedItem.itemName}</p>
          {borrowedItem.quantity && (
            <p className="text-xs text-gray-500">Qty: {borrowedItem.quantity}</p>
          )}
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-3 pb-4 pt-1 space-y-3 border-t border-gray-200">
          {!inv ? (
            <p className="text-xs text-gray-400 text-center py-2">Item details not found in inventory.</p>
          ) : (
            <>
              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Category',      value: inv.category },
                  { label: 'Asset Type',    value: inv.isUnique ? 'Unique Asset' : 'Bulk Item' },
                  { label: 'Condition',     value: inv.condition },
                  { label: 'Status',        value: inv.status },
                  { label: 'Inventory No.', value: inv.inventoryNumber || '—' },
                  { label: 'Serial No.',    value: inv.serialNumber || '—' },
                  { label: 'Office Owner',  value: inv.officeOwner || '—' },
                  { label: 'Date Acquired', value: formatDate(inv.dateAcquired) },
                ].map(f => (
                  <div key={f.label} className="bg-white rounded-lg px-2.5 py-2">
                    <p className="text-xs text-gray-500 mb-0.5">{f.label}</p>
                    <p className="text-xs font-medium text-gray-800">
                      {f.label === 'Condition'
                        ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COND_COLOR[inv.condition] || 'bg-gray-100 text-gray-700'}`}>{f.value}</span>
                        : f.label === 'Status'
                          ? <span className={inv.status === 'Available' ? 'badge-available' : 'badge-unavailable'}>{f.value}</span>
                          : f.value
                      }
                    </p>
                  </div>
                ))}
              </div>

              {inv.notes && (
                <div className="bg-white rounded-lg px-2.5 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                  <p className="text-xs text-gray-700">{inv.notes}</p>
                </div>
              )}

              {/* Property Sticker */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Property Sticker</p>
                <PropertySticker item={inv} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Borrower Detail Drawer ──────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function BorrowerDrawer({
  borrow,
  allBorrows,
  inventoryItems,
  today,
  onClose,
}: {
  borrow: BorrowRequest | null;
  allBorrows: BorrowRequest[];
  inventoryItems: InventoryItem[];
  today: string;
  onClose: () => void;
}) {
  if (!borrow) return null;

  const history  = allBorrows.filter(r => r.borrowerName === borrow.borrowerName);
  const active   = history.filter(r => r.status === 'Approved');
  const returned = history.filter(r => r.status === 'Returned');

  const isOverdue = borrow.status === 'Approved' && !!borrow.returnDate && borrow.returnDate < today;
  const daysOverdue = isOverdue
    ? Math.ceil((new Date(today).getTime() - new Date(borrow.returnDate!).getTime()) / 86400000)
    : 0;

  const returnedAt = borrow.returnedAt
    ? ((borrow.returnedAt as any)?.toDate?.() ?? new Date(borrow.returnedAt as any))
        .toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const avColor = avatarColor(borrow.borrowerName);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${borrow.borrowerName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${avColor}`}>
              {getInitials(borrow.borrowerName)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{borrow.borrowerName}</p>
              <p className="text-xs text-gray-500">{borrow.borrowerDepartment}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Overdue banner */}
          {isOverdue && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs font-semibold text-red-700">
                {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue — was due {borrow.returnDate}
              </p>
            </div>
          )}

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Active',   value: active.length,   color: 'text-blue-700 bg-blue-50' },
              { label: 'Returned', value: returned.length, color: 'text-green-700 bg-green-50' },
              { label: 'Total',    value: history.length,  color: 'text-purple-700 bg-purple-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs font-medium opacity-80 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Borrow info */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Borrow Date', value: borrow.borrowDate },
              { label: 'Return Date', value: borrow.returnDate || 'Not set', warn: !borrow.returnDate },
              { label: 'Status',      value: borrow.status },
              { label: 'Department',  value: borrow.borrowerDepartment },
              ...(returnedAt ? [{ label: 'Returned On', value: returnedAt }] : []),
            ].map(f => (
              <div key={f.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">{f.label}</p>
                <p className={`text-sm font-medium ${(f as any).warn ? 'text-yellow-600' : 'text-gray-800'}`}>
                  {f.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Borrowed Items ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Borrowed Items ({borrow.items.length})
            </p>
            <div className="space-y-2">
              {borrow.items.map((item, idx) => (
                <BorrowedItemCard
                  key={idx}
                  borrowedItem={item}
                  inventoryItems={inventoryItems}
                />
              ))}
            </div>
          </div>

          {/* Borrow history for this person */}
          {history.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                All Borrows by {borrow.borrowerName.split(' ')[0]}
              </p>
              <div className="space-y-2">
                {history.map(r => (
                  <div key={r.id} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2.5 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {r.items.map(i => i.itemName).join(', ')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.borrowDate}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      r.status === 'Returned'
                        ? 'bg-green-100 text-green-700'
                        : r.returnDate && r.returnDate < today
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.status === 'Approved' && r.returnDate && r.returnDate < today
                        ? 'Overdue'
                        : r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { user } = useAuth();
  const name = user?.displayName || user?.email || 'Admin';

  const [borrows, setBorrows] = useState<BorrowRequest[]>([]);
  const [items, setItems]     = useState<InventoryItem[]>([]);
  const [loadingBorrows, setLoadingBorrows] = useState(true);
  const [loadingItems, setLoadingItems]     = useState(true);
  const [activeBorrow, setActiveBorrow]     = useState<BorrowRequest | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    const unsubBorrows   = subscribeAllBorrows(data => { setBorrows(data);  setLoadingBorrows(false); });
    const unsubInventory = subscribeInventory(data  => { setItems(data);   setLoadingItems(false); });
    return () => { unsubBorrows(); unsubInventory(); };
  }, []);

  const approved      = borrows.filter(r => r.status === 'Approved');
  const overdue       = approved.filter(r => r.returnDate && r.returnDate < today);
  const noDueDate     = approved.filter(r => !r.returnDate);
  const returnedToday = borrows.filter(r => {
    if (r.status !== 'Returned' || !r.returnedAt) return false;
    const d = (r.returnedAt as any)?.toDate?.() ?? new Date(r.returnedAt as any);
    return d.toISOString().split('T')[0] === today;
  });

  const daysOverdue = (rd: string) =>
    Math.ceil((new Date(today).getTime() - new Date(rd).getTime()) / 86400000);

  const loading = loadingBorrows || loadingItems;

  const borrowerBtn = (r: BorrowRequest) => (
    <button
      onClick={() => setActiveBorrow(r)}
      className="font-medium text-purple-700 hover:underline text-left"
    >
      {r.borrowerName}
    </button>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span>Loading dashboard...</span>
    </div>
  );

  return (
    <>
      <div className={`space-y-6 max-w-6xl transition-all ${activeBorrow ? 'pr-[368px]' : ''}`}>

        {/* Welcome */}
        <div className="bg-purple-700 rounded-xl p-6 text-white">
          <p className="text-purple-200 text-sm font-medium">Welcome back,</p>
          <h2 className="text-2xl font-bold mt-1">{name} 👋</h2>
          <p className="text-purple-200 text-sm mt-1">Here's what's happening with your inventory today.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Total Items" value={items.length} color="purple"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}/>
          <StatCard label="Borrowed" value={approved.length} color="blue"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}/>
          <StatCard label="Overdue" value={overdue.length} color="red"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}/>
          <StatCard label="No Due Date" value={noDueDate.length} color="yellow"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}/>
          <StatCard label="Returned Today" value={returnedToday.length} color="green"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}/>
        </div>

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <h3 className="text-sm font-semibold text-red-800">Overdue ({overdue.length})</h3>
            </div>
            <div className="space-y-2">
              {overdue.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-red-100">
                  <span className="text-sm text-gray-800">
                    {borrowerBtn(r)} — {r.items.map(i => i.itemName).join(', ')}
                  </span>
                  <span className="text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {daysOverdue(r.returnDate!)} days overdue
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => onNavigate('borrowed')} className="mt-3 text-sm text-red-700 font-medium hover:underline">
              View all in Borrowed Items →
            </button>
          </div>
        )}

        {/* No due date alert */}
        {noDueDate.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <h3 className="text-sm font-semibold text-yellow-800">No Return Date Set ({noDueDate.length})</h3>
            </div>
            <div className="space-y-2">
              {noDueDate.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-yellow-100">
                  <span className="text-sm text-gray-800">
                    {borrowerBtn(r)} — {r.items.map(i => i.itemName).join(', ')}
                  </span>
                  <span className="text-xs text-yellow-700">Borrowed {r.borrowDate}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent borrows */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Recent Borrows</h3>
            <button onClick={() => onNavigate('history')} className="text-sm text-purple-700 font-medium hover:underline">View all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Borrower','Department','Items','Borrow Date','Return Date','Status'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {borrows.slice(0,5).length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-500 py-8 text-sm">No records yet.</td></tr>
                ) : borrows.slice(0,5).map(r => (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition ${activeBorrow?.id === r.id ? 'bg-purple-50' : ''}`}
                  >
                    <td className="px-6 py-4">{borrowerBtn(r)}</td>
                    <td className="px-6 py-4 text-gray-600">{r.borrowerDepartment}</td>
                    <td className="px-6 py-4 text-gray-600">{r.items.map(i => i.itemName).join(', ')}</td>
                    <td className="px-6 py-4 text-gray-600">{r.borrowDate}</td>
                    <td className="px-6 py-4">{r.returnDate || <span className="text-yellow-600 font-medium">Not set</span>}</td>
                    <td className="px-6 py-4"><span className={r.status === 'Returned' ? 'badge-returned' : 'badge-approved'}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Borrower Detail Drawer */}
      {activeBorrow && (
        <BorrowerDrawer
          borrow={activeBorrow}
          allBorrows={borrows}
          inventoryItems={items}
          today={today}
          onClose={() => setActiveBorrow(null)}
        />
      )}
    </>
  );
}