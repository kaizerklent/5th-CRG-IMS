'use client';
import { useState, useEffect, useRef } from 'react';
import { InventoryItem, CustomCategory } from '@/lib/types/inventory';
import { useAuth } from '@/lib/firebase/AuthContext';
import {
  addInventoryItem, updateInventoryItem, deleteInventoryItem,
} from '@/lib/firebase/firestore';
import MultiImageUploader from '@/components/admin/Multiimageuploader';
import { useSystemSettings } from '@/lib/hooks/useSystemSettings';
import { resolveImages, resolvePrimaryImage } from '@/lib/utils/Images';
import { exportInventory } from '@/lib/utils/exportXLSX';

type FormData = Omit<InventoryItem,'id'|'createdAt'|'borrowedBy'|'borrowRequestId'>;

interface InventoryTabProps {
  items: InventoryItem[];
  loading: boolean;
  categories: CustomCategory[];
}
type ModalMode = 'add'|'edit'|'view'|null;

const EMPTY: FormData = {
  name:'', category:'', isUnique:false, quantity:1,
  condition:'Good', status:'Available',
  inventoryNumber:'', serialNumber:'', officeOwner:'',
  dateAcquired:'', inventoryDate:'',
  imageUrl: null, imageUrls: [],
  value: null,
  notes:'',
};

const COND_COLOR: Record<string,string> = {
  Good:         'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  Fair:         'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  Damaged:      'bg-red-100 text-red-700 ring-1 ring-red-200',
  'Under Repair':'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
};

const STATUS_STYLE: Record<string,string> = {
  'Available':          'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  'Unavailable':        'bg-red-100 text-red-700 ring-1 ring-red-200',
  'Returned to Vendor': 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
};

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

function ImgThumb({ url, name }: { url:string|null; name:string }) {
  if (url) return <img src={url} alt={name} className="w-full h-full object-cover"/>;
  return (
    <svg className="w-4 h-4 text-gray-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );
}

function Field({ label, value }: { label:string; value:string|number }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
      <p className="text-xs text-gray-400 mb-0.5 font-medium uppercase tracking-wide" style={{ fontSize: 10 }}>{label}</p>
      <p className="font-medium text-gray-800 text-sm">{String(value) || '—'}</p>
    </div>
  );
}

