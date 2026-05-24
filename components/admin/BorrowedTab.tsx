'use client';
import { useState, useEffect, useMemo, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { BorrowRequest, InventoryItem } from '@/lib/types/inventory';
import { markReturned, ReturnVerification, subscribeInventory } from '@/lib/firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useSystemSettings } from '@/lib/hooks/useSystemSettings';
import { resolvePrimaryImage } from '@/lib/utils/Images';

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
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 ring-2 ring-red-200">
              <img src={url} alt={`Damage photo ${i + 1}`} className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(url)}/>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <button type="button" onClick={() => setLightbox(url)}
                  className="p-1.5 bg-white rounded-lg hover:bg-gray-100 transition" title="View full size">
                  <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                <button type="button" onClick={() => onRemove(i)}
                  className="p-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition" title="Remove photo">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md font-medium">
                #{i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {urls.length > 0 && (
        <p className="text-xs text-green-700 flex items-center gap-1.5 font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          {urls.length} photo{urls.length !== 1 ? 's' : ''} uploaded — tap to add more
        </p>
      )}

      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer p-4
          ${dragOver ? 'border-red-400 bg-red-50'
            : uploading ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
            : 'border-red-200 bg-red-50/50 hover:border-red-400 hover:bg-red-50'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner/>
            <div className="w-full max-w-[160px] mx-auto">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }}/>
              </div>
              <p className="text-xs text-gray-500 text-center mt-1.5">Uploading {progress}%…</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
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
              <p className="text-xs text-red-400">Multiple photos · JPEG, PNG, WebP · max 10 MB each</p>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple className="hidden" onChange={onInputChange} disabled={uploading}/>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
              <span className="text-sm font-semibold">Damage Photo Preview</span>
              <button onClick={() => setLightbox(null)}
                className="w-7 h-7 bg-red-700 hover:bg-red-800 rounded-lg flex items-center justify-center transition">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <img src={lightbox} alt="Damage photo"
              className="w-full max-h-[75vh] object-contain rounded-b-xl shadow-2xl bg-gray-900"/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Verification photo uploader (Step 1) ────────────────────────────────────

