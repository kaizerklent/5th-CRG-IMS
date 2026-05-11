# Turned In Feature — Implementation Plan

**Project:** 5CRG Inventory Management System  
**Document Type:** Feature Implementation Plan  
**Status:** Planning — Revised  

---

## Overview

"Turned In" is a direct inventory action. An admin can mark any inventory item as Turned In at any time — meaning the local office is sending the item back to central storage. This is a free action with no conditions (no value threshold, no damage requirement). The item is removed from active inventory and a permanent record is kept in the admin history log.

This action is **not tied to a borrow or return record.** It lives entirely within the Inventory tab.

---

## Lifecycle

```
Item exists in Inventory tab
         ↓
Admin clicks "Turn In" on the item row
         ↓
Confirm modal opens (notes field)
         ↓
Admin confirms
         ↓
Item deleted from Inventory
adminHistory record written: action = 'turnedIn'
         ↓
Turned In sub-section in Inventory tab updates in real-time
History → Inventory Activity Log shows "Turned In" badge
```

---

## What Does NOT Change

- `BorrowRequest` type — no new fields
- `ReturnedTab` — no changes
- `BorrowedTab` — no changes
- `DashboardTab` — no changes
- Firestore indexes on `borrowRequests` — no changes

---

## Data Changes

### `InventoryItem` — New Field

Add a `value` field for reference and categorization. Does **not** gate the Turn In action.

```typescript
// lib/types/inventory.ts

export interface InventoryItem {
  // ... existing fields ...
  value: number | null;  // Peso value of the item (optional, for reference)
}
```

### `AdminHistory` — New Action Type

Extend the `action` field to include `'turnedIn'` as a distinct action type, separate from `'delete'`. This allows the History tab to display and filter Turned In events independently.

```typescript
// lib/types/inventory.ts

export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'turnedIn';  // ← 'turnedIn' is new
  itemId: string;
  itemName: string;
  adminName: string;
  details: string;
  timestamp: any;
}
```

---

## Files to Change

| File | Change Type | Summary |
|------|-------------|---------|
| `lib/types/inventory.ts` | **Trivial** | Add `value` to `InventoryItem`, add `'turnedIn'` to `AdminHistory` action union |
| `lib/firebase/firestore.ts` | **Low** | Add `markTurnedIn()` function |
| `components/admin/InventoryTab.tsx` | **Medium** | Add `value` field to Add/Edit modal and View modal, Turn In button in table row, Turn In confirm modal, Turned In sub-section |
| `components/admin/HistoryTab.tsx` | **Trivial** | Add `turnedIn` to `ACTION_STYLES`, add to filter dropdown and legend |

---

## Step-by-Step Implementation

---

### Step 1 — Update Types (`lib/types/inventory.ts`)

**Add `value` to `InventoryItem`:**

```typescript
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  isUnique: boolean;
  quantity: number;
  condition: string;
  status: string;
  inventoryNumber: string;
  serialNumber: string;
  officeOwner: string;
  dateAcquired: string;
  inventoryDate: string;
  imageUrl: string | null;
  imageUrls: string[];
  notes: string;
  value: number | null;           // ← NEW: peso value for reference
  borrowedBy?: string | null;
  borrowRequestId?: string | null;
  createdAt?: any;
}
```

**Update `AdminHistory` action union:**

```typescript
export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'turnedIn';  // ← 'turnedIn' added
  itemId: string;
  itemName: string;
  adminName: string;
  details: string;
  timestamp: any;
}
```

---

### Step 2 — Add `markTurnedIn()` to Firestore (`lib/firebase/firestore.ts`)

This function does two things:
1. Deletes the inventory item document
2. Logs the action to `adminHistory` with `action: 'turnedIn'`

