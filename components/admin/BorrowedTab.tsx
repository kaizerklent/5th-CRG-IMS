'use client';
import { useState, useEffect, useMemo, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { BorrowRequest } from '@/lib/types/inventory';
import { subscribeActiveBorrows, markReturned } from '@/lib/firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useSystemSettings } from '@/lib/hooks/useSystemSettings';

const PER_PAGE = 8;

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

// ─── Multi-damage photo uploader ──────────────────────────────────────────────

interface MultiDamageUploaderProps {
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
}

function MultiDamageUploader({ urls, onAdd, onRemove }: MultiDamageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [lightbox, setLightbox]   = useState<string | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, 'damage', pct => setProgress(pct));
      onAdd(result.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [onAdd]);

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    // Upload one at a time sequentially to avoid rate limiting
    files.reduce((chain, f) => chain.then(() => handleFile(f)), Promise.resolve());
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    files.reduce((chain, f) => chain.then(() => handleFile(f)), Promise.resolve());
  }

  return (
    <div className="space-y-3">

      {/* Photo grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 ring-2 ring-red-200">
              <img
                src={url}
                alt={`Damage photo ${i + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(url)}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="p-1.5 bg-white rounded-lg hover:bg-gray-100 transition"
                  title="View full size"
                >
                  <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="p-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition"
                  title="Remove photo"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              {/* Photo number badge */}
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md font-medium">
                #{i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload count indicator */}
      {urls.length > 0 && (
        <p className="text-xs text-green-700 flex items-center gap-1.5 font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          {urls.length} photo{urls.length !== 1 ? 's' : ''} uploaded — tap to add more
        </p>
      )}

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer p-4
          ${dragOver
            ? 'border-red-400 bg-red-50'
            : uploading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-red-200 bg-red-50/50 hover:border-red-400 hover:bg-red-50'
          }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner/>
            <div className="w-full max-w-[160px] mx-auto">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-1.5">Uploading {progress}%…</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${dragOver ? 'bg-red-100' : 'bg-red-100'}`}>
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-700">
                <span className="underline">Click to add</span> or drag & drop
              </p>
              <p className="text-xs text-red-400">Multiple photos allowed · JPEG, PNG, WebP · max 10 MB each</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <span className="text-sm font-semibold">Damage Photo Preview</span>
                <span className="text-xs text-red-200">
                  ({urls.indexOf(lightbox) + 1} of {urls.length})
                </span>
              </div>
              <button
                onClick={() => setLightbox(null)}
                className="w-7 h-7 bg-red-700 hover:bg-red-800 rounded-lg flex items-center justify-center transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <img
              src={lightbox}
              alt="Damage photo full size"
              className="w-full max-h-[75vh] object-contain rounded-b-xl shadow-2xl bg-gray-900"
            />
            {/* Prev / Next nav if multiple */}
            {urls.length > 1 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none" style={{ top: 48 }}>
                <button
                  onClick={e => { e.stopPropagation(); const i = urls.indexOf(lightbox); setLightbox(urls[(i - 1 + urls.length) % urls.length]); }}
                  className="w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition pointer-events-auto"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); const i = urls.indexOf(lightbox); setLightbox(urls[(i + 1) % urls.length]); }}
                  className="w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition pointer-events-auto"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Return Modal ─────────────────────────────────────────────────────────────

