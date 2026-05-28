'use client';
import { useState, useEffect, useRef } from 'react';
import { InventoryItem, CustomCategory } from '@/lib/types/inventory';
import { useAuth } from '@/lib/firebase/AuthContext';
import {
  addInventoryItem, updateInventoryItem, deleteInventoryItem,
  sanitizeSerialNumber, isSerialDuplicate,
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
  name:'', category:'', subCategory:'', isUnique:false, isConsumable:false,
  quantity:1, condition:'Good', status:'Available',
  inventoryNumber:'', serialNumber:'', officeOwner:'',
  dateAcquired:'', inventoryDate:'',
  imageUrl: null, imageUrls: [],
  value: null,
  notes:'',
};

const COND_COLOR: Record<string,string> = {
  Good:'bg-green-100 text-green-700', Fair:'bg-yellow-100 text-yellow-700',
  Damaged:'bg-red-100 text-red-700', 'Under Repair':'bg-orange-100 text-orange-700',
};

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

function ImgThumb({ url, name }: { url:string|null; name:string }) {
  if (url) return <img src={url} alt={name} className="w-full h-full object-cover"/>;
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );
}

function Field({ label, value }: { label:string; value:string|number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
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

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'Available')
    return <span className="badge-available">Available</span>;
  if (status === 'Out of Stock')
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Out of Stock</span>;
  if (status === 'Returned to Vendor')
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Returned to Vendor</span>;
  return <span className="badge-unavailable">Unavailable</span>;
}

// ── Image gallery (view modal) ─────────────────────────────────────────────────

