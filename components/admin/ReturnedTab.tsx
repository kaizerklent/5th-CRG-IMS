'use client';
import { useState, useEffect } from 'react';
import { BorrowRequest } from '@/lib/types/inventory';
import { subscribeReturnedBorrows } from '@/lib/firebase/firestore';
import { useSystemSettings } from '@/lib/hooks/useSystemSettings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tsToDate = (ts: any): Date =>
  ts?.toDate ? ts.toDate() : new Date(ts);

const fmtDate = (ts: any) => ts ? tsToDate(ts).toISOString().split('T')[0] : '—';

const monthLabel = (ts: any) => ts
  ? tsToDate(ts).toLocaleString('default', { month: 'long', year: 'numeric' })
  : '';

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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
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

// ─── Damage Photo Lightbox ────────────────────────────────────────────────────

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
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length]);

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-600 text-white px-4 py-3 rounded-t-xl flex items-center gap-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Damage Photo{urls.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-200 truncate">{itemNames}</p>
          </div>
          {urls.length > 1 && (
            <span className="text-xs text-red-200 font-medium flex-shrink-0">
              {idx + 1} / {urls.length}
            </span>
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

        {/* Dot indicators in lightbox footer */}
        {urls.length > 1 && (
          <div className="flex items-center gap-1.5 justify-center mt-3">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === idx ? 'w-4 h-2.5 bg-red-400' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Damage Photo Carousel Cell ───────────────────────────────────────
// Shows ONE photo at a time in the table cell — no crowding.
// Dot indicators + hover prev/next let user cycle through all photos inline.
// Clicking the photo opens the full lightbox.

function DamagePhotosCell({ req }: { req: BorrowRequest }) {
  const photos    = resolvePhotos(req);
  const itemNames = req.items.map(i => i.itemName).join(', ');
  const [idx, setIdx]           = useState(0);
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

        {/* Photo thumbnail with prev/next arrows on hover */}
        <div className="relative group w-16 h-16 flex-shrink-0">
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

          {/* Red damage badge */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center pointer-events-none z-10">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          </span>

          {/* Prev / Next arrows — appear on hover, only when multiple photos */}
          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={next}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10"
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

        {/* Count label */}
        {photos.length > 1 && (
          <span className="text-xs text-gray-400 leading-none">{idx + 1}/{photos.length} photos</span>
        )}
      </div>

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

// ─── Main ReturnedTab ─────────────────────────────────────────────────────────

export default function ReturnedTab() {
  const settings = useSystemSettings();
  const PER_PAGE = settings.itemsPerPage;
  const [all, setAll]           = useState<BorrowRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [monthFilter, setMonth] = useState('All');
  const [condFilter, setCond]   = useState<'All' | 'Good' | 'Fair' | 'Damaged'>('All');
  const [page, setPage]         = useState(1);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    return subscribeReturnedBorrows(data => { setAll(data); setLoading(false); });
  }, []);

  const months = ['All', ...Array.from(new Set(
    all.filter(r => r.returnedAt).map(r => monthLabel(r.returnedAt))
  ))];

  const filtered = all.filter(r => {
    const matchMonth = monthFilter === 'All' || (r.returnedAt && monthLabel(r.returnedAt) === monthFilter);
    const matchCond  = condFilter === 'All' || r.returnCondition === condFilter;
    return matchMonth && matchCond;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const damagedCount = all.filter(r => r.returnCondition === 'Damaged').length;

  function exportCSV() {
    const headers = ['Ref ID', 'Borrower', 'Department', 'Contact', 'Items', 'Inventory No.', 'Serial No.', 'Borrow Date', 'Due Date', 'Returned At', 'Condition', 'Notes', 'Photo Count'];
    const rows = filtered.map(r => [
      r.id, r.borrowerName, r.borrowerDepartment, r.borrowerContact,
      r.items.map(i => i.itemName).join('|'),
      r.items.map(i => i.inventoryNumber).join('|'),
      r.items.map(i => i.serialNumber).join('|'),
      r.borrowDate, r.returnDate || 'N/A', fmtDate(r.returnedAt),
      r.returnCondition || '', r.returnNotes || '',
      resolvePhotos(r).length,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `returned-${monthFilter.replace(/\s+/g, '-')}.csv`;
    a.click();
  }

  function toggleNotes(id: string) {
    setExpandedNotes(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  return (
    <div className="w-full space-y-4">

      {/* Damaged alert banner */}
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
            onClick={() => { setCond('Damaged'); setPage(1); }}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition flex-shrink-0"
          >
            Show Damaged Only
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-800 flex-1">
            Returned Items
            <span className="ml-2 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </h3>
          <select
            value={condFilter}
            onChange={e => { setCond(e.target.value as any); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All">All Conditions</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Damaged">Damaged</option>
          </select>
          <select
            value={monthFilter}
            onChange={e => { setMonth(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {months.map(m => <option key={m} value={m}>{m === 'All' ? 'All Months' : m}</option>)}
          </select>
          <button onClick={exportCSV} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Items', 'Borrower', 'Department', 'Contact', 'Due Date', 'Returned At', 'Condition', 'Notes', 'Damage Photos'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Spinner/><span className="text-sm">Loading...</span>
                  </div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-gray-500 py-12 text-sm">
                  No returned items found.
                </td></tr>
              ) : paginated.map(req => {
                const expanded = expandedNotes.has(req.id);
                const isDamaged = req.returnCondition === 'Damaged';
                return (
                  <tr
                    key={req.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition ${isDamaged ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-5 py-4 font-medium text-gray-800">
                      {req.items.map(i => i.itemName).join(', ')}
                    </td>
                    <td className="px-5 py-4 text-gray-800">{req.borrowerName}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerDepartment}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerContact}</td>
                    <td className="px-5 py-4 text-gray-600">{req.returnDate || '—'}</td>
                    <td className="px-5 py-4 text-gray-600">{fmtDate(req.returnedAt)}</td>
                    <td className="px-5 py-4">{condBadge(req.returnCondition)}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[180px]">
                      {req.returnNotes ? (
                        <div>
                          <p className={`text-sm ${!expanded ? 'truncate' : ''}`}>{req.returnNotes}</p>
                          {req.returnNotes.length > 60 && (
                            <button
                              onClick={() => toggleNotes(req.id)}
                              className="text-xs text-purple-600 hover:underline mt-0.5"
                            >
                              {expanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <DamagePhotosCell req={req}/>
                    </td>
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
                <button
                  key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p === page ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
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