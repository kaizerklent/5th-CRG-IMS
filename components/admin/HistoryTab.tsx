'use client';
import { useState, useEffect } from 'react';
import { BorrowRequest, AdminHistory } from '@/lib/types/inventory';
import { subscribeAllBorrows } from '@/lib/firebase/firestore';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { useSystemSettings } from '@/lib/hooks/useSystemSettings';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const condBadge = (c: string | null) => {
  if (!c) return <span className="text-gray-400">—</span>;
  const m: Record<string, string> = {
    Good: 'bg-green-100 text-green-700',
    Fair: 'bg-yellow-100 text-yellow-700',
    Damaged: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${m[c] || 'bg-gray-100 text-gray-700'}`}>
      {c}
    </span>
  );
};

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Resolve photo URLs (supports both old single + new array) ────────────────

function resolvePhotos(req: BorrowRequest): string[] {
  const multi = (req as any).damagePhotoUrls;
  if (Array.isArray(multi) && multi.length > 0) return multi;
  if (req.damagePhotoUrl) return [req.damagePhotoUrl];
  return [];
}

// ─── Damage Lightbox ──────────────────────────────────────────────────────────

interface LightboxProps {
  urls: string[];
  startIndex: number;
  itemNames: string;
  onClose: () => void;
}

function DamageLightbox({ urls, startIndex, itemNames, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(startIndex);

  function prev() { setIdx(i => (i - 1 + urls.length) % urls.length); }
  function next() { setIdx(i => (i + 1) % urls.length); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   prev();
      if (e.key === 'ArrowRight')  next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length]);

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-red-600 text-white px-4 py-3 rounded-t-xl flex items-center gap-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Damage Report Photo{urls.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-200 truncate">{itemNames}</p>
          </div>
          {urls.length > 1 && (
            <span className="text-xs text-red-200 font-medium flex-shrink-0">{idx + 1} / {urls.length}</span>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 bg-red-700 hover:bg-red-800 rounded-lg flex items-center justify-center transition flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Image */}
        <div className="relative bg-gray-900 rounded-b-xl overflow-hidden">
          <img
            src={urls[idx]}
            alt={`Damage photo ${idx + 1}`}
            className="w-full max-h-[72vh] object-contain"
          />
          {urls.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {urls.length > 1 && (
          <div className="flex gap-2 mt-3 justify-center flex-wrap">
            {urls.map((url, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 ring-2 transition ${
                  i === idx ? 'ring-red-400 opacity-100' : 'ring-transparent opacity-60 hover:opacity-90'
                }`}
              >
                <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover"/>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Damage Photo Carousel Cell ───────────────────────────────────────
// Shows one photo at a time in the table cell.
// Dot indicators + prev/next buttons navigate between photos without crowding.
// Clicking the photo opens the full lightbox.

function DamagePhotosCarousel({ req }: { req: BorrowRequest }) {
  const photos    = resolvePhotos(req);
  const itemNames = req.items.map(i => i.itemName).join(', ');
  const [idx, setIdx]         = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (photos.length === 0) return <span className="text-gray-300 text-xs">—</span>;

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx(i => (i - 1 + photos.length) % photos.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx(i => (i + 1) % photos.length);
  };

  return (
    <>
      <div className="flex flex-col items-start gap-1.5" style={{ minWidth: 80 }}>

        {/* Single photo + prev/next overlay */}
        <div className="relative group w-16 h-16 flex-shrink-0">
          {/* The photo */}
          <button
            onClick={() => setLightboxOpen(true)}
            className="w-full h-full block rounded-xl overflow-hidden ring-2 ring-red-200 hover:ring-red-400 transition focus:outline-none"
            title="Click to view full size"
          >
            <img
              src={photos[idx]}
              alt={`Damage ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </button>

          {/* Damage warning badge */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center pointer-events-none z-10">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          </span>

          {/* Prev / Next arrows — only shown when multiple photos */}
          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10"
                title="Previous photo"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={next}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10"
                title="Next photo"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div className="flex items-center gap-1 justify-center w-16">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setIdx(i); }}
                title={`Photo ${i + 1}`}
                className={`rounded-full transition-all duration-200 flex-shrink-0 ${
                  i === idx
                    ? 'w-3 h-2 bg-red-500'
                    : 'w-2 h-2 bg-gray-300 hover:bg-red-300'
                }`}
              />
            ))}
          </div>
        )}

        {/* Photo count label */}
        {photos.length > 1 && (
          <span className="text-xs text-gray-400 leading-none">
            {idx + 1}/{photos.length} photos
          </span>
        )}
      </div>

      {/* Full lightbox */}
      {lightboxOpen && (
        <DamageLightbox
          urls={photos}
          startIndex={idx}
          itemNames={itemNames}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

const ACTION_STYLES: Record<string, { badge: string; icon: string; iconPath: string }> = {
  add: {
    badge: 'bg-green-100 text-green-700',
    icon: 'text-green-600',
    iconPath: 'M12 4v16m8-8H4',
  },
  update: {
    badge: 'bg-blue-100 text-blue-700',
    icon: 'text-blue-600',
    iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  delete: {
    badge: 'bg-red-100 text-red-700',
    icon: 'text-red-600',
    iconPath: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  },
};

function fmtTs(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Inventory Activity Log Sub-tab ──────────────────────────────────────────

function InventoryActivityLog() {
  const settings = useSystemSettings();
  const PER_PAGE = settings.itemsPerPage;

  const [logs, setLogs] = useState<AdminHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<'all' | 'add' | 'update' | 'delete'>('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const q = query(collection(db, 'adminHistory'), orderBy('timestamp', 'desc'), limit(500));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminHistory)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = logs.filter(log => {
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      log.itemName?.toLowerCase().includes(q) ||
      log.details?.toLowerCase().includes(q) ||
      log.adminName?.toLowerCase().includes(q);

    // Date filter: compare log timestamp date string
    let matchFrom = true;
    let matchTo = true;
    if ((from || to) && log.timestamp) {
      const d = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp as any);
      const dateStr = d.toISOString().split('T')[0];
      if (from) matchFrom = dateStr >= from;
      if (to) matchTo = dateStr <= to;
    }

    return matchAction && matchSearch && matchFrom && matchTo;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasFilters = search || from || to || actionFilter !== 'all';

  function clear() {
    setSearch(''); setFrom(''); setTo(''); setActionFilter('all'); setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Item name, admin, details..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value as any); setPage(1); }}
              className="input-base bg-white w-auto"
            >
              <option value="all">All Actions</option>
              <option value="add">Added</option>
              <option value="update">Updated</option>
              <option value="delete">Deleted</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date" value={from}
              onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="input-base w-auto"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date" value={to}
              onChange={e => { setTo(e.target.value); setPage(1); }}
              className="input-base w-auto"
            />
          </div>
          {hasFilters && (
            <button onClick={clear} className="btn-secondary">Clear Filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            Inventory Activity Log
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {loading ? '…' : `${filtered.length} records`}
            </span>
          </h3>
          <div className="flex gap-2 text-xs">
            {(['add', 'update', 'delete'] as const).map(a => {
              const s = ACTION_STYLES[a];
              return (
                <span key={a} className={`px-2.5 py-0.5 rounded-full font-semibold capitalize ${s.badge}`}>
                  {a}
                </span>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Action', 'Item Name', 'Details', 'Performed By', 'Date & Time'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Spinner /><span className="text-sm">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-12 text-sm">
                    {hasFilters ? 'No records match your filters.' : 'No inventory activity yet.'}
                  </td>
                </tr>
              ) : paginated.map(log => {
                const style = ACTION_STYLES[log.action] || ACTION_STYLES.update;
                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          log.action === 'add' ? 'bg-green-100' : log.action === 'update' ? 'bg-blue-100' : 'bg-red-100'
                        }`}>
                          <svg className={`w-3.5 h-3.5 ${style.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.iconPath} />
                          </svg>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${style.badge}`}>
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-800 whitespace-nowrap">{log.itemName || '—'}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[260px]">
                      <p className="truncate text-xs">{log.details || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{log.adminName || '—'}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">{fmtTs(log.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p === page ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Borrow Logbook Sub-tab ───────────────────────────────────────────────────

function BorrowLogbook() {
  const settings = useSystemSettings();
  const PER_PAGE = settings.itemsPerPage;

  const [all, setAll] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'All' | 'Approved' | 'Returned'>('All');
  const [condFilter, setCondFilter] = useState<'All' | 'Good' | 'Fair' | 'Damaged'>('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    return subscribeAllBorrows(data => { setAll(data); setLoading(false); });
  }, []);

  const filtered = all.filter(r => {
    const q = search.toLowerCase();
    const matchCond = condFilter === 'All' || r.returnCondition === condFilter;
    return (
      (status === 'All' || r.status === status) &&
      matchCond &&
      (!from || r.borrowDate >= from) &&
      (!to || r.borrowDate <= to) &&
      (r.borrowerName.toLowerCase().includes(q) ||
        r.items.some(i => i.itemName.toLowerCase().includes(q)))
    );
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasFilters = search || from || to || status !== 'All' || condFilter !== 'All';
  const damagedCount = all.filter(r => r.returnCondition === 'Damaged').length;

  function clear() { setSearch(''); setFrom(''); setTo(''); setStatus('All'); setCondFilter('All'); setPage(1); }

  return (
    <div className="space-y-4">

      {/* Damaged items alert banner */}
      {damagedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">
                {damagedCount} item{damagedCount !== 1 ? 's' : ''} returned damaged
              </p>
              <p className="text-xs text-red-600 mt-0.5">These items are marked Unavailable in inventory until reviewed.</p>
            </div>
          </div>
          <button
            onClick={() => { setCondFilter('Damaged'); setStatus('Returned'); setPage(1); }}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition flex-shrink-0"
          >
            Show Damaged Only
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Borrower name or item name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value as any); setPage(1); }}
              className="input-base bg-white w-auto"
            >
              <option value="All">All</option>
              <option value="Approved">Approved</option>
              <option value="Returned">Returned</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Return Condition</label>
            <select
              value={condFilter}
              onChange={e => { setCondFilter(e.target.value as any); setPage(1); }}
              className="input-base bg-white w-auto"
            >
              <option value="All">All Conditions</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="input-base w-auto" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="input-base w-auto" />
          </div>
          {hasFilters && (
            <button onClick={clear} className="btn-secondary">Clear Filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            Borrow Logbook
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {loading ? '…' : `${filtered.length} records`}
            </span>
          </h3>
          {condFilter === 'Damaged' && (
            <span className="text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              Showing damaged items only
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Ref ID', 'Borrower', 'Department', 'Items', 'Borrow Date', 'Return Date', 'Status', 'Condition', 'Damage Photo'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Spinner /><span className="text-sm">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-500 py-12 text-sm">
                    {hasFilters ? 'No records match your filters.' : 'No borrow records yet.'}
                  </td>
                </tr>
              ) : paginated.map(r => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition ${r.returnCondition === 'Damaged' ? 'bg-red-50/40' : ''}`}
                >
                  <td className="px-5 py-4 font-mono text-xs text-gray-400">{r.id.slice(0, 8)}…</td>
                  <td className="px-5 py-4 font-medium text-gray-800 whitespace-nowrap">{r.borrowerName}</td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.borrowerDepartment}</td>
                  <td className="px-5 py-4 text-gray-600 max-w-[200px]">
                    <p className="truncate">{r.items.map(i => i.itemName).join(', ')}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.borrowDate}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {r.returnDate
                      ? <span className="text-gray-600">{r.returnDate}</span>
                      : <span className="text-yellow-600 font-medium">Not set</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={r.status === 'Returned' ? 'badge-returned' : 'badge-approved'}>{r.status}</span>
                  </td>
                  <td className="px-5 py-4">{condBadge(r.returnCondition)}</td>
                  <td className="px-5 py-4">
                    <DamagePhotosCarousel req={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p === page ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root HistoryTab ──────────────────────────────────────────────────────────

type SubTab = 'borrows' | 'inventory';

export default function HistoryTab() {
  const [subTab, setSubTab] = useState<SubTab>('borrows');

  return (
    <div className="w-full space-y-4">
      {/* Sub-nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab('borrows')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${subTab === 'borrows' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📋 Borrow Logbook
        </button>
        <button
          onClick={() => setSubTab('inventory')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${subTab === 'inventory' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🗂️ Inventory Activity
        </button>
      </div>

      {subTab === 'borrows' ? <BorrowLogbook /> : <InventoryActivityLog />}
    </div>
  );
}