function ImageGallery({ urls, onOpenLightbox }: { urls: string[]; onOpenLightbox: (idx: number) => void }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return (
      <div className="w-full h-44 bg-gray-100 rounded-xl flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
    );
  }
  if (urls.length === 1) {
    return (
      <div className="w-full h-44 rounded-xl overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition relative" onClick={() => onOpenLightbox(0)}>
        <img src={urls[0]} alt="Item photo" className="w-full h-full object-cover"/>
        <div className="absolute top-2 left-2 bg-purple-700 text-white text-xs font-semibold px-1.5 py-0.5 rounded-md">Primary</div>
      </div>
    );
  }
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length); };
  return (
    <div className="space-y-2">
      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gray-100 cursor-pointer group" onClick={() => onOpenLightbox(idx)}>
        <img src={urls[idx]} alt={`Item photo ${idx + 1}`} className="w-full h-full object-cover"/>
        {idx === 0 && <div className="absolute top-2 left-2 bg-purple-700 text-white text-xs font-semibold px-1.5 py-0.5 rounded-md pointer-events-none">Primary</div>}
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-md pointer-events-none">{idx + 1} / {urls.length}</div>
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
            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition ${i === idx ? 'border-purple-500' : 'border-transparent hover:border-gray-300'}`}>
            <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover"/>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 justify-center">
        {urls.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`rounded-full transition-all duration-200 ${i === idx ? 'w-4 h-2 bg-purple-600' : 'w-2 h-2 bg-gray-300 hover:bg-purple-400'}`}/>
        ))}
      </div>
    </div>
  );
}

// ── Lightbox ───────────────────────────────────────────────────────────────────

function Lightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx(i => (i - 1 + urls.length) % urls.length);
  const next = () => setIdx(i => (i + 1) % urls.length);
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 cursor-zoom-out" onClick={onClose}>
      <div className="relative max-w-3xl w-full flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Photo {idx + 1} of {urls.length}</span>
            {idx === 0 && <span className="text-xs bg-purple-700 text-white px-2 py-0.5 rounded-full">Primary</span>}
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="relative bg-gray-900 rounded-b-xl overflow-hidden">
          <img src={urls[idx]} alt={`Item photo ${idx + 1}`} className="w-full max-h-[75vh] object-contain"/>
          {urls.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center transition">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </>
          )}
        </div>
        {urls.length > 1 && (
          <div className="flex items-center gap-1.5 justify-center mt-3">
            {urls.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all duration-200 ${i === idx ? 'w-4 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'}`}/>
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
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.6 9h16.8M3.6 15h16.8" strokeLinecap="round" opacity="0.5"/>
          </svg>
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
  .header { display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .title-sub { font-size: 7px; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.8; margin: 0 0 2px; text-align: center; }
  .title-main { font-size: 16px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin: 0; text-align: center; }
  .divider { height: 0.5px; background: rgba(255,255,255,0.3); margin-bottom: 8px; }
  .row { display: flex; gap: 6px; align-items: center; margin-bottom: 5px; }
  .row-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; opacity: 0.75; width: 88px; flex-shrink: 0; }
  .row-value { flex: 1; background: white; border-radius: 2px; padding: 2px 6px; color: #1a3870; font-size: 9.5px; font-weight: 700; min-height: 18px; }
  .footer { margin-top: 8px; border-top: 0.5px solid rgba(255,255,255,0.2); padding-top: 5px; font-size: 6.5px; text-align: center; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.5; }
</style></head><body>
  <div class="sticker">
    <div class="header"><div><p class="title-sub">5th Civil Relations Group</p><p class="title-main">PROPERTY</p></div></div>
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

// ─── Main component ────────────────────────────────────────────────────────────

export default function InventoryTab({ items, loading, categories }: InventoryTabProps) {
  const { user } = useAuth();
  const adminName = user?.displayName || user?.email || 'Admin';
  const settings = useSystemSettings();
  const PER_PAGE = settings.itemsPerPage;

  const [search, setSearch]           = useState('');
  const [catFilter, setCat]           = useState('All');
  const [subCatFilter, setSubCat]     = useState('All');
  const [stFilter, setSt]             = useState('All');
  const [page, setPage]               = useState(1);

  const [modal, setModal]               = useState<ModalMode>(null);
  const [selItem, setSelItem]           = useState<InventoryItem|null>(null);
  const [form, setForm]                 = useState<FormData>({ ...EMPTY });
  const [serialError, setSerialError]   = useState<string | null>(null);
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

  // Sub-categories for selected filter category
  const filterSubCats = catFilter !== 'All'
    ? (categories.find(c => c.name === catFilter)?.subCategories ?? [])
    : [];

  // Sub-categories for the form's selected category
  const formSubCats = form.category
    ? (categories.find(c => c.name === form.category)?.subCategories ?? [])
    : [];

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return (catFilter === 'All' || item.category === catFilter) &&
      (subCatFilter === 'All' || item.subCategory === subCatFilter) &&
      (stFilter === 'All' || item.status === stFilter) &&
      (item.name.toLowerCase().includes(q) ||
       item.inventoryNumber.toLowerCase().includes(q) ||
       item.serialNumber.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  function openAdd() {
    setForm({ ...EMPTY }); setSelItem(null);
    setSaveErr(null); setSerialError(null); setShowSticker(false); setModal('add');
  }

  function openEdit(item: InventoryItem) {
    const imgs = resolveImages(item);
    setForm({
      name: item.name, category: item.category, subCategory: item.subCategory ?? '',
      isUnique: item.isUnique, isConsumable: item.isConsumable ?? false,
      quantity: item.quantity, condition: item.condition, status: item.status,
      inventoryNumber: item.inventoryNumber, serialNumber: item.serialNumber,
      officeOwner: item.officeOwner, dateAcquired: item.dateAcquired,
      inventoryDate: item.inventoryDate,
      imageUrl: item.imageUrl, imageUrls: imgs,
      value: item.value ?? null, notes: item.notes,
    });
    setSelItem(item); setSaveErr(null); setSerialError(null); setShowSticker(false); setModal('edit');
  }

  function openView(item: InventoryItem) { setSelItem(item); setModal('view'); }
  function openDelete(item: InventoryItem) { setDelId(item.id); setDelName(item.name); setDelErr(null); }

  function upd(key: keyof FormData, val: any) {
    setForm(prev => {
      const f = { ...prev, [key]: val };
      // Reset sub-category when category changes
      if (key === 'category') f.subCategory = '';
      if (key === 'isUnique' && val) { f.quantity = 1; f.isConsumable = false; }
      if (key === 'isConsumable' && val) { f.isUnique = false; f.serialNumber = ''; setSerialError(null); }
      if (key === 'quantity' && val === 0) f.status = 'Out of Stock';
      if (key === 'quantity' && val > 0 && (prev.quantity === 0)) f.status = 'Available';
      return f;
    });
    // Clear serial error when serial changes
    if (key === 'serialNumber') setSerialError(null);
  }

  function handleSerialChange(raw: string) {
    const clean = sanitizeSerialNumber(raw);
    upd('serialNumber', clean);
  }

  function addImage(url: string) { upd('imageUrls', [...(form.imageUrls ?? []), url]); }
  function removeImage(idx: number) { upd('imageUrls', (form.imageUrls ?? []).filter((_, i) => i !== idx)); }

  function openLightbox(urls: string[], idx: number) {
    setLightboxUrls(urls);
    setLightboxIdx(idx);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.category) return;

    // ── Serial duplicate check ──────────────────────────────────────────────
    if (form.serialNumber.trim()) {
      const excludeId = modal === 'edit' ? selItem?.id ?? null : null;
      if (isSerialDuplicate(form.serialNumber, excludeId, items)) {
        setSerialError(`Serial number "${form.serialNumber}" is already used by another item.`);
        return;
      }
    }

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

  return (
    <div className="w-full space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name, inventory no., serial no."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-base flex-1 min-w-[200px]"
        />
        <select value={catFilter}
          onChange={e => { setCat(e.target.value); setSubCat('All'); setPage(1); }}
          className="input-base w-auto bg-white">
          <option value="All">All Categories</option>
          {catNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Sub-category filter — only shown when a category is selected and has sub-cats */}
        {catFilter !== 'All' && filterSubCats.length > 0 && (
          <select value={subCatFilter}
            onChange={e => { setSubCat(e.target.value); setPage(1); }}
            className="input-base w-auto bg-white">
            <option value="All">All Sub-categories</option>
            {filterSubCats.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <select value={stFilter}
          onChange={e => { setSt(e.target.value); setPage(1); }}
          className="input-base w-auto bg-white">
          <option value="All">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Unavailable">Unavailable</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="Returned to Vendor">Returned to Vendor</option>
        </select>
        <button onClick={() => exportInventory(items)} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export XLSX
        </button>
        <button onClick={openAdd} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add Item
        </button>
      </div>

      {/* ── Empty categories hint ── */}
      {catNames.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm text-yellow-800">
            No categories yet. Go to <strong>Profile → System Settings → Inventory Categories</strong> to add some before creating items.
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Item','Category','Qty','Condition','Status','Inv. No.','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400"><Spinner/><span className="text-sm">Loading inventory...</span></div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-500 py-12 text-sm">No items found.</td></tr>
              ) : paginated.map(item => {
                const primaryImg = resolvePrimaryImage(item);
                const allImgs    = resolveImages(item);
                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden relative ${primaryImg ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
                          onClick={() => primaryImg && openLightbox(allImgs, 0)}
                        >
                          <ImgThumb url={primaryImg} name={item.name}/>
                          {allImgs.length > 1 && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-purple-600 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">{allImgs.length}</div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-800">{item.name}</p>
                            {item.isConsumable && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">Consumable</span>
                            )}
                          </div>
                          {item.subCategory && <p className="text-xs text-gray-400">{item.subCategory}</p>}
                          {item.borrowedBy && <p className="text-xs text-blue-600">Borrowed by: {item.borrowedBy}</p>}
                          {item.value != null && (
                            <p className="text-xs text-gray-400">₱{item.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-600">{item.category}</p>
                      {item.subCategory && <p className="text-xs text-gray-400">{item.subCategory}</p>}
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-700">{item.quantity}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${COND_COLOR[item.condition]||'bg-gray-100 text-gray-700'}`}>{item.condition}</span>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={item.status}/></td>
                    <td className="px-5 py-4 text-gray-600 font-mono text-xs">{item.inventoryNumber||'—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openView(item)} title="View Details"
                          className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button onClick={() => openEdit(item)} title="Edit item"
                          className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => openDelete(item)} title="Delete item"
                          className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length}</p>
            <div className="flex gap-1">
              {Array.from({length:totalPages},(_,i)=>i+1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p===page?'bg-purple-700 text-white':'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {(modal==='add'||modal==='edit') && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">{modal==='add'?'Add New Item':'Edit Item'}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              {saveErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{saveErr}</div>}
              <div className="grid grid-cols-2 gap-4">

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Sony Camera A7" className="input-base"/>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select value={form.category} onChange={e => upd('category', e.target.value)} className="input-base bg-white">
                    <option value="">Select category</option>
                    {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                    {form.category && !catNames.includes(form.category) && (
                      <option value={form.category}>{form.category} (removed)</option>
                    )}
                  </select>
                  {catNames.length === 0 && <p className="text-xs text-yellow-600 mt-1">No categories yet — add them in Profile → System Settings.</p>}
                </div>

                {/* Sub-category — only shown when parent category has sub-cats */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub-category
                    <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  {formSubCats.length > 0 ? (
                    <select value={form.subCategory} onChange={e => upd('subCategory', e.target.value)} className="input-base bg-white">
                      <option value="">None</option>
                      {formSubCats.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.subCategory} onChange={e => upd('subCategory', e.target.value)}
                      placeholder={form.category ? 'No sub-categories — add in Profile' : 'Select a category first'}
                      disabled={!form.category}
                      className="input-base disabled:bg-gray-50 disabled:text-gray-400"/>
                  )}
                </div>

                {/* Asset Type — 3 options */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Unique Asset',  desc: 'Single tracked item', val: 'unique' },
                      { label: 'Bulk Item',     desc: 'Multiple qty, restored on return', val: 'bulk' },
                      { label: 'Consumable',    desc: 'Used up — qty permanent', val: 'consumable' },
                    ].map(({ label, desc, val }) => {
                      const active =
                        val === 'unique'     ? form.isUnique && !form.isConsumable :
                        val === 'bulk'       ? !form.isUnique && !form.isConsumable :
                                              form.isConsumable;
                      return (
                        <button key={val} type="button"
                          onClick={() => {
                            if (val === 'unique')     { upd('isUnique', true);  upd('isConsumable', false); }
                            if (val === 'bulk')       { upd('isUnique', false); upd('isConsumable', false); }
                            if (val === 'consumable') { upd('isUnique', false); upd('isConsumable', true);  }
                          }}
                          className={`p-3 rounded-lg border text-left transition ${active
                            ? val === 'consumable'
                              ? 'bg-amber-50 border-amber-500 text-amber-700'
                              : 'bg-purple-50 border-purple-500 text-purple-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-xs opacity-70 mt-0.5">{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  {form.isConsumable && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      Consumable: quantity is permanently reduced when borrowed/used. Refill by editing quantity.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min={0} value={form.quantity} disabled={form.isUnique}
                    onChange={e => upd('quantity', parseInt(e.target.value)||0)} className="input-base disabled:bg-gray-100 disabled:text-gray-400"/>
                  {form.quantity === 0 && <p className="text-xs text-amber-600 mt-1">⚠️ Qty 0 — status will be {form.isConsumable ? 'Out of Stock' : 'Unavailable'}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition <span className="text-red-500">*</span></label>
                  <select value={form.condition} onChange={e => upd('condition', e.target.value)} className="input-base bg-white">
                    {['Good','Fair','Damaged','Under Repair'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                  <select value={form.status} disabled={form.quantity===0} onChange={e => upd('status', e.target.value as any)} className="input-base bg-white disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="Available">Available</option>
                    <option value="Unavailable">Unavailable</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="Returned to Vendor">Returned to Vendor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Number</label>
                  <input type="text" value={form.inventoryNumber} onChange={e => upd('inventoryNumber', e.target.value)} placeholder="e.g. INV-001" className="input-base"/>
                </div>

                {/* Serial Number — hidden for consumables */}
                {!form.isConsumable && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                    <input type="text" value={form.serialNumber}
                      onChange={e => handleSerialChange(e.target.value)}
                      placeholder="e.g. SN-123456"
                      className={`input-base ${serialError ? 'border-red-400 focus:ring-red-400' : ''}`}/>
                    {serialError
                      ? <p className="text-xs text-red-600 mt-1">{serialError}</p>
                      : <p className="text-xs text-gray-400 mt-1">Only letters, numbers, spaces and hyphens allowed.</p>
                    }
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Office / Department Owner</label>
                  <input type="text" value={form.officeOwner} onChange={e => upd('officeOwner', e.target.value)} placeholder="e.g. IT Department" className="input-base"/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Acquired</label>
                  <input type="date" value={form.dateAcquired} onChange={e => upd('dateAcquired', e.target.value)} className="input-base"/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Inventory Date</label>
                  <input type="date" value={form.inventoryDate} onChange={e => upd('inventoryDate', e.target.value)} className="input-base"/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Value <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">₱</span>
                    <input type="number" min={0} step={0.01} value={form.value ?? ''}
                      onChange={e => upd('value', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0.00" className="input-base pl-7"/>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Items valued ₱50,000+ will appear in the Vendor Returns tab.</p>
                </div>

                <div className="col-span-2">
                  <MultiImageUploader
                    folder="inventory"
                    urls={form.imageUrls ?? []}
                    onAdd={addImage}
                    onRemove={removeImage}
                    label="Item Photos"
                    maxImages={10}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={3}
                    placeholder="Admin notes about this item..." className="input-base resize-none"/>
                </div>

                <div className="col-span-2">
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setShowSticker(p => !p)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 10V5a2 2 0 012-2z"/>
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Property Sticker Preview</span>
                      </div>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showSticker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {showSticker && (
                      <div className="p-5 bg-white flex flex-col items-center gap-4">
                        <PropertySticker form={form}/>
                        <button type="button" onClick={() => printSticker(form)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                          </svg>
                          Print Sticker
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setModal(null)} disabled={saving} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving||!form.name.trim()||!form.category} className="btn-primary flex-1 py-2.5">
                {saving ? <><Spinner/> Saving...</> : modal==='add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail Modal ── */}
      {modal==='view' && selItem && (() => {
        const imgs = resolveImages(selItem);
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">Item Details</h3>
                    {selItem.isConsumable && (
                      <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Consumable</span>
                    )}
                  </div>
                  {imgs.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{imgs.length} photo{imgs.length !== 1 ? 's' : ''}</p>}
                </div>
                <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                <ImageGallery urls={imgs} onOpenLightbox={idx => openLightbox(imgs, idx)}/>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name"           value={selItem.name}/>
                  <Field label="Category"       value={selItem.category}/>
                  {selItem.subCategory && <Field label="Sub-category" value={selItem.subCategory}/>}
                  <Field label="Asset Type"     value={selItem.isConsumable ? 'Consumable' : selItem.isUnique ? 'Unique Asset' : 'Bulk Item'}/>
                  <Field label="Quantity"       value={selItem.quantity}/>
                  <Field label="Condition"      value={selItem.condition}/>
                  <Field label="Status"         value={selItem.status}/>
                  <Field label="Inventory No."  value={selItem.inventoryNumber}/>
                  {!selItem.isConsumable && <Field label="Serial No." value={selItem.serialNumber}/>}
                  <Field label="Office Owner"   value={selItem.officeOwner}/>
                  <Field label="Date Acquired"  value={selItem.dateAcquired}/>
                  <Field label="Last Inventory" value={selItem.inventoryDate}/>
                  <Field label="Borrowed By"    value={selItem.borrowedBy||'—'}/>
                  <Field label="Item Value"
                    value={selItem.value != null ? `₱${selItem.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}/>
                  {selItem.notes && (
                    <div className="col-span-2 bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                      <p className="text-sm text-gray-800">{selItem.notes}</p>
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Property Sticker</p>
                  <PropertySticker form={{
                    name: selItem.name, category: selItem.category, subCategory: selItem.subCategory ?? '',
                    isUnique: selItem.isUnique, isConsumable: selItem.isConsumable ?? false,
                    quantity: selItem.quantity, condition: selItem.condition, status: selItem.status,
                    inventoryNumber: selItem.inventoryNumber, serialNumber: selItem.serialNumber,
                    officeOwner: selItem.officeOwner, dateAcquired: selItem.dateAcquired,
                    inventoryDate: selItem.inventoryDate, imageUrl: selItem.imageUrl,
                    imageUrls: imgs, value: selItem.value ?? null, notes: selItem.notes,
                  }}/>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
                <button onClick={() => printSticker({
                  name: selItem.name, category: selItem.category, subCategory: selItem.subCategory ?? '',
                  isUnique: selItem.isUnique, isConsumable: selItem.isConsumable ?? false,
                  quantity: selItem.quantity, condition: selItem.condition, status: selItem.status,
                  inventoryNumber: selItem.inventoryNumber, serialNumber: selItem.serialNumber,
                  officeOwner: selItem.officeOwner, dateAcquired: selItem.dateAcquired,
                  inventoryDate: selItem.inventoryDate, imageUrl: selItem.imageUrl,
                  imageUrls: imgs, value: selItem.value ?? null, notes: selItem.notes,
                })} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                  Print Sticker
                </button>
                <button onClick={() => { setModal(null); openEdit(selItem); }} className="btn-primary flex-1 py-2.5">Edit Item</button>
                <button onClick={() => setModal(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete Confirm ── */}
      {delId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Item?</h3>
            <p className="text-sm text-gray-600 mb-1 font-medium">"{delName}"</p>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
            {delErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{delErr}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setDelId(null); setDelErr(null); }} disabled={deleting} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(delId, delName)} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <><Spinner/> Deleting...</> : 'Delete'}
              </button>
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