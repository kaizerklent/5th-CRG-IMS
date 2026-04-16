'use client';
import { useState, useEffect } from 'react';
import { InventoryItem } from '@/lib/types/inventory';
import { subscribeAvailableInventory, submitBorrowRequest, SelectedBorrowItem } from '@/lib/firebase/firestore';

const CATS = ['All','Camera','Accessories','Cable','Projector','Lighting','Laptop','Audio','Other'];

function Spinner() {
  return <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>;
}

function ImgOrPlaceholder({ url, name }: { url: string|null; name: string }) {
  return url
    ? <img src={url} alt={name} className="w-full h-full object-cover"/>
    : <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>;
}

/** Formats a date string (YYYY-MM-DD) into a readable label like "24 Nov 2008" */
function formatDate(val: string): string {
  if (!val) return '—';
  const d = new Date(val + 'T00:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Property sticker component — mirrors the blue 5th CRG sticker style */
function PropertySticker({ item }: { item: InventoryItem }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 300,
        background: '#1e56b0',
        borderRadius: 10,
        padding: '14px 16px 12px',
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        border: '2px solid #174496',
        margin: '0 auto',
      }}
    >
      {/* Subtle diagonal lines overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05,
        backgroundImage: 'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 10px)',
      }}/>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.6 9h16.8M3.6 15h16.8" strokeLinecap="round" opacity="0.5"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 8, letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 2px' }}>
            5th Civil Relations Group
          </p>
          <p style={{ color: 'white', fontSize: 19, fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
            PROPERTY
          </p>
        </div>
        <div style={{ width: 36 }}/>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.3)', marginBottom: 10 }}/>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Office:', value: item.officeOwner },
          { label: 'Inventory Nr.:', value: item.inventoryNumber },
          { label: 'Date Acquired:', value: formatDate(item.dateAcquired) },
          { label: 'Inventory Date:', value: formatDate(item.inventoryDate) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              color: 'rgba(255,255,255,0.78)', fontSize: 9.5,
              textTransform: 'uppercase', letterSpacing: '0.7px',
              width: 108, flexShrink: 0,
            }}>
              {label}
            </span>
            <div style={{
              flex: 1, background: 'white', borderRadius: 3,
              padding: '3px 8px', minHeight: 22,
            }}>
              <span style={{
                color: value ? '#1a3870' : '#aab4c8',
                fontSize: 11, fontWeight: 600,
                fontFamily: label === 'Inventory Nr.:' ? 'monospace' : 'Arial, sans-serif',
              }}>
                {value || '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 7 }}>
        <p style={{
          color: 'rgba(255,255,255,0.5)', fontSize: 7.5,
          textAlign: 'center', textTransform: 'uppercase',
          letterSpacing: '0.9px', margin: 0,
        }}>
          Tampering of this sticker is punishable by law
        </p>
      </div>
    </div>
  );
}

const COND_COLOR: Record<string, string> = {
  Good: 'bg-green-100 text-green-700',
  Fair: 'bg-yellow-100 text-yellow-700',
  Damaged: 'bg-red-100 text-red-700',
  'Under Repair': 'bg-orange-100 text-orange-700',
};

function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{String(value) || '—'}</p>
    </div>
  );
}

/** Expandable item row with full details + property sticker */
function ItemRow({
  item,
  isSelected,
  onToggle,
  quantity,
  onSetQty,
}: {
  item: InventoryItem;
  isSelected: boolean;
  onToggle: () => void;
  quantity: number;
  onSetQty: (qty: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border-b border-gray-100 transition ${isSelected ? 'bg-purple-50' : 'bg-white'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        {/* Checkbox toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition
            ${isSelected
              ? 'bg-purple-600 border-purple-600'
              : 'border-gray-300 hover:border-purple-400 bg-white'}`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          )}
        </button>

        {/* Thumbnail */}
        <div
          className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
          onClick={onToggle}
        >
          <ImgOrPlaceholder url={item.imageUrl} name={item.name}/>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
          <p className="text-xs text-gray-500">{item.category} • {item.inventoryNumber || 'No inv. no.'}</p>
        </div>

        {/* Qty + status */}
        <div className="text-right flex-shrink-0 mr-1">
          {!item.isUnique && <p className="text-xs text-gray-500 mb-0.5">Qty: {item.quantity}</p>}
          <span className="badge-available">Available</span>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          aria-label={expanded ? 'Collapse item details' : 'Expand item details'}
          aria-expanded={expanded ? 'true' : 'false'}
          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition flex-shrink-0"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4 bg-white">

          {/* Item image (large) */}
          {item.imageUrl && (
            <div className="w-full h-40 rounded-xl overflow-hidden bg-gray-100">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>
            </div>
          )}

          {/* Detail grid */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Item Details</p>
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Category"      value={item.category}/>
              <DetailField label="Asset Type"    value={item.isUnique ? 'Unique Asset' : 'Bulk Item'}/>
              <DetailField label="Quantity"      value={item.quantity}/>
              <DetailField label="Inventory No." value={item.inventoryNumber || '—'}/>
              <DetailField label="Serial No."    value={item.serialNumber || '—'}/>
              <DetailField label="Office Owner"  value={item.officeOwner || '—'}/>
              <DetailField label="Date Acquired" value={formatDate(item.dateAcquired)}/>
              <DetailField label="Last Inventory" value={formatDate(item.inventoryDate)}/>
              <div className="col-span-2 bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-1">Condition</p>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${COND_COLOR[item.condition] || 'bg-gray-100 text-gray-700'}`}>
                  {item.condition}
                </span>
              </div>
              {item.notes && (
                <div className="col-span-2 bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                  <p className="text-sm text-gray-800">{item.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Property Sticker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Property Sticker</p>
            <PropertySticker item={item}/>
          </div>

          {/* Quick-add / qty controls inside panel */}
          <div className="flex items-center gap-3 pt-1">
            {isSelected && !item.isUnique && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-medium">Qty:</span>
                <button
                  type="button"
                  onClick={() => onSetQty(quantity - 1)}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 text-sm flex items-center justify-center hover:bg-gray-50 transition"
                >−</button>
                <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onSetQty(quantity + 1)}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 text-sm flex items-center justify-center hover:bg-gray-50 transition"
                >+</button>
              </div>
            )}
            <button
              type="button"
              onClick={onToggle}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition border
                ${isSelected
                  ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                  : 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700'}`}
            >
              {isSelected ? 'Remove from selection' : 'Add to borrow list'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BorrowTab() {
  const [items, setItems]           = useState<InventoryItem[]>([]);
  const [loadingItems, setLoading]  = useState(true);
  const [search, setSearch]         = useState('');
  const [cat, setCat]               = useState('All');
  const [selected, setSelected]     = useState<SelectedBorrowItem[]>([]);
  const [name, setName]             = useState('');
  const [dept, setDept]             = useState('');
  const [contact, setContact]       = useState('');
  const [borrowDate, setBorrowDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState<string|null>(null);

  useEffect(() => {
    return subscribeAvailableInventory(data => { setItems(data); setLoading(false); });
  }, []);

  // Remove selected items that became unavailable in real-time
  useEffect(() => {
    const ids = new Set(items.map(i => i.id));
    setSelected(prev => prev.filter(s => ids.has(s.item.id)));
  }, [items]);

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return (cat === 'All' || item.category === cat) &&
      (item.name.toLowerCase().includes(q) ||
       item.inventoryNumber.toLowerCase().includes(q) ||
       item.serialNumber.toLowerCase().includes(q));
  });

  const isSelected = (id: string) => selected.some(s => s.item.id === id);
  const getQty     = (id: string) => selected.find(s => s.item.id === id)?.quantity ?? 1;

  function toggle(item: InventoryItem) {
    setSelected(prev => isSelected(item.id)
      ? prev.filter(s => s.item.id !== item.id)
      : [...prev, { item, quantity: 1 }]
    );
  }

  function setQty(itemId: string, qty: number) {
    setSelected(prev => prev.map(s => {
      if (s.item.id !== itemId) return s;
      return { ...s, quantity: Math.min(Math.max(1, qty), s.item.quantity) };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected.length) return;
    setSubmitting(true); setError(null);
    try {
      await submitBorrowRequest(name, dept, contact, selected, borrowDate, returnDate || null, notes);
      setSelected([]); setName(''); setDept(''); setContact('');
      setReturnDate(''); setNotes('');
      setBorrowDate(new Date().toISOString().split('T')[0]);
      setSuccess(true); setTimeout(() => setSuccess(false), 4000);
    } catch { setError('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-5xl space-y-4">
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm font-medium text-green-800">Borrow request submitted successfully!</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* ── Item picker ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Select Item(s)</h3>
              {selected.length > 0 && (
                <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  {selected.length} selected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Click the arrow ↓ on any item to see full details &amp; property sticker.</p>
            <input
              type="text"
              placeholder="Search by name, inventory no., serial no."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base"
            />
            <select
              value={cat}
              onChange={e => setCat(e.target.value)}
              aria-label="Filter by category"
              className="input-base bg-white"
            >
              {CATS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
            </select>
          </div>

          <div className="divide-y-0 max-h-[540px] overflow-y-auto">
            {loadingItems
              ? <div className="py-8 flex items-center justify-center gap-2 text-gray-400 text-sm"><Spinner/>Loading...</div>
              : filtered.length === 0
                ? <p className="text-sm text-gray-500 text-center py-8">No available items found.</p>
                : filtered.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isSelected={isSelected(item.id)}
                    onToggle={() => toggle(item)}
                    quantity={getQty(item.id)}
                    onSetQty={qty => setQty(item.id, qty)}
                  />
                ))
            }
          </div>

          {/* Selected summary strip */}
          {selected.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-3 bg-purple-50">
              <p className="text-xs font-semibold text-purple-700 mb-2">Selected ({selected.length})</p>
              {selected.map(s => (
                <div key={s.item.id} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-gray-700 flex-1 truncate">{s.item.name}</span>
                  {!s.item.isUnique && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQty(s.item.id, s.quantity - 1)}
                        className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-600 text-xs flex items-center justify-center hover:bg-gray-50"
                      >−</button>
                      <span className="text-xs w-5 text-center font-medium">{s.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQty(s.item.id, s.quantity + 1)}
                        className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-600 text-xs flex items-center justify-center hover:bg-gray-50"
                      >+</button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(s.item)}
                    aria-label={`Remove ${s.item.name}`}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Borrower form ── */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Borrower Information</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Juan dela Cruz" className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
              <input type="text" required value={dept} onChange={e => setDept(e.target.value)}
                placeholder="e.g. IT Department" className="input-base"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number <span className="text-red-500">*</span></label>
              <input type="text" required value={contact} onChange={e => setContact(e.target.value)}
                placeholder="e.g. 09171234567" className="input-base"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Borrow Date <span className="text-red-500">*</span></label>
                <input type="date" required value={borrowDate} onChange={e => setBorrowDate(e.target.value)} aria-label="Borrow Date" className="input-base"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date <span className="text-xs text-gray-400 font-normal">(optional)</span>
                </label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} aria-label="Return Date" className="input-base"/>
                {!returnDate && <p className="text-xs text-yellow-600 mt-1">⚠️ No date = yellow flag</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any notes about this borrow..."
                className="input-base resize-none"/>
            </div>
            <button type="submit" disabled={submitting || selected.length === 0} className="btn-primary w-full py-3">
              {submitting
                ? <><Spinner/> Submitting...</>
                : selected.length === 0
                  ? 'Select at least one item'
                  : `Confirm Borrow (${selected.length} item${selected.length > 1 ? 's' : ''})`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}