function ReturnModal({ req, onClose, onConfirm }: {
  req: BorrowRequest;
  onClose: () => void;
  onConfirm: (cond: 'Good' | 'Fair' | 'Damaged', notes: string, photoUrls: string[]) => Promise<void>;
}) {
  const [cond, setCond]         = useState<'Good' | 'Fair' | 'Damaged'>('Good');
  const [notes, setNotes]       = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  // Clear photos when switching away from Damaged
  useEffect(() => {
    if (cond !== 'Damaged') setPhotoUrls([]);
  }, [cond]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">Mark as Returned</h3>
          <p className="text-sm text-gray-500 mt-1">
            {req.borrowerName} — {req.items.map(i => i.itemName).join(', ')}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {err && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>
          )}

          {/* Condition selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Return Condition</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Good', 'Fair', 'Damaged'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCond(c)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition
                    ${cond === c
                      ? c === 'Good'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : c === 'Fair'
                          ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                          : 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {c === 'Good' && '✓ '}
                  {c === 'Fair' && '~ '}
                  {c === 'Damaged' && '⚠ '}
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Damage photo upload — only shown when Damaged */}
          {cond === 'Damaged' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <p className="text-xs font-semibold text-red-700">
                  Item marked as Damaged — upload damage photo(s)
                </p>
              </div>

              <MultiDamageUploader
                urls={photoUrls}
                onAdd={url => setPhotoUrls(prev => [...prev, url])}
                onRemove={idx => setPhotoUrls(prev => prev.filter((_, i) => i !== idx))}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about the return..."
              className="input-base resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={busy} className="btn-secondary flex-1">Cancel</button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true); setErr(null);
              try { await onConfirm(cond, notes, photoUrls); }
              catch { setErr('Failed. Please try again.'); setBusy(false); }
            }}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {busy ? <><Spinner sm/>Saving...</> : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BorrowedTab ──────────────────────────────────────────────────────────────

export default function BorrowedTab() {
  const settings = useSystemSettings();
  const PER_PAGE = settings.itemsPerPage;

  const [requests, setRequests]   = useState<BorrowRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [returning, setReturning] = useState<BorrowRequest | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const flag = (rd: string | null) => {
    if (!rd) return 'no-date';
    // Apply grace period threshold before flagging as overdue
    const due = new Date(rd);
    due.setDate(due.getDate() + settings.overdueThresholdDays);
    return due < new Date(today) ? 'overdue' : 'normal';
  };

  const daysOver = (rd: string) =>
    Math.ceil((new Date(today).getTime() - new Date(rd).getTime()) / 86400000);

  useEffect(() => {
    return subscribeActiveBorrows(data => { setRequests(data); setLoading(false); });
  }, []);

  const totalPages = Math.ceil(requests.length / PER_PAGE);
  const paginated  = requests.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="w-full">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            Currently Borrowed
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {requests.length}
            </span>
          </h3>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-300 inline-block"/>Overdue
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-300 inline-block"/>No due date
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Borrower','Department','Contact','Items','Borrow Date','Return Date','Action'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Spinner/><span className="text-sm">Loading...</span>
                  </div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-500 py-12 text-sm">
                  No items currently borrowed.
                </td></tr>
              ) : paginated.map(req => {
                const f = flag(req.returnDate);
                return (
                  <tr key={req.id} className={`border-b border-gray-50 ${f === 'overdue' ? 'row-overdue' : f === 'no-date' ? 'row-no-date' : ''}`}>
                    <td className="px-5 py-4 font-medium text-gray-800">{req.borrowerName}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerDepartment}</td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowerContact}</td>
                    <td className="px-5 py-4 text-gray-600">
                      {req.items.map(i => `${i.itemName}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ')}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{req.borrowDate}</td>
                    <td className="px-5 py-4">
                      {f === 'overdue' ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-red-600 font-medium">{req.returnDate}</span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                            ⚠️ {daysOver(req.returnDate!)}d overdue
                          </span>
                        </div>
                      ) : f === 'no-date'
                        ? <span className="text-yellow-600 font-medium">Not set</span>
                        : <span className="text-gray-600">{req.returnDate}</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setReturning(req)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap"
                      >
                        Mark Returned
                      </button>
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
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, requests.length)} of {requests.length}
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

      {returning && (
        <ReturnModal
          req={returning}
          onClose={() => setReturning(null)}
          onConfirm={async (cond, notes, photoUrls) => {
            await markReturned(returning, cond, notes, photoUrls);
            setReturning(null);
          }}
        />
      )}
    </div>
  );
}