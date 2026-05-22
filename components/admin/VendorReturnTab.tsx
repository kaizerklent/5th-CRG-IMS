'use client';
import { useState, useEffect, useMemo, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { InventoryItem, VendorReturn } from '@/lib/types/inventory';
import { subscribeVendorReturns, submitVendorReturn } from '@/lib/firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useSystemSettings } from '@/lib/hooks/useSystemSettings';
import { resolvePrimaryImage } from '@/lib/utils/Images';
import { exportVendorReturns } from '@/lib/utils/exportXLSX';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VendorReturnTabProps {
  items: InventoryItem[];
  loadingInventory: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n == null) return '—';
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTs(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

// ─── Multi-photo uploader (proof of return) ───────────────────────────────────

interface MultiProofUploaderProps {
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
}

function MultiProofUploader({ urls, onAdd, onRemove }: MultiProofUploaderProps) {
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
      const result = await uploadToCloudinary(file, 'receipts', pct => setProgress(pct));
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
      <label className="block text-sm font-medium text-gray-700">
        Proof of Return Photos
        <span className="text-xs text-gray-400 font-normal ml-1">(optional — multiple allowed)</span>
      </label>

      {/* Photo grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 ring-2 ring-orange-200">
              <img src={url} alt={`Proof ${i + 1}`} className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(url)}/>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <button type="button" onClick={() => setLightbox(url)}
                  className="p-1.5 bg-white rounded-lg hover:bg-gray-100 transition" title="View full size">
                  <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                <button type="button" onClick={() => onRemove(i)}
                  className="p-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition" title="Remove">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md font-medium pointer-events-none">
                #{i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {urls.length > 0 && (
        <p className="text-xs text-orange-700 flex items-center gap-1.5 font-medium">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          {urls.length} photo{urls.length !== 1 ? 's' : ''} uploaded
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
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer p-5
          ${dragOver
            ? 'border-orange-400 bg-orange-50'
            : uploading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-orange-200 bg-orange-50/40 hover:border-orange-400 hover:bg-orange-50'
          }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner/>
            <div className="w-full max-w-[180px] mx-auto">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }}/>
              </div>
              <p className="text-xs text-gray-500 text-center mt-1.5">Uploading {progress}%…</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${dragOver ? 'bg-orange-100' : 'bg-orange-100'}`}>
              <svg className={`w-5 h-5 ${dragOver ? 'text-orange-600' : 'text-orange-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                <span className="text-orange-600">Click to upload</span> or drag & drop
              </p>
              <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP — max 10 MB each · multiple allowed</p>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple className="hidden"
        onChange={onInputChange} disabled={uploading}/>

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
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-600 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
              <span className="text-sm font-semibold">Proof of Return Photo</span>
              <button onClick={() => setLightbox(null)}
                className="w-7 h-7 bg-orange-700 hover:bg-orange-800 rounded-lg flex items-center justify-center transition">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <img src={lightbox} alt="Proof of return"
              className="w-full max-h-[75vh] object-contain rounded-b-xl shadow-2xl bg-gray-900"/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Return Form Modal ────────────────────────────────────────────────────────

interface ReturnFormData {
  vendorName: string;
  vendorContact: string;
  vendorAddress: string;
  returnDate: string;
  reason: string;
  notes: string;
  proofPhotoUrls: string[];
}

const EMPTY_FORM: ReturnFormData = {
  vendorName: '', vendorContact: '', vendorAddress: '',
  returnDate: '', reason: '', notes: '', proofPhotoUrls: [],
};

function ReturnFormModal({ item, onClose, onConfirm }: {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (data: ReturnFormData) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<ReturnFormData>({ ...EMPTY_FORM, returnDate: today });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  function upd(k: keyof ReturnFormData, v: any) {
    setForm(p => ({ ...p, [k]: v }));
  }

  const canSubmit = form.vendorName.trim() && form.vendorContact.trim() &&
    form.vendorAddress.trim() && form.returnDate && form.reason.trim();

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      await onConfirm(form);
    } catch {
      setErr('Failed to process return. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true" aria-label="Process Vendor Return">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Process Vendor Return</h3>
            <p className="text-sm text-gray-500 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Item summary */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {resolvePrimaryImage(item)
                ? <img src={resolvePrimaryImage(item)!} alt={item.name} className="w-full h-full object-cover"/>
                : <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.inventoryNumber ? `${item.inventoryNumber} · ` : ''}{item.category}
              </p>
              <p className="text-sm font-semibold text-orange-700 mt-1">{fmt(item.value)}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <p className="text-xs text-amber-700">
              This will mark the item as <strong>"Returned to Vendor"</strong> in inventory.
              The item will remain in the system but will no longer appear as Available.
            </p>
          </div>

          {err && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>
          )}

          {/* Vendor details */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vendor / Supplier Details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.vendorName}
                  onChange={e => upd('vendorName', e.target.value)}
                  placeholder="e.g. Sony Philippines, Inc."
                  className="input-base"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-1">(phone or email)</span>
                </label>
                <input type="text" value={form.vendorContact}
                  onChange={e => upd('vendorContact', e.target.value)}
                  placeholder="e.g. 02-1234-5678 or vendor@example.com"
                  className="input-base"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea value={form.vendorAddress}
                  onChange={e => upd('vendorAddress', e.target.value)}
                  rows={2} placeholder="Full address of the vendor / store"
                  className="input-base resize-none"/>
              </div>
            </div>
          </div>

          {/* Return details */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Return Details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <input type="date" value={form.returnDate}
                  onChange={e => upd('returnDate', e.target.value)}
                  className="input-base"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea value={form.reason}
                  onChange={e => upd('reason', e.target.value)}
                  rows={3} placeholder="Why is this item being returned? e.g. Defective unit, warranty claim, upgrade replacement..."
                  className="input-base resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                  <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <textarea value={form.notes}
                  onChange={e => upd('notes', e.target.value)}
                  rows={2} placeholder="Any additional notes..."
                  className="input-base resize-none"/>
              </div>
            </div>
          </div>

          {/* Proof photos */}
          <MultiProofUploader
            urls={form.proofPhotoUrls}
            onAdd={url => upd('proofPhotoUrls', [...form.proofPhotoUrls, url])}
            onRemove={idx => upd('proofPhotoUrls', form.proofPhotoUrls.filter((_, i) => i !== idx))}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={busy} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={busy || !canSubmit}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {busy
              ? <><Spinner sm/> Processing...</>
              : <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                  </svg>
                  Confirm Return
                </>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Proof Photos Cell (in records table) ─────────────────────────────────────

function ProofPhotosCell({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox]   = useState<number | null>(null);
  const [idx, setIdx]             = useState(0);

  if (urls.length === 0) return <span className="text-gray-300 text-xs">—</span>;

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length); };

  return (
    <>
      <div className="flex flex-col items-start gap-1.5" style={{ minWidth: 80 }}>
        <div className="relative group w-14 h-14 flex-shrink-0">
          <button onClick={() => setLightbox(idx)}
            className="w-full h-full block rounded-xl overflow-hidden ring-2 ring-orange-200 hover:ring-orange-400 transition focus:outline-none"
            title="Click to view full size">
            <img src={urls[idx]} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover"/>
          </button>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center pointer-events-none z-10">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
            </svg>
          </span>
          {urls.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button onClick={next} className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7"/></svg>
              </button>
            </>
          )}
        </div>
        {urls.length > 1 && (
          <>
            <div className="flex items-center gap-1 justify-center w-14">
              {urls.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                  className={`rounded-full transition-all duration-200 flex-shrink-0 ${i === idx ? 'w-3 h-2 bg-orange-500' : 'w-2 h-2 bg-gray-300 hover:bg-orange-300'}`}/>
              ))}
            </div>
            <span className="text-xs text-gray-400 leading-none">{idx + 1}/{urls.length}</span>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-600 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
                <span className="text-sm font-semibold">Proof of Return</span>
                {urls.length > 1 && <span className="text-xs text-orange-200">{idx + 1} / {urls.length}</span>}
              </div>
              <button onClick={() => setLightbox(null)}
                className="w-7 h-7 bg-orange-700 hover:bg-orange-800 rounded-lg flex items-center justify-center transition">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="relative bg-gray-900 rounded-b-xl overflow-hidden">
              <img src={urls[idx]} alt={`Proof ${idx + 1}`} className="w-full max-h-[75vh] object-contain"/>
              {urls.length > 1 && (
                <>
                  <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                </>
              )}
            </div>
            {urls.length > 1 && (
              <div className="flex items-center gap-1.5 justify-center mt-3">
                {urls.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)}
                    className={`rounded-full transition-all duration-200 ${i === idx ? 'w-4 h-2.5 bg-orange-400' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'}`}/>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main VendorReturnTab ─────────────────────────────────────────────────────

type SubView = 'eligible' | 'records';

export default function VendorReturnTab({ items, loadingInventory }: VendorReturnTabProps) {
  const { user } = useAuth();
  const adminName = user?.displayName || user?.email || 'Admin';
  const settings  = useSystemSettings();
  const threshold = settings.vendorReturnThreshold;

  const [subView, setSubView]       = useState<SubView>('eligible');
  const [returns, setReturns]       = useState<VendorReturn[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [formItem, setFormItem]     = useState<InventoryItem | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  // Records filters
  const [search, setSearch]   = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]   = useState('');
  const [page, setPage]       = useState(1);
  const PER_PAGE = settings.itemsPerPage;

  useEffect(() => {
    const unsub = subscribeVendorReturns(data => {
      setReturns(data);
      setLoadingReturns(false);
    });
    return () => unsub();
  }, []);

  // Eligible items — value >= threshold AND not already returned to vendor
  const eligibleItems = useMemo(() =>
    items.filter(i =>
      i.value != null &&
      i.value >= threshold &&
      i.status !== 'Returned to Vendor'
    ).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    [items, threshold]
  );

  // Filtered records
  const filteredReturns = useMemo(() =>
    returns.filter(r => {
      const q = search.toLowerCase();
      const matchQ = !q ||
        r.itemName.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        r.inventoryNumber.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      const matchFrom = !fromDate || r.returnDate >= fromDate;
      const matchTo   = !toDate   || r.returnDate <= toDate;
      return matchQ && matchFrom && matchTo;
    }),
    [returns, search, fromDate, toDate]
  );

  const totalPages = Math.ceil(filteredReturns.length / PER_PAGE);
  const paginated  = filteredReturns.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasFilters = search || fromDate || toDate;

  async function handleConfirmReturn(data: ReturnFormData) {
    if (!formItem) return;
    await submitVendorReturn(formItem, data, adminName);
    setFormItem(null);
    setSuccess(`"${formItem.name}" has been successfully returned to ${data.vendorName}.`);
    setTimeout(() => setSuccess(null), 5000);
    setSubView('records');
  }

  return (
    <div className="w-full space-y-4">

      {/* ── Success banner ── */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm font-medium text-green-800">{success}</p>
        </div>
      )}

      {/* ── Sub-nav ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setSubView('eligible')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${subView === 'eligible' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            🏷️ Eligible Items
            {eligibleItems.length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {eligibleItems.length}
              </span>
            )}
          </button>
          <button onClick={() => setSubView('records')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${subView === 'records' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            📋 Return Records
            {returns.length > 0 && (
              <span className="ml-2 bg-gray-200 text-gray-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {returns.length}
              </span>
            )}
          </button>
        </div>

        {subView === 'records' && returns.length > 0 && (
          <button onClick={() => exportVendorReturns(filteredReturns.length > 0 ? filteredReturns : returns)}
            className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export to Excel
          </button>
        )}
      </div>

      {/* ════ ELIGIBLE ITEMS ════ */}
      {subView === 'eligible' && (
        <div className="space-y-4">

          {/* Threshold info banner */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p className="text-sm text-orange-800">
                Items valued <strong>{fmt(threshold)} and above</strong> are listed here for potential vendor return.
              </p>
            </div>
            <p className="text-xs text-orange-600 whitespace-nowrap flex-shrink-0">
              Change in Profile → System Settings
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Eligible Items
                <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {loadingInventory ? '…' : eligibleItems.length}
                </span>
              </h3>
              <p className="text-xs text-gray-400">Sorted by value — highest first</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Item', 'Category', 'Inventory No.', 'Value', 'Condition', 'Status', 'Action'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingInventory ? (
                    <tr><td colSpan={7} className="py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Spinner/><span className="text-sm">Loading inventory...</span>
                      </div>
                    </td></tr>
                  ) : eligibleItems.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">No eligible items</p>
                          <p className="text-xs text-gray-400 mt-1">
                            No items currently meet the return threshold of {fmt(threshold)}.
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Add a value to inventory items to see them here.
                          </p>
                        </div>
                      </div>
                    </td></tr>
                  ) : eligibleItems.map(item => {
                    const COND_COLOR: Record<string, string> = {
                      Good: 'bg-green-100 text-green-700', Fair: 'bg-yellow-100 text-yellow-700',
                      Damaged: 'bg-red-100 text-red-700', 'Under Repair': 'bg-orange-100 text-orange-700',
                    };
                    const primaryImg = resolvePrimaryImage(item);
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {primaryImg
                                ? <img src={primaryImg} alt={item.name} className="w-full h-full object-cover"/>
                                : <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                  </svg>
                              }
                            </div>
                            <p className="font-medium text-gray-800">{item.name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{item.category}</td>
                        <td className="px-5 py-4 text-gray-600 font-mono text-xs">{item.inventoryNumber || '—'}</td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-orange-700">{fmt(item.value)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${COND_COLOR[item.condition] || 'bg-gray-100 text-gray-700'}`}>
                            {item.condition}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={item.status === 'Available' ? 'badge-available' : 'badge-unavailable'}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setFormItem(item)}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                            </svg>
                            Process Return
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════ RETURN RECORDS ════ */}
      {subView === 'records' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="card px-5 py-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input type="text" placeholder="Item name, vendor, inventory no., reason..."
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="input-base"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="input-base w-auto"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} className="input-base w-auto"/>
              </div>
              {hasFilters && (
                <button onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setPage(1); }}
                  className="btn-secondary">Clear</button>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Return Records
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {loadingReturns ? '…' : `${filteredReturns.length} records`}
                </span>
                {hasFilters && filteredReturns.length !== returns.length && (
                  <span className="ml-1 text-xs text-gray-400 font-normal">of {returns.length} total</span>
                )}
              </h3>
              {filteredReturns.length > 0 && (
                <p className="text-xs text-gray-400">
                  Total value: <span className="font-semibold text-orange-700">
                    {fmt(filteredReturns.reduce((s, r) => s + (r.itemValue ?? 0), 0))}
                  </span>
                </p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Item', 'Inv. No.', 'Value', 'Vendor', 'Return Date', 'Reason', 'Proof', 'Processed By'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingReturns ? (
                    <tr><td colSpan={8} className="py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Spinner/><span className="text-sm">Loading records...</span>
                      </div>
                    </td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            {hasFilters ? 'No records match your filters.' : 'No vendor returns yet.'}
                          </p>
                          {!hasFilters && (
                            <p className="text-xs text-gray-400 mt-1">
                              Process a return from the Eligible Items tab to see records here.
                            </p>
                          )}
                        </div>
                      </div>
                    </td></tr>
                  ) : paginated.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-4 font-medium text-gray-800 whitespace-nowrap">{r.itemName}</td>
                      <td className="px-5 py-4 text-gray-600 font-mono text-xs">{r.inventoryNumber || '—'}</td>
                      <td className="px-5 py-4 font-semibold text-orange-700 whitespace-nowrap">{fmt(r.itemValue)}</td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{r.vendorName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{r.vendorContact}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{r.returnDate}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-[200px]">
                        <p className="truncate text-xs" title={r.reason}>{r.reason}</p>
                      </td>
                      <td className="px-5 py-4">
                        <ProofPhotosCell urls={r.proofPhotoUrls}/>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap text-xs">{r.adminName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredReturns.length)} of {filteredReturns.length}
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
      )}

      {/* ── Return Form Modal ── */}
      {formItem && (
        <ReturnFormModal
          item={formItem}
          onClose={() => setFormItem(null)}
          onConfirm={handleConfirmReturn}
        />
      )}
    </div>
  );
}