```typescript
export async function markTurnedIn(
  item: InventoryItem,
  turnInNotes: string,
  adminName: string
): Promise<void> {
  // Guard: block if item is currently borrowed
  if (item.borrowedBy) {
    throw new Error(`"${item.name}" is currently borrowed by ${item.borrowedBy}. It must be returned before it can be turned in.`);
  }

  // 1. Delete the inventory item
  await deleteDoc(doc(db, 'inventory', item.id));

  // 2. Log to adminHistory with distinct 'turnedIn' action
  await logHistory({
    action: 'turnedIn',
    itemId: item.id,
    itemName: item.name,
    adminName,
    details: `Turned In: ${item.name}${item.inventoryNumber ? ` (${item.inventoryNumber})` : ''} — sent to central storage.${turnInNotes ? ` Notes: ${turnInNotes}` : ''}`,
  });
}
```

> **Note:** No `writeBatch` needed — it's a delete + history log. The guard prevents turning in items that are currently out with a borrower.

---

### Step 3 — Update InventoryTab (`components/admin/InventoryTab.tsx`)

Four sub-tasks.

---

#### 3a — Add `value` to `EMPTY` and form state

```typescript
const EMPTY: FormData = {
  name: '', category: '', isUnique: false, quantity: 1,
  condition: 'Good', status: 'Available',
  inventoryNumber: '', serialNumber: '', officeOwner: '',
  dateAcquired: '', inventoryDate: '',
  imageUrl: null, imageUrls: [],
  notes: '',
  value: null,    // ← ADD
};
```

Since `FormData` is derived from `InventoryItem` via `Omit`, adding `value` to the interface automatically includes it.

Also update `openEdit` to pre-populate `value`:

```typescript
function openEdit(item: InventoryItem) {
  const imgs = resolveImages(item);
  setForm({
    // ... existing fields ...
    value: item.value ?? null,   // ← ADD
  });
  // ...
}
```

---

#### 3b — Add `value` Field to Add/Edit Modal and View Modal

**In the Add/Edit modal** — add after the Notes field:

```tsx
<div className="col-span-2">
  <label htmlFor="field-value" className="block text-sm font-medium text-gray-700 mb-1">
    Item Value
    <span className="text-xs text-gray-400 font-normal ml-1">(optional — for reference)</span>
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none">₱</span>
    <input
      id="field-value"
      type="number"
      min={0}
      step={0.01}
      value={form.value ?? ''}
      onChange={e => upd('value', e.target.value ? parseFloat(e.target.value) : null)}
      placeholder="0.00"
      className="input-base pl-7"
    />
  </div>
  <p className="text-xs text-gray-400 mt-1">
    For reference and categorization only. Does not affect borrowing rules.
  </p>
</div>
```

**In the View modal** — add to the Field grid:

```tsx
<Field
  label="Item Value"
  value={selItem.value
    ? `₱${selItem.value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
  }
/>
```

---

#### 3c — Add Turn In Button + Confirm Modal

**Add state to `InventoryTab`:**

```typescript
const [turningIn, setTurningIn] = useState<InventoryItem | null>(null);
```

**Add `markTurnedIn` to imports:**

```typescript
import {
  subscribeInventory, addInventoryItem,
  updateInventoryItem, deleteInventoryItem,
  markTurnedIn,                              // ← ADD
} from '@/lib/firebase/firestore';
```

**Add Turn In button to the table row actions** — after the Delete button:

```tsx
<button
  onClick={() => setTurningIn(item)}
  title="Turn In to Storage"
  className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
>
  <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v6m4-6v6"/>
  </svg>