function formatDate(val: string): string {
  if (!val) return '—';
  const d = new Date(val + 'T00:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string;
  color: 'purple' | 'emerald' | 'red' | 'amber' | 'orange' | 'blue';
}) {
  const palette = {
    purple:  'bg-purple-50 border-purple-100 text-purple-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    red:     'bg-red-50 border-red-100 text-red-700',
    amber:   'bg-amber-50 border-amber-100 text-amber-700',
    orange:  'bg-orange-50 border-orange-100 text-orange-700',
    blue:    'bg-blue-50 border-blue-100 text-blue-700',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${palette[color]}`}>
      <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-1" style={{ fontSize: 10 }}>{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// ── Image gallery carousel ─────────────────────────────────────────────────────

function ImageGallery({ urls, onOpenLightbox }: { urls: string[]; onOpenLightbox: (idx: number) => void }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-2xl flex flex-col items-center justify-center gap-2">
        <svg className="w-10 h-10 text-gray-300" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <p className="text-xs text-gray-400">No photos uploaded</p>
      </div>
    );
  }
  if (urls.length === 1) {
    return (
      <div className="w-full h-48 rounded-2xl overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition relative group"
        onClick={() => onOpenLightbox(0)} title="Click to enlarge">
        <img src={urls[0]} alt="Item photo" className="w-full h-full object-cover"/>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition bg-black/50 rounded-full p-2">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
            </svg>
          </div>
        </div>
        <div className="absolute top-2 left-2 bg-purple-700 text-white text-xs font-semibold px-2 py-0.5 rounded-lg">Primary</div>
      </div>
    );
  }
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length); };
  return (
    <div className="space-y-2">
      <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group"
        onClick={() => onOpenLightbox(idx)} title="Click to enlarge">
        <img src={urls[idx]} alt={`Item photo ${idx + 1}`} className="w-full h-full object-cover"/>
        {idx === 0 && <div className="absolute top-2 left-2 bg-purple-700 text-white text-xs font-semibold px-2 py-0.5 rounded-lg pointer-events-none">Primary</div>}
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-lg pointer-events-none">{idx + 1}/{urls.length}</div>
        <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {urls.map((url, i) => (
          <button key={i} type="button" onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden border-2 transition ${i === idx ? 'border-purple-500' : 'border-transparent hover:border-gray-300'}`}>
            <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover"/>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx(i => (i - 1 + urls.length) % urls.length);
  const next = () => setIdx(i => (i + 1) % urls.length);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 cursor-zoom-out" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-5 py-3.5 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Photo {idx + 1} of {urls.length}</span>
            {idx === 0 && <span className="text-xs bg-purple-600 text-white px-2.5 py-0.5 rounded-full font-medium">Primary</span>}
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center justify-center transition" aria-label="Close">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="relative bg-gray-900 rounded-b-2xl overflow-hidden">
          <img src={urls[idx]} alt={`Item photo ${idx + 1}`} className="w-full max-h-[78vh] object-contain"/>
          {urls.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </>
          )}
        </div>
        {urls.length > 1 && (
          <div className="flex items-center gap-1.5 justify-center mt-3">
            {urls.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-200 ${i === idx ? 'w-5 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/30 hover:bg-white/60'}`}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Property Sticker ──────────────────────────────────────────────────────────

function PropertySticker({ form }: { form: FormData }) {
  return (
    <div style={{
      width: '100%', maxWidth: 320, background: '#1e56b0', borderRadius: 10,
      padding: '14px 16px 12px', fontFamily: 'Arial, sans-serif',
      position: 'relative', overflow: 'hidden', border: '2px solid #174496', margin: '0 auto',
    }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05, backgroundImage: 'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 10px)' }}/>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        {/* ── Logo ── */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          <img src="/logo/639041159_928934899785899_6548860578269527636_n.png" alt="5CRG logo" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%' }}/>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 8, letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 2px' }}>5th Civil Relations Group</p>
          <p style={{ color: 'white', fontSize: 19, fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>PROPERTY</p>
        </div>
        <div style={{ width: 36 }}/>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.3)', marginBottom: 10 }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Office:', value: form.officeOwner },
          { label: 'Inventory Nr.:', value: form.inventoryNumber },
          { label: 'Date Acquired:', value: formatDate(form.dateAcquired) },
          { label: 'Inventory Date:', value: formatDate(form.inventoryDate) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.7px', width: 108, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, background: 'white', borderRadius: 3, padding: '3px 8px', minHeight: 22 }}>
              <span style={{ color: value ? '#1a3870' : '#aab4c8', fontSize: 11, fontWeight: 600, fontFamily: label === 'Inventory Nr.:' ? 'monospace' : 'Arial, sans-serif' }}>{value || '—'}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 7 }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 7.5, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.9px', margin: 0 }}>Tampering of this sticker is punishable by law</p>
      </div>
    </div>
  );
}

function printSticker(form: FormData) {
  const html = `<!DOCTYPE html><html><head><title>Property Sticker</title>
<style>
  @page { size: 9cm 6cm; margin: 0; } * { box-sizing: border-box; }
  body { margin: 0; padding: 6px; background: white; }
  .sticker { width: 100%; height: 100%; background: #1e56b0; border-radius: 7px; padding: 10px 12px; font-family: Arial, sans-serif; color: white; position: relative; overflow: hidden; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .logo-circle { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
  .logo-circle img { width: 26px; height: 26px; object-fit: cover; border-radius: 50%; }
  .title-sub { font-size: 7px; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.8; margin: 0 0 2px; text-align: center; }
  .title-main { font-size: 16px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin: 0; text-align: center; }
  .divider { height: 0.5px; background: rgba(255,255,255,0.3); margin-bottom: 8px; }
  .row { display: flex; gap: 6px; align-items: center; margin-bottom: 5px; }
  .row-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; opacity: 0.75; width: 88px; flex-shrink: 0; }
  .row-value { flex: 1; background: white; border-radius: 2px; padding: 2px 6px; color: #1a3870; font-size: 9.5px; font-weight: 700; min-height: 18px; }
  .footer { margin-top: 8px; border-top: 0.5px solid rgba(255,255,255,0.2); padding-top: 5px; font-size: 6.5px; text-align: center; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.5; }
</style></head><body>
  <div class="sticker">
    <div class="header">
      <div class="logo-circle"><img src="${window.location.origin}/logo/639041159_928934899785899_6548860578269527636_n.png" alt="5CRG"/></div>
      <div style="flex:1; text-align:center; padding:0 8px;">
        <p class="title-sub">5th Civil Relations Group</p>
        <p class="title-main">PROPERTY</p>
      </div>
      <div style="width:32px;"></div>
    </div>
    <div class="divider"></div>
    <div class="row"><span class="row-label">Office:</span><span class="row-value">${form.officeOwner || ''}</span></div>
    <div class="row"><span class="row-label">Inventory Nr.:</span><span class="row-value" style="font-family:monospace">${form.inventoryNumber || ''}</span></div>
    <div class="row"><span class="row-label">Date Acquired:</span><span class="row-value">${formatDate(form.dateAcquired)}</span></div>
    <div class="row"><span class="row-label">Inventory Date:</span><span class="row-value">${formatDate(form.inventoryDate)}</span></div>
    <div class="footer">Tampering of this sticker is punishable by law</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`;
  const win = window.open('', '_blank', 'width=400,height=300');
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InventoryTab({ items, loading, categories }: InventoryTabProps) {
  const { user } = useAuth();
  const adminName = user?.displayName || user?.email || 'Admin';
  const settings  = useSystemSettings();
  const PER_PAGE  = settings.itemsPerPage;

  const [search, setSearch]     = useState('');
  const [catFilter, setCat]     = useState('All');
  const [stFilter, setSt]       = useState('All');
  const [condFilter, setCond]   = useState('All');
  const [page, setPage]         = useState(1);

  const [modal, setModal]               = useState<ModalMode>(null);
  const [selItem, setSelItem]           = useState<InventoryItem|null>(null);
  const [form, setForm]                 = useState<FormData>({ ...EMPTY });
  const [delId, setDelId]               = useState<string|null>(null);
  const [delName, setDelName]           = useState('');
  const [deleting, setDeleting]         = useState(false);
  const [delErr, setDelErr]             = useState<string|null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveErr, setSaveErr]           = useState<string|null>(null);
  const [showSticker, setShowSticker]   = useState(false);
  const [lightboxUrls, setLightboxUrls] = useState<string[]|null>(null);
  const [lightboxIdx, setLightboxIdx]   = useState(0);

  const catNames = categories.map(c => c.name);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalItems     = items.length;
  const availableItems = items.filter(i => i.status === 'Available').length;
  const borrowedItems  = items.filter(i => i.status === 'Unavailable' && i.borrowedBy).length;
  const damagedItems   = items.filter(i => i.condition === 'Damaged' || i.condition === 'Under Repair').length;
  const totalValue     = items.reduce((s, i) => s + (i.value ?? 0), 0);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return (catFilter === 'All' || item.category === catFilter) &&
      (stFilter   === 'All' || item.status    === stFilter) &&
      (condFilter === 'All' || item.condition === condFilter) &&
      (item.name.toLowerCase().includes(q) ||
       item.inventoryNumber.toLowerCase().includes(q) ||
       item.serialNumber.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasFilters = search || catFilter !== 'All' || stFilter !== 'All' || condFilter !== 'All';

  function clearFilters() {
    setSearch(''); setCat('All'); setSt('All'); setCond('All'); setPage(1);
  }

  function openAdd() {
    setForm({ ...EMPTY }); setSelItem(null);
    setSaveErr(null); setShowSticker(false); setModal('add');
  }

  function openEdit(item: InventoryItem) {
    const imgs = resolveImages(item);
    setForm({
      name: item.name, category: item.category, isUnique: item.isUnique,
      quantity: item.quantity, condition: item.condition, status: item.status,
      inventoryNumber: item.inventoryNumber, serialNumber: item.serialNumber,
      officeOwner: item.officeOwner, dateAcquired: item.dateAcquired,
      inventoryDate: item.inventoryDate,
      imageUrl: item.imageUrl,
      imageUrls: imgs,
      value: item.value ?? null,
      notes: item.notes,
    });
    setSelItem(item); setSaveErr(null); setShowSticker(false); setModal('edit');
  }

  function openView(item: InventoryItem) { setSelItem(item); setModal('view'); }
  function openDelete(item: InventoryItem) { setDelId(item.id); setDelName(item.name); setDelErr(null); }

  function upd(key: keyof FormData, val: any) {
    setForm(prev => {
      const f = { ...prev, [key]: val };
      if (key === 'isUnique' && val) f.quantity = 1;
      if (key === 'quantity' && val === 0) f.status = 'Unavailable';
      if (key === 'quantity' && val > 0 && prev.quantity === 0) f.status = 'Available';
      return f;
    });
  }

  function addImage(url: string) { upd('imageUrls', [...(form.imageUrls ?? []), url]); }
  function removeImage(idx: number) { upd('imageUrls', (form.imageUrls ?? []).filter((_, i) => i !== idx)); }
  function openLightbox(urls: string[], idx: number) { setLightboxUrls(urls); setLightboxIdx(idx); }

  async function handleSave() {
    if (!form.name.trim() || !form.category) return;
    setSaving(true); setSaveErr(null);
    try {
      const payload = modal === 'add'
        ? { ...form, borrowedBy: null, borrowRequestId: null }
        : { ...form, borrowedBy: selItem?.borrowedBy ?? null, borrowRequestId: selItem?.borrowRequestId ?? null };
      if (modal === 'add') await addInventoryItem(payload, adminName);
      else if (modal === 'edit' && selItem) await updateInventoryItem(selItem.id, selItem.name, form, adminName);
      setModal(null);
    } catch { setSaveErr('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    setDeleting(true); setDelErr(null);
    try { await deleteInventoryItem(id, name, adminName); setDelId(null); }
    catch { setDelErr('Failed to delete. Please try again.'); }
    finally { setDeleting(false); }
  }

  function statusBadge(status: string) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  }

  // ── Form section label ─────────────────────────────────────────────────────
  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-5 first:mt-0 flex items-center gap-2">
        <span className="flex-1 h-px bg-gray-100"/>
        {children}
        <span className="flex-1 h-px bg-gray-100"/>
      </p>
    );
  }

  return (
    <div className="w-full space-y-5">


      {/* ── Toolbar ── */}
      <div className="card px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" placeholder="Name, inventory no., serial no."
                aria-label="Search inventory" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-base pl-9"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Category</label>
            <select aria-label="Filter by category" value={catFilter}
              onChange={e => { setCat(e.target.value); setPage(1); }} className="input-base bg-white w-auto">
              <option value="All">All Categories</option>
              {catNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Status</label>
            <select aria-label="Filter by status" value={stFilter}
              onChange={e => { setSt(e.target.value); setPage(1); }} className="input-base bg-white w-auto">
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
              <option value="Returned to Vendor">Returned to Vendor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Condition</label>
            <select aria-label="Filter by condition" value={condFilter}
              onChange={e => { setCond(e.target.value); setPage(1); }} className="input-base bg-white w-auto">
              <option value="All">All Conditions</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Damaged">Damaged</option>
              <option value="Under Repair">Under Repair</option>
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary flex items-center gap-1.5 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Clear
              </button>
            )}
            <button onClick={() => exportInventory(items)} className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export
            </button>
            <button onClick={openAdd} className="btn-primary">
              <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Item
            </button>
          </div>
        </div>

        {/* Active filters summary */}
        {hasFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
            <span className="text-xs text-gray-400 font-medium">Showing {filtered.length} of {items.length}</span>
            {search && (
              <span className="flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full border border-purple-100">
                "{search}"
                <button onClick={() => { setSearch(''); setPage(1); }} className="hover:text-purple-900">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            )}
            {catFilter !== 'All' && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-100">
                {catFilter}
                <button onClick={() => { setCat('All'); setPage(1); }} className="hover:text-blue-900">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            )}
            {stFilter !== 'All' && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-100">
                {stFilter}
                <button onClick={() => { setSt('All'); setPage(1); }} className="hover:text-emerald-900">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            )}
            {condFilter !== 'All' && (
              <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100">
                {condFilter}
                <button onClick={() => { setCond('All'); setPage(1); }} className="hover:text-amber-900">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Empty categories hint ── */}
      {catNames.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          </div>
          <p className="text-sm text-amber-800">
            No categories yet. Go to <strong>Profile → System Settings → Inventory Categories</strong> to add some before creating items.
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {/* Table header row */}
        <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Inventory</h3>
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {loading ? '…' : filtered.length}
            </span>
          </div>
          {!loading && filtered.length > 0 && (
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages || 1}
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Item', 'Category', 'Qty', 'Condition', 'Status', 'Inv. No.', 'Value', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest px-5 py-3 bg-gray-50/40" style={{ fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Spinner/>
                      <span className="text-sm">Loading inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">{hasFilters ? 'No items match your filters.' : 'No items yet.'}</p>
                        {hasFilters && <button onClick={clearFilters} className="text-xs text-purple-600 hover:underline mt-1">Clear filters</button>}
                        {!hasFilters && <p className="text-xs text-gray-400 mt-1">Click "Add Item" to get started.</p>}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paginated.map(item => {
                const primaryImg = resolvePrimaryImage(item);
                const allImgs    = resolveImages(item);
                return (
                  <tr key={item.id} className="hover:bg-purple-50/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden relative ${primaryImg ? 'cursor-pointer' : ''}`}
                          onClick={() => primaryImg && openLightbox(allImgs, 0)}
                          title={primaryImg ? `${allImgs.length} photo${allImgs.length !== 1 ? 's' : ''} — click to view` : undefined}
                        >
                          <ImgThumb url={primaryImg} name={item.name}/>
                          {allImgs.length > 1 && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-purple-600 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                              {allImgs.length}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                          {item.serialNumber && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{item.serialNumber}</p>
                          )}
                          {item.borrowedBy && (
                            <p className="text-xs text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                              </svg>
                              {item.borrowedBy}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">{item.category}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-bold ${item.quantity === 0 ? 'text-red-500' : 'text-gray-700'}`}>
                        {item.quantity}
                      </span>
                      {item.isUnique && <span className="ml-1 text-xs text-gray-400">(unique)</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${COND_COLOR[item.condition] || 'bg-gray-100 text-gray-600'}`}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{statusBadge(item.status)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{item.inventoryNumber || '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-gray-600">
                      {item.value != null ? `₱${item.value.toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openView(item)} title="View Details"
                          className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition">
                          <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        </button>
                        <button onClick={() => openEdit(item)} title="Edit item"
                          className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                          <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => openDelete(item)} title="Delete item"
                          className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition">
                          <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-gray-700">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg text-xs font-medium transition text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${p === page ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-lg text-xs font-medium transition text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-label={modal === 'add' ? 'Add New Item' : 'Edit Item'}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* Modal header */}
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${modal === 'add' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  <svg className={`w-4.5 h-4.5 ${modal === 'add' ? 'text-purple-700' : 'text-blue-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {modal === 'add'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    }
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">{modal === 'add' ? 'Add New Item' : 'Edit Item'}</h3>
                  {modal === 'edit' && selItem && <p className="text-xs text-gray-400 mt-0.5">{selItem.name}</p>}
                </div>
              </div>
              <button aria-label="Close dialog" onClick={() => setModal(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition">
                <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-7 py-5">
              {saveErr && (
                <div role="alert" className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  {saveErr}
                </div>
              )}

              {/* ── Basic Info ── */}
              <SectionLabel>Basic Info</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label htmlFor="field-name" className="block text-sm font-medium text-gray-700 mb-1.5">Item Name <span className="text-red-500">*</span></label>
                  <input id="field-name" type="text" value={form.name} onChange={e => upd('name', e.target.value)}
                    placeholder="e.g. Sony Camera A7" className="input-base"/>
                </div>

                <div>
                  <label htmlFor="field-category" className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                  <select id="field-category" value={form.category} onChange={e => upd('category', e.target.value)} className="input-base bg-white">
                    <option value="">Select category</option>
                    {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                    {form.category && !catNames.includes(form.category) && (
                      <option value={form.category}>{form.category} (removed)</option>
                    )}
                  </select>
                  {catNames.length === 0 && <p className="text-xs text-amber-600 mt-1">No categories — add them in Profile → System Settings.</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Asset Type <span className="text-red-500">*</span></label>
                  <div className="flex gap-2" role="group" aria-label="Asset type">
                    {([['Unique Asset', true], ['Bulk Item', false]] as const).map(([label, val]) => (
                      <button key={String(val)} type="button" onClick={() => upd('isUnique', val)} aria-pressed={form.isUnique === val}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${form.isUnique === val ? 'bg-purple-50 border-purple-400 text-purple-700 ring-1 ring-purple-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="field-quantity" className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                  <input id="field-quantity" type="number" min={0} value={form.quantity} disabled={form.isUnique}
                    onChange={e => upd('quantity', parseInt(e.target.value) || 0)} className="input-base disabled:bg-gray-50 disabled:text-gray-400"/>
                  {form.quantity === 0 && <p className="text-xs text-amber-600 mt-1">⚠️ Qty 0 — status set to Unavailable</p>}
                </div>

                <div>
                  <label htmlFor="field-condition" className="block text-sm font-medium text-gray-700 mb-1.5">Condition <span className="text-red-500">*</span></label>
                  <select id="field-condition" value={form.condition} onChange={e => upd('condition', e.target.value)} className="input-base bg-white">
                    {['Good', 'Fair', 'Damaged', 'Under Repair'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="field-status" className="block text-sm font-medium text-gray-700 mb-1.5">Status <span className="text-red-500">*</span></label>
                  <select id="field-status" value={form.status} disabled={form.quantity === 0}
                    onChange={e => upd('status', e.target.value)} className="input-base bg-white disabled:bg-gray-50 disabled:text-gray-400">
                    <option value="Available">Available</option>
                    <option value="Unavailable">Unavailable</option>
                    <option value="Returned to Vendor">Returned to Vendor</option>
                  </select>
                </div>
              </div>

              {/* ── Identification ── */}
              <SectionLabel>Identification</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="field-inv-number" className="block text-sm font-medium text-gray-700 mb-1.5">Inventory Number</label>
                  <input id="field-inv-number" type="text" value={form.inventoryNumber}
                    onChange={e => upd('inventoryNumber', e.target.value)} placeholder="e.g. INV-001" className="input-base font-mono"/>
                </div>
                <div>
                  <label htmlFor="field-serial" className="block text-sm font-medium text-gray-700 mb-1.5">Serial Number</label>
                  <input id="field-serial" type="text" value={form.serialNumber}
                    onChange={e => upd('serialNumber', e.target.value)} placeholder="e.g. SN-123456" className="input-base font-mono"/>
                </div>
                <div>
                  <label htmlFor="field-owner" className="block text-sm font-medium text-gray-700 mb-1.5">Office / Department</label>
                  <input id="field-owner" type="text" value={form.officeOwner}
                    onChange={e => upd('officeOwner', e.target.value)} placeholder="e.g. IT Department" className="input-base"/>
                </div>
                <div>
                  <label htmlFor="field-value" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Item Value <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">₱</span>
                    <input id="field-value" type="number" min={0} step={0.01}
                      value={form.value ?? ''}
                      onChange={e => upd('value', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0.00" className="input-base pl-7"/>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Items ₱50,000+ appear in Vendor Returns.</p>
                </div>
              </div>

              {/* ── Dates ── */}
              <SectionLabel>Dates</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="field-date-acquired" className="block text-sm font-medium text-gray-700 mb-1.5">Date Acquired</label>
                  <input id="field-date-acquired" type="date" value={form.dateAcquired}
                    onChange={e => upd('dateAcquired', e.target.value)} className="input-base"/>
                </div>
                <div>
                  <label htmlFor="field-inv-date" className="block text-sm font-medium text-gray-700 mb-1.5">Last Inventory Date</label>
                  <input id="field-inv-date" type="date" value={form.inventoryDate}
                    onChange={e => upd('inventoryDate', e.target.value)} className="input-base"/>
                </div>
              </div>

              {/* ── Photos ── */}
              <SectionLabel>Photos</SectionLabel>
              <MultiImageUploader
                folder="inventory"
                urls={form.imageUrls ?? []}
                onAdd={addImage}
                onRemove={removeImage}
                label="Item Photos"
                maxImages={10}
              />

              {/* ── Notes ── */}
              <SectionLabel>Notes</SectionLabel>
              <textarea id="field-notes" value={form.notes} onChange={e => upd('notes', e.target.value)}
                rows={3} placeholder="Admin notes about this item..." className="input-base resize-none w-full"/>

              {/* ── Property Sticker ── */}
              <SectionLabel>Property Sticker</SectionLabel>
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <button type="button" onClick={() => setShowSticker(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition text-left" aria-expanded={showSticker}>
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-blue-600" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 10V5a2 2 0 012-2z"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Preview & Print Property Sticker</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showSticker ? 'rotate-180' : ''}`} aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {showSticker && (
                  <div className="p-5 bg-white flex flex-col items-center gap-4 border-t border-gray-100">
                    <PropertySticker form={form}/>
                    <button type="button" onClick={() => printSticker(form)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition">
                      <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                      </svg>
                      Print Sticker
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-7 py-5 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50/50">
              <button onClick={() => setModal(null)} disabled={saving} className="btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.category} className="btn-primary flex-1 py-2.5">
                {saving ? <><Spinner/> Saving...</> : modal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail Modal ── */}
      {modal === 'view' && selItem && (() => {
        const imgs = resolveImages(selItem);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog" aria-modal="true" aria-label="Item Details">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
              <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 leading-tight">{selItem.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {imgs.length > 0 ? `${imgs.length} photo${imgs.length !== 1 ? 's' : ''} · ` : ''}{selItem.category}
                    </p>
                  </div>
                </div>
                <button aria-label="Close dialog" onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                  <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
                <ImageGallery urls={imgs} onOpenLightbox={idx => openLightbox(imgs, idx)}/>

                {/* Status & Condition pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(selItem.status)}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${COND_COLOR[selItem.condition] || 'bg-gray-100 text-gray-600'}`}>
                    {selItem.condition}
                  </span>
                  {selItem.isUnique && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 ring-1 ring-purple-200">
                      Unique Asset
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Quantity"       value={selItem.quantity}/>
                  <Field label="Category"       value={selItem.category}/>
                  <Field label="Inventory No."  value={selItem.inventoryNumber}/>
                  <Field label="Serial No."     value={selItem.serialNumber}/>
                  <Field label="Office Owner"   value={selItem.officeOwner}/>
                  <Field label="Date Acquired"  value={formatDate(selItem.dateAcquired)}/>
                  <Field label="Last Inventory" value={formatDate(selItem.inventoryDate)}/>
                  <Field label="Borrowed By"    value={selItem.borrowedBy || '—'}/>
                  <Field
                    label="Item Value"
                    value={selItem.value != null
                      ? `₱${selItem.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                      : '—'
                    }
                  />
                </div>

                {selItem.notes && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5" style={{ fontSize: 10 }}>Notes</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{selItem.notes}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3" style={{ fontSize: 10 }}>Property Sticker</p>
                  <PropertySticker form={{
                    name: selItem.name, category: selItem.category,
                    isUnique: selItem.isUnique, quantity: selItem.quantity,
                    condition: selItem.condition, status: selItem.status,
                    inventoryNumber: selItem.inventoryNumber, serialNumber: selItem.serialNumber,
                    officeOwner: selItem.officeOwner, dateAcquired: selItem.dateAcquired,
                    inventoryDate: selItem.inventoryDate, imageUrl: selItem.imageUrl,
                    imageUrls: imgs, value: selItem.value ?? null, notes: selItem.notes,
                  }}/>
                </div>
              </div>

              <div className="px-7 py-5 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50/50">
                <button onClick={() => printSticker({
                  name: selItem.name, category: selItem.category,
                  isUnique: selItem.isUnique, quantity: selItem.quantity,
                  condition: selItem.condition, status: selItem.status,
                  inventoryNumber: selItem.inventoryNumber, serialNumber: selItem.serialNumber,
                  officeOwner: selItem.officeOwner, dateAcquired: selItem.dateAcquired,
                  inventoryDate: selItem.inventoryDate, imageUrl: selItem.imageUrl,
                  imageUrls: imgs, value: selItem.value ?? null, notes: selItem.notes,
                })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition">
                  <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                  </svg>
                  Print
                </button>
                <button onClick={() => { setModal(null); openEdit(selItem); }} className="btn-primary flex-1 py-2.5">Edit Item</button>
                <button onClick={() => setModal(null)} className="btn-secondary py-2.5 px-5">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete Confirm ── */}
      {delId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog" aria-modal="true" aria-label="Delete item confirmation">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-red-600" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Delete Item?</h3>
              <p className="text-sm font-semibold text-gray-700 mb-1">"{delName}"</p>
              <p className="text-sm text-gray-400 mb-5">This action cannot be undone. The item will be permanently removed from inventory.</p>
              {delErr && (
                <div role="alert" className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{delErr}</div>
              )}
              <div className="flex gap-3 w-full">
                <button onClick={() => { setDelId(null); setDelErr(null); }} disabled={deleting} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button onClick={() => handleDelete(delId, delName)} disabled={deleting} className="btn-danger flex-1 py-2.5">
                  {deleting ? <><Spinner/> Deleting...</> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Image Lightbox ── */}
      {lightboxUrls && (
        <Lightbox urls={lightboxUrls} startIndex={lightboxIdx} onClose={() => setLightboxUrls(null)}/>
      )}
    </div>
  );
}