function VerifyPhotoUploader({
  urls, onAdd, onRemove,
}: {
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null); setUploading(true); setProgress(0);
    try {
      const result = await uploadToCloudinary(file, 'damage', pct => setProgress(pct));
      onAdd(result.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed.');
    } finally { setUploading(false); setProgress(0); }
  }, [onAdd]);

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.reduce((chain, f) => chain.then(() => handleFile(f)), Promise.resolve());
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files || [])
      .reduce((chain, f) => chain.then(() => handleFile(f)), Promise.resolve());
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Photo of Returned Item
        <span className="text-gray-400 font-normal normal-case ml-1">(optional — stored as proof)</span>
      </label>

      {urls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {urls.map((url, i) => (
            <div key={i} className="relative group w-16 h-16 rounded-xl overflow-hidden bg-gray-100 ring-2 ring-blue-200 flex-shrink-0">
              <img src={url} alt={`Verify ${i + 1}`} className="w-full h-full object-cover"/>
              <button type="button" onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-3 transition cursor-pointer
          ${dragOver ? 'border-blue-400 bg-blue-50'
            : uploading ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
            : 'border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:bg-blue-50'}`}
      >
        {uploading ? (
          <div className="flex items-center gap-3">
            <Spinner/>
            <div className="flex-1">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }}/>
              </div>
              <p className="text-xs text-gray-500 mt-1">Uploading {progress}%…</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 flex-shrink-0 ${dragOver ? 'text-blue-500' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p className="text-xs text-blue-700">
              <span className="underline font-medium">Click to upload</span> or drag & drop
              <span className="text-blue-400 ml-1">· multiple allowed</span>
            </p>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple className="hidden" onChange={onInputChange} disabled={uploading}/>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2">
      {/* Step 1 */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition
        ${step === 1 ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-700'}`}>
        {step === 1
          ? <span>1</span>
          : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
        }
        <span>Verify Item</span>
      </div>

      {/* Connector */}
      <div className={`h-0.5 w-6 rounded-full transition ${step === 2 ? 'bg-green-400' : 'bg-gray-200'}`}/>

      {/* Step 2 */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition
        ${step === 2 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
        <span>2</span>
        <span>Return Details</span>
      </div>
    </div>
  );
}

// ─── Return Modal ─────────────────────────────────────────────────────────────

function ReturnModal({ req, inventoryItems, onClose, onConfirm }: {
  req: BorrowRequest;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onConfirm: (
    cond: 'Good' | 'Fair' | 'Damaged',
    notes: string,
    photoUrls: string[],
    verification: ReturnVerification
  ) => Promise<void>;
}) {
  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [serialInputs, setSerialInputs] = useState<Record<string, string>>({});
  const [serialResults, setSerialResults] = useState<Record<string, 'match' | 'mismatch' | 'empty' | 'no-serial'>>({});
  const [checklist, setChecklist] = useState({ name: false, invNo: false, inspected: false });
  const [verifyPhotoUrls, setVerifyPhotoUrls] = useState<string[]>([]);

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [cond, setCond]           = useState<'Good' | 'Fair' | 'Damaged'>('Good');
  const [notes, setNotes]         = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  // Clear damage photos when switching away from Damaged
  useEffect(() => {
    if (cond !== 'Damaged') setPhotoUrls([]);
  }, [cond]);

  // ── Initialise serial result states ──────────────────────────────────────
  useEffect(() => {
    const initial: Record<string, 'match' | 'mismatch' | 'empty' | 'no-serial'> = {};
    req.items.forEach(bi => {
      initial[bi.itemId] = bi.serialNumber ? 'empty' : 'no-serial';
    });
    setSerialResults(initial);
  }, [req.items]);

  // ── Serial input handler ──────────────────────────────────────────────────
  function handleSerialInput(itemId: string, storedSerial: string, input: string) {
    setSerialInputs(prev => ({ ...prev, [itemId]: input }));
    if (!input.trim()) {
      setSerialResults(prev => ({ ...prev, [itemId]: 'empty' }));
    } else if (input.trim().toLowerCase() === storedSerial.trim().toLowerCase()) {
      setSerialResults(prev => ({ ...prev, [itemId]: 'match' }));
    } else {
      setSerialResults(prev => ({ ...prev, [itemId]: 'mismatch' }));
    }
  }

  // ── Can proceed to Step 2 ─────────────────────────────────────────────────
  const allVerified = useMemo(() => {
    return req.items.every(bi => {
      if (bi.serialNumber) {
        return serialResults[bi.itemId] === 'match';
      } else {
        return checklist.name && checklist.invNo && checklist.inspected;
      }
    });
  }, [req.items, serialResults, checklist]);

  // ── Determine if ANY item has a serial number ────────────────────────────
  const hasAnySerial = req.items.some(bi => !!bi.serialNumber);
  const hasAnyNoSerial = req.items.some(bi => !bi.serialNumber);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setBusy(true); setErr(null);
    try {
      const verification: ReturnVerification = {
        verificationPhotoUrls: verifyPhotoUrls,
        verifiedSerialNumbers: Object.entries(serialInputs)
          .filter(([id]) => serialResults[id] === 'match')
          .map(([, val]) => val.trim()),
        verificationChecklist: hasAnyNoSerial
          ? (checklist.name && checklist.invNo && checklist.inspected)
          : false,
      };
      await onConfirm(cond, notes, photoUrls, verification);
    } catch {
      setErr('Failed. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className={`px-6 py-5 border-b border-gray-100 flex-shrink-0 ${step === 1 ? 'bg-blue-50' : 'bg-green-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">Mark as Returned</h3>
            <button onClick={onClose} disabled={busy}
              className="p-1.5 hover:bg-white/70 rounded-lg transition">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <StepIndicator step={step}/>
          <p className="text-xs text-gray-500 mt-2">
            {req.borrowerName} — {req.items.map(i => i.itemName).join(', ')}
          </p>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ════ STEP 1 — VERIFY ITEM ════ */}
          {step === 1 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                <p className="text-xs text-blue-700">
                  Physically inspect the item being returned and verify it matches the borrow record below.
                  {hasAnySerial && <> Type the serial number exactly as it appears on the item.</>}
                </p>
              </div>

              {/* Per-item verification */}
              {req.items.map(bi => {
                const inv = inventoryItems.find(i => i.id === bi.itemId);
                const primaryImg = inv ? resolvePrimaryImage(inv) : null;
                const result = serialResults[bi.itemId];

                return (
                  <div key={bi.itemId} className="border border-gray-200 rounded-xl overflow-hidden">

                    {/* Item header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {primaryImg
                          ? <img src={primaryImg} alt={bi.itemName} className="w-full h-full object-cover"/>
                          : <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{bi.itemName}</p>
                        <p className="text-xs text-gray-500">
                          {bi.inventoryNumber ? `Inv: ${bi.inventoryNumber}` : 'No inventory number'}
                          {bi.quantity > 1 && ` · Qty: ${bi.quantity}`}
                        </p>
                      </div>
                      {/* Verified badge */}
                      {result === 'match' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                          Verified
                        </span>
                      )}
                      {result === 'no-serial' && checklist.name && checklist.invNo && checklist.inspected && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                          Checklist Done
                        </span>
                      )}
                    </div>

                    <div className="px-4 py-4 space-y-3">
                      {/* Serial number path */}
                      {bi.serialNumber ? (
                        <div className="space-y-2">
                          {/* Record reference */}
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs text-gray-500">Serial on record</span>
                            <span className="text-xs font-mono font-semibold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded">
                              {bi.serialNumber}
                            </span>
                          </div>

                          {/* Admin input */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Serial number on the physical item <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={serialInputs[bi.itemId] ?? ''}
                              onChange={e => handleSerialInput(bi.itemId, bi.serialNumber, e.target.value)}
                              placeholder="Type the serial number exactly as shown on the item"
                              className={`input-base font-mono text-sm transition
                                ${result === 'match'    ? 'border-green-400 bg-green-50 focus:ring-green-400'
                                : result === 'mismatch' ? 'border-red-400 bg-red-50 focus:ring-red-400'
                                : ''}`}
                            />
                          </div>

                          {/* Result feedback */}
                          {result === 'match' && (
                            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>
                              Serial numbers match — item verified
                            </div>
                          )}
                          {result === 'mismatch' && (
                            <div className="flex items-start gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                              </svg>
                              <div>
                                <p>Serial number does not match.</p>
                                <p className="text-xs text-red-500 mt-0.5">
                                  Expected: <span className="font-mono">{bi.serialNumber}</span> — the item being returned may be a different unit.
                                </p>
                              </div>
                            </div>
                          )}
                          {result === 'empty' && (
                            <p className="text-xs text-gray-400">
                              Type the serial number shown on the physical item to verify.
                            </p>
                          )}
                        </div>
                      ) : (
                        /* No serial number — checklist path */
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 mb-1">
                            This item has no serial number. Confirm the following before proceeding:
                          </p>
                          {[
                            { key: 'name' as const,      label: `Item name matches: "${bi.itemName}"` },
                            { key: 'invNo' as const,     label: `Inventory number matches: "${bi.inventoryNumber || 'N/A'}"` },
                            { key: 'inspected' as const, label: 'I have physically inspected this item' },
                          ].map(({ key, label }) => (
                            <label key={key}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition
                                ${checklist[key]
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-gray-50 border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'}`}>
                              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition
                                ${checklist[key] ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}
                                onClick={() => setChecklist(prev => ({ ...prev, [key]: !prev[key] }))}>
                                {checklist[key] && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                  </svg>
                                )}
                              </div>
                              <span className={`text-sm ${checklist[key] ? 'text-blue-800 font-medium' : 'text-gray-700'}`}>
                                {label}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Verification photo uploader */}
              <VerifyPhotoUploader
                urls={verifyPhotoUrls}
                onAdd={url => setVerifyPhotoUrls(prev => [...prev, url])}
                onRemove={idx => setVerifyPhotoUrls(prev => prev.filter((_, i) => i !== idx))}
              />

              {/* Not verified warning */}
              {!allVerified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-xs text-amber-700">
                    {hasAnySerial
                      ? 'Enter and confirm the serial number on the physical item to proceed.'
                      : 'Tick all three checkboxes to confirm you have verified the item.'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ════ STEP 2 — RETURN DETAILS ════ */}
          {step === 2 && (
            <>
              {err && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>
              )}

              {/* Verification summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800">Item verified ✓</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {hasAnySerial ? 'Serial number confirmed.' : 'Checklist verified.'}
                    {verifyPhotoUrls.length > 0 && ` ${verifyPhotoUrls.length} verification photo${verifyPhotoUrls.length !== 1 ? 's' : ''} attached.`}
                  </p>
                </div>
              </div>

              {/* Condition selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Return Condition</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Good', 'Fair', 'Damaged'] as const).map(c => (
                    <button key={c} type="button" onClick={() => setCond(c)}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition
                        ${cond === c
                          ? c === 'Good'    ? 'bg-green-50 border-green-500 text-green-700'
                            : c === 'Fair'  ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                            : 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}>
                      {c === 'Good' && '✓ '}{c === 'Fair' && '~ '}{c === 'Damaged' && '⚠ '}
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Damage photos */}
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
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3} placeholder="Any notes about the return..."
                  className="input-base resize-none"/>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => setStep(2)}
                disabled={!allVerified}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                Next — Return Details
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} disabled={busy} className="btn-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
                Back
              </button>
              <button
                disabled={busy}
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {busy ? <><Spinner sm/>Saving...</> : 'Confirm Return'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BorrowedTab ──────────────────────────────────────────────────────────────

interface BorrowedTabProps {
  requests: BorrowRequest[];
  loading: boolean;
}

export default function BorrowedTab({ requests, loading }: BorrowedTabProps) {
  const settings = useSystemSettings();
  const PER_PAGE = settings.itemsPerPage;

  const [page, setPage]           = useState(1);
  const [returning, setReturning] = useState<BorrowRequest | null>(null);

  // Subscribe to inventory so we can resolve item photos + serial numbers in Step 1
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  useEffect(() => {
    const unsub = subscribeInventory(data => setInventoryItems(data));
    return () => unsub();
  }, []);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const flag = (rd: string | null) => {
    if (!rd) return 'no-date';
    const due = new Date(rd);
    due.setDate(due.getDate() + settings.overdueThresholdDays);
    return due < new Date(today) ? 'overdue' : 'normal';
  };

  const daysOver = (rd: string) =>
    Math.ceil((new Date(today).getTime() - new Date(rd).getTime()) / 86400000);

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
                      <button onClick={() => setReturning(req)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
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
          inventoryItems={inventoryItems}
          onClose={() => setReturning(null)}
          onConfirm={async (cond, notes, photoUrls, verification) => {
            await markReturned(returning, cond, notes, photoUrls, verification);
            setReturning(null);
          }}
        />
      )}
    </div>
  );
}