</button>
```

**Add `TurnInModal` component** above the main `InventoryTab` export:

```tsx
function TurnInModal({
  item,
  onClose,
  onConfirm,
}: {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v6m4-6v6"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Turn In to Storage</h3>
          </div>
          <p className="text-sm text-gray-500 ml-12">{item.name}</p>
          {item.inventoryNumber && (
            <p className="text-xs text-gray-400 ml-12 font-mono mt-0.5">{item.inventoryNumber}</p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {err && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>
          )}

          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-orange-800">
                This will remove the item from inventory.
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                The item will be sent to central storage and will no longer appear
                in the active inventory list. A record will be kept in History.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason / Notes
              <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Worn out after long use, sent for repair, returning to central office..."
              className="input-base resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={busy} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true); setErr(null);
              try { await onConfirm(notes); }
              catch (e: any) { setErr(e?.message || 'Failed to turn in. Please try again.'); setBusy(false); }
            }}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {busy ? <><Spinner/> Processing...</> : 'Confirm Turn In'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Render the modal at the bottom of `InventoryTab`:**

```tsx
{turningIn && (
  <TurnInModal
    item={turningIn}
    onClose={() => setTurningIn(null)}
    onConfirm={async (notes) => {
      await markTurnedIn(turningIn, notes, adminName);
      setTurningIn(null);
    }}
  />
)}
```

---

#### 3d — Add `TurnedInSection` Sub-Component

Define this above the main `InventoryTab` export. It has its own `onSnapshot` listener scoped to `action === 'turnedIn'`.

**Add required imports to `InventoryTab.tsx`:**

```typescript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { AdminHistory } from '@/lib/types/inventory';
```

**The component:**

```tsx
function TurnedInSection() {
  const [logs, setLogs]       = useState<AdminHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'adminHistory'),
      where('action', '==', 'turnedIn'),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminHistory)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function fmtTs(ts: any): string {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="card overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v6m4-6v6"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Turned In to Storage</h3>
            <p className="text-xs text-gray-400">Items sent to central storage — removed from active inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {logs.length} item{logs.length !== 1 ? 's' : ''}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <span className="text-sm">Loading...</span>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No items have been turned in yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-orange-50/40">
                    {['Item Name', 'Details', 'Turned In By', 'Date & Time'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition">
                      <td className="px-5 py-4 font-medium text-gray-800">{log.itemName}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs max-w-[300px]">
                        <p className="truncate">{log.details}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{log.adminName}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">{fmtTs(log.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Render `TurnedInSection` at the bottom of `InventoryTab` return:**

```tsx
return (
  <div className="w-full space-y-4">
    {/* toolbar */}
    {/* main table card */}
    {/* modals (add/edit/view/delete) */}
    {/* lightbox */}

    <TurnedInSection />    {/* ← ADD */}

    {turningIn && (
      <TurnInModal
        item={turningIn}
        onClose={() => setTurningIn(null)}
        onConfirm={async (notes) => {
          await markTurnedIn(turningIn, notes, adminName);
          setTurningIn(null);
        }}
      />
    )}
  </div>
);
```

---

### Step 4 — Update HistoryTab (`components/admin/HistoryTab.tsx`)

**Add `turnedIn` to `ACTION_STYLES`:**

```typescript
const ACTION_STYLES: Record<string, { badge: string; icon: string; iconPath: string }> = {
  add:      { badge: 'bg-green-100 text-green-700',   icon: 'text-green-600',  iconPath: 'M12 4v16m8-8H4' },
  update:   { badge: 'bg-blue-100 text-blue-700',     icon: 'text-blue-600',   iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  delete:   { badge: 'bg-red-100 text-red-700',       icon: 'text-red-600',    iconPath: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  turnedIn: { badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-600', iconPath: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v6m4-6v6' },  // ← NEW
};
```

**Update `actionFilter` type:**

```typescript
const [actionFilter, setActionFilter] = useState<'all' | 'add' | 'update' | 'delete' | 'turnedIn'>('all');
```

**Update the filter dropdown:**

```tsx
<select value={actionFilter} onChange={e => { setActionFilter(e.target.value as any); setPage(1); }} className="input-base bg-white w-auto">
  <option value="all">All Actions</option>
  <option value="add">Added</option>
  <option value="update">Updated</option>
  <option value="delete">Deleted</option>
  <option value="turnedIn">Turned In</option>   {/* ← ADD */}
</select>
```

**Update the legend badges in the table header:**

```tsx
{(['add', 'update', 'delete', 'turnedIn'] as const).map(a => {
  const s = ACTION_STYLES[a];
  return (
    <span key={a} className={`px-2.5 py-0.5 rounded-full font-semibold capitalize ${s.badge}`}>
      {a === 'turnedIn' ? 'Turned In' : a}
    </span>
  );
})}
```

---

## Firestore Index Requirements

The `TurnedInSection` uses this query which requires a composite index:

```typescript
query(
  collection(db, 'adminHistory'),
  where('action', '==', 'turnedIn'),
  orderBy('timestamp', 'desc')
)
```

| Collection | Field | Order |
|------------|-------|-------|
| `adminHistory` | `action` | Ascending |
| `adminHistory` | `timestamp` | Descending |

> Add this in Firebase Console → Firestore → Indexes → Composite → Add index. Firestore will also provide a direct creation link in the browser console when the query first runs in development.

---

## Implementation Order

| Order | Step | File | Effort |
|-------|------|------|--------|
| 1 | Add types | `lib/types/inventory.ts` | Trivial |
| 2 | Add `markTurnedIn()` | `lib/firebase/firestore.ts` | Low |
| 3a | Add `value` to `EMPTY` + `openEdit` | `components/admin/InventoryTab.tsx` | Trivial |
| 3b | Add `value` field to Add/Edit + View modal | `components/admin/InventoryTab.tsx` | Low |
| 3c | Add Turn In button + `TurnInModal` | `components/admin/InventoryTab.tsx` | Medium |
| 3d | Add `TurnedInSection` sub-component | `components/admin/InventoryTab.tsx` | Medium |
| 4 | Add `turnedIn` to `ACTION_STYLES` + filter | `components/admin/HistoryTab.tsx` | Trivial |

---

## Testing Checklist

**Value field:**
- [ ] `value` field saves correctly when adding a new inventory item
- [ ] `value` field pre-populates when editing an existing item
- [ ] Items without a value show `—` in the View modal
- [ ] Peso symbol `₱` displays correctly as an input prefix
- [ ] Setting value to blank saves `null` (not `0`)

**Turn In action:**
- [ ] Turn In button (orange box icon) appears on every inventory row
- [ ] Clicking Turn In opens the confirm modal with correct item name and inventory number
- [ ] Orange warning banner is clearly visible in the modal
- [ ] Notes field saves correctly when text is entered
- [ ] Notes field saves as part of the `details` string in `adminHistory`
- [ ] Confirming Turn In removes the item from the Inventory table immediately
- [ ] Cancelling Turn In does nothing — item remains in inventory
- [ ] Attempting to turn in a currently borrowed item shows a clear error message in the modal

**Turned In sub-section:**
- [ ] Sub-section is collapsed by default
- [ ] Record count badge is visible in the collapsed header
- [ ] Expanding shows all turned-in records
- [ ] Record count updates in real-time immediately after a Turn In
- [ ] Item name, details, admin name, and timestamp display correctly
- [ ] Details column shows the notes when provided
- [ ] Empty state ("No items have been turned in yet") shows correctly

**History tab — Inventory Activity Log:**
- [ ] Turned In records show orange "Turned In" badge (not red "delete")
- [ ] "Turned In" option appears in the Action Type filter dropdown
- [ ] Filtering by "Turned In" shows only those records
- [ ] The details string reads "Turned In: [name] — sent to central storage"
- [ ] Legend badges row includes the orange Turned In badge

**Edge cases:**
- [ ] Old inventory items without a `value` field load without errors (treated as `null`)
- [ ] Old `adminHistory` records with `action: 'delete'` are unaffected and still show red

---

## Notes

- **No migration needed.** Old `InventoryItem` records without `value` read as `undefined` — treated as `null` in the UI (display `—`).
- **No changes to `BorrowRequest`** or any borrow-related tabs. Turned In is purely an inventory action.
- **Orange** is used consistently for all Turned In UI to distinguish from green (available), red (delete/unavailable), and blue (update).
- **`TurnedInSection`** uses its own `onSnapshot` scoped to `action === 'turnedIn'` — self-contained, no prop drilling from the parent.
- **Guard in `markTurnedIn`** prevents turning in an item that is currently borrowed. The error message surfaces cleanly inside the `TurnInModal` error state.
