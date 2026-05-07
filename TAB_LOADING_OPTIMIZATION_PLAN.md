# Tab Loading Optimization Plan
## Lift Firestore Subscriptions to Parent (Option 1)

**Project:** 5CRG Inventory Management System  
**Goal:** Eliminate per-tab loading spinners by moving all Firestore subscriptions to `AdminPage` and passing data down as props.  
**Status:** Pending — polish system before implementing.

---

## Current Problem

Every tab component owns its own Firestore subscription. When a tab mounts, it starts at `loading: true`, fires a fresh `onSnapshot`, and shows a spinner until the first batch of data arrives. When the tab unmounts (user switches tabs), the subscription is torn down. Next visit = spinner again.

```
User clicks "Borrowed Items"
  → BorrowedTab mounts
  → loading = true (spinner shows)
  → subscribeActiveBorrows() fires
  → Firestore responds (~300–800ms)
  → loading = false (data shows)

User clicks "Inventory"
  → BorrowedTab unmounts → subscription torn down
  → InventoryTab mounts
  → loading = true (spinner shows again)
  → subscribeInventory() fires
  → ...repeat
```

---

## Target State

All subscriptions live in `AdminPage` and run for the lifetime of the session. Tabs receive data as props and render immediately on mount.

```
App loads
  → All subscriptions start once in AdminPage
  → Data loads in background

User clicks any tab
  → Tab mounts with data already available
  → No spinner, instant render
```

---

## Files to Change

| File | Change Type | Summary |
|------|-------------|---------|
| `app/admin/adminpage.tsx` | **Major rewrite** | Add all subscription state + effects, pass data as props to each tab |
| `components/admin/DashboardTab.tsx` | **Moderate** | Remove internal subscriptions, accept props |
| `components/admin/BorrowTab.tsx` | **Minor** | Remove `subscribeAvailableInventory`, accept `items` + `loadingItems` as props |
| `components/admin/BorrowedTab.tsx` | **Minor** | Remove `subscribeActiveBorrows`, accept `requests` + `loading` as props |
| `components/admin/ReturnedTab.tsx` | **Minor** | Remove `subscribeReturnedBorrows`, accept `requests` + `loading` as props |
| `components/admin/InventoryTab.tsx` | **Minor** | Remove `subscribeInventory`, accept `items` + `loading` as props |
| `components/admin/HistoryTab.tsx` | **Moderate** | Remove internal borrow subscription; keep `adminHistory` subscription local (it's history-tab-specific) |
| `components/admin/VehicleTab.tsx` | **Minor** | Remove `subscribeVehicles` + `subscribeVehicleExpenses`, accept as props |

> `ProfileTab` does not use real-time inventory/borrow data — no change needed.

---

## Step-by-Step Implementation

### Step 1 — Define shared prop interfaces

Before touching any component, define the prop types that `AdminPage` will pass down. Add these to `lib/types/inventory.ts` or a new `lib/types/props.ts` file.

```typescript
// Suggested addition to lib/types/inventory.ts

export interface SharedInventoryProps {
  items: InventoryItem[];
  loadingInventory: boolean;
}

export interface SharedBorrowProps {
  activeBorrows: BorrowRequest[];
  allBorrows: BorrowRequest[];
  loadingBorrows: boolean;
}

export interface SharedVehicleProps {
  vehicles: Vehicle[];
  expenses: VehicleExpense[];
  loadingVehicles: boolean;
}
```

---

### Step 2 — Update `adminpage.tsx`

Add subscription state and effects. Remove per-tab conditional rendering in favour of prop passing.

**Add state:**
```typescript
// Inventory
const [inventoryItems, setInventoryItems]     = useState<InventoryItem[]>([]);
const [loadingInventory, setLoadingInventory] = useState(true);

// Borrows
const [activeBorrows, setActiveBorrows]   = useState<BorrowRequest[]>([]);
const [allBorrows, setAllBorrows]         = useState<BorrowRequest[]>([]);
const [returnedBorrows, setReturnedBorrows] = useState<BorrowRequest[]>([]);
const [loadingBorrows, setLoadingBorrows] = useState(true);

// Vehicles
const [vehicles, setVehicles]             = useState<Vehicle[]>([]);
const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
const [loadingVehicles, setLoadingVehicles] = useState(true);
```

**Add single useEffect:**
```typescript
useEffect(() => {
  const u1 = subscribeInventory(data => {
    setInventoryItems(data);
    setLoadingInventory(false);
  });
  const u2 = subscribeActiveBorrows(data => {
    setActiveBorrows(data);
    setLoadingBorrows(false);
  });
  const u3 = subscribeAllBorrows(data => setAllBorrows(data));
  const u4 = subscribeReturnedBorrows(data => setReturnedBorrows(data));
  const u5 = subscribeVehicles(data => {
    setVehicles(data);
    setLoadingVehicles(false);
  });
  const u6 = subscribeVehicleExpenses(null, data => setVehicleExpenses(data));

  return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
}, []);
```

**Update `renderTab()`:**
```typescript
function renderTab() {
  switch (activeTab) {
    case 'dashboard':
      return (
        <DashboardTab
          onNavigate={setActiveTab}
          items={inventoryItems}
          borrows={allBorrows}
          vehicles={vehicles}
          vExpenses={vehicleExpenses}
          loading={loadingInventory || loadingBorrows || loadingVehicles}
        />
      );
    case 'borrow':
      return (
        <BorrowTab
          items={inventoryItems.filter(i => i.status === 'Available')}
          loadingItems={loadingInventory}
        />
      );
    case 'borrowed':
      return (
        <BorrowedTab
          requests={activeBorrows}
          loading={loadingBorrows}
        />
      );
    case 'returned':
      return (
        <ReturnedTab
          requests={returnedBorrows}
          loading={loadingBorrows}
        />
      );
    case 'inventory':
      return (
        <InventoryTab
          items={inventoryItems}
          loading={loadingInventory}
        />
      );
    case 'vehicle':
      return (
        <VehicleTab
          vehicles={vehicles}
          expenses={vehicleExpenses}
          loading={loadingVehicles}
        />
      );
    case 'history':
      return (
        <HistoryTab
          allBorrows={allBorrows}
          loadingBorrows={loadingBorrows}
        />
      );
    case 'profile':
      return <ProfileTab />;
  }
}
```

---

### Step 3 — Update `BorrowTab.tsx`

**Remove:**
```typescript
// Remove this entire block
useEffect(() => {
  return subscribeAvailableInventory(data => { 
    setItems(data); 
    setLoading(false); 
  });
}, []);
```

**Update component signature:**
```typescript
// Before
export default function BorrowTab() {
  const [items, setItems]          = useState<InventoryItem[]>([]);
  const [loadingItems, setLoading] = useState(true);

// After
interface Props {
  items: InventoryItem[];
  loadingItems: boolean;
}

export default function BorrowTab({ items, loadingItems }: Props) {
```

**Keep:** The `useEffect` that removes unavailable items from `selected` when `items` changes — this still works correctly since `items` is now a prop that updates in real-time from the parent.

---

### Step 4 — Update `BorrowedTab.tsx`

**Remove:**
```typescript
useEffect(() => {
  return subscribeActiveBorrows(data => { 
    setRequests(data); 
    setLoading(false); 
  });
}, []);
```

**Update component signature:**
```typescript
// Before
export default function BorrowedTab() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading]   = useState(true);

// After
interface Props {
  requests: BorrowRequest[];
  loading: boolean;
}

export default function BorrowedTab({ requests, loading }: Props) {
```

> **Note:** `markReturned` is a write operation — it stays inside `BorrowedTab` as-is. Only the read subscription moves up.

---

### Step 5 — Update `ReturnedTab.tsx`

Same pattern as `BorrowedTab`.

**Remove:**
```typescript
useEffect(() => {
  return subscribeReturnedBorrows(data => { 
    setAll(data); 
    setLoading(false); 
  });
}, []);
```

**Update component signature:**
```typescript
interface Props {
  requests: BorrowRequest[];
  loading: boolean;
}

export default function ReturnedTab({ requests, loading }: Props) {
  // rename: all → requests throughout component
  // or keep internal `all` state and sync from prop:
  // const [all, setAll] = useState(requests);
  // useEffect(() => setAll(requests), [requests]);
```

> **Tip:** The simplest approach is to rename the internal `all` variable to just use `requests` directly from props throughout the component, since the filtering/pagination logic already works on a derived array.

---

### Step 6 — Update `InventoryTab.tsx`

**Remove:**
```typescript
useEffect(() => {
  return subscribeInventory(data => { 
    setItems(data); 
    setLoading(false); 
  });
}, []);
```

**Update component signature:**
```typescript
interface Props {
  items: InventoryItem[];
  loading: boolean;
}

export default function InventoryTab({ items, loading }: Props) {
  // Remove: const [items, setItems] = useState<InventoryItem[]>([]);
  // Remove: const [loading, setLoading] = useState(true);
```

> **Note:** `addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem` are write operations — they stay inside the component. The parent subscription will automatically pick up the changes via Firestore's real-time listener.

---

### Step 7 — Update `HistoryTab.tsx`

`HistoryTab` has two sub-tabs:

- **Borrow Logbook** — uses `subscribeAllBorrows` → **move to parent**
- **Inventory Activity Log** — uses its own `onSnapshot` on `adminHistory` collection → **keep local** (only used here)

**Update `BorrowLogbook` sub-component:**
```typescript
// Before — internal subscription inside BorrowLogbook
useEffect(() => {
  return subscribeAllBorrows(data => { setAll(data); setLoading(false); });
}, []);

// After — receives props from HistoryTab which receives from AdminPage
interface BorrowLogbookProps {
  borrows: BorrowRequest[];
  loading: boolean;
}

function BorrowLogbook({ borrows, loading }: BorrowLogbookProps) {
  // use borrows directly instead of internal `all` state
}
```

**Update `HistoryTab` signature:**
```typescript
interface Props {
  allBorrows: BorrowRequest[];
  loadingBorrows: boolean;
}

export default function HistoryTab({ allBorrows, loadingBorrows }: Props) {
  // Pass these down to BorrowLogbook
}
```

---

### Step 8 — Update `DashboardTab.tsx`

`DashboardTab` currently subscribes to everything internally. Since `AdminPage` will now own all this data, we can remove the internal subscriptions.

**Remove these 4 subscriptions:**
```typescript
// Remove all of these
const unsubBorrows   = subscribeAllBorrows(...);
const unsubInventory = subscribeInventory(...);
const unsubVehicles  = subscribeVehicles(...);
const unsubVExp      = subscribeVehicleExpenses(null, ...);
```

**Update component signature:**
```typescript
interface Props {
  onNavigate: (t: TabId) => void;
  items: InventoryItem[];
  borrows: BorrowRequest[];
  vehicles: Vehicle[];
  vExpenses: VehicleExpense[];
  loading: boolean;
}

export default function DashboardTab({ 
  onNavigate, items, borrows, vehicles, vExpenses, loading 
}: Props) {
  // Remove all useState for these data sets
  // Remove the useEffect with 4 unsubscribes
  // Use props directly
}
```

---

### Step 9 — Update `VehicleTab.tsx`

**Remove:**
```typescript
useEffect(() => {
  const unsub = subscribeVehicles(v => { setVehicles(v); setLoadingV(false); });
  return unsub;
}, []);

useEffect(() => {
  setLoadingE(true);
  const unsub = subscribeVehicleExpenses(null, e => { setExpenses(e); setLoadingE(false); });
  return unsub;
}, []);
```

**Update component signature:**
```typescript
interface Props {
  vehicles: Vehicle[];
  expenses: VehicleExpense[];
  loading: boolean;
}

export default function VehicleTab({ vehicles, expenses, loading }: Props) {
  // Remove: const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Remove: const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  // Remove: const [loadingV, ...] and [loadingE, ...]
  // Replace loadingV || loadingE checks with just loading
```

> **Note:** Write operations (`addVehicle`, `updateVehicle`, etc.) stay inside `VehicleTab`. The `selectedVId` filter state also stays local.

---

## What Stays Local (Do Not Move)

These subscriptions and states should remain inside their respective components:

| Component | Keep Local | Reason |
|-----------|-----------|--------|
| `HistoryTab` → `InventoryActivityLog` | `adminHistory` onSnapshot | Only used in this sub-component |
| `BorrowedTab` | `returning` modal state | UI-only state |
| `InventoryTab` | Modal state, form state, `delId` | UI-only state |
| `VehicleTab` | `selectedVId`, filter state, modal state | UI-only state |
| `ReturnedTab` | `monthFilter`, `condFilter`, pagination | UI-only state |
| `ProfileTab` | All state | Has its own data needs (audit log) |

---

## Potential Issues to Watch

### 1. Available inventory filter for BorrowTab
Currently `subscribeAvailableInventory` filters by `status === 'Available'` at the Firestore query level. After the change, `AdminPage` uses `subscribeInventory` (all items) and filters client-side before passing to `BorrowTab`:

```typescript
// In adminpage.tsx renderTab()
case 'borrow':
  return (
    <BorrowTab
      items={inventoryItems.filter(i => i.status === 'Available')}
      loadingItems={loadingInventory}
    />
  );
```

This is functionally equivalent. The only difference is the full inventory list lives in memory, which is fine for this scale.

### 2. Selected items cleanup in BorrowTab
`BorrowTab` has this effect that removes selected items if they become unavailable:
```typescript
useEffect(() => {
  const ids = new Set(items.map(i => i.id));
  setSelected(prev => prev.filter(s => ids.has(s.item.id)));
}, [items]);
```
This will still work correctly — `items` is now a prop but the effect dependency still triggers when the prop changes.

### 3. ReturnedBorrows subscription
`AdminPage` will subscribe to `subscribeReturnedBorrows` in addition to `subscribeAllBorrows`. These overlap — `allBorrows` contains returned ones too. To avoid the extra subscription, `ReturnedTab` can filter from `allBorrows`:

```typescript
case 'returned':
  return (
    <ReturnedTab
      requests={allBorrows.filter(b => b.status === 'Returned')}
      loading={loadingBorrows}
    />
  );
```

This removes the need for a separate `subscribeReturnedBorrows` call in `AdminPage`.

### 4. DashboardTab loading state
Currently `DashboardTab` shows a full-page spinner while all 4 subscriptions load. After the change, the parent's `loading` prop handles this. The spinner logic in `DashboardTab` becomes:

```typescript
// Before
const loading = loadingBorrows || loadingItems || loadingVehicles || loadingVExp;
if (loading) return <div>Loading dashboard...</div>;

// After — loading comes from props
if (loading) return <div>Loading dashboard...</div>;
```

---

## Testing Checklist

After implementation, verify each of these manually:

- [ ] Dashboard loads instantly on first visit
- [ ] Switching to Borrowed Items tab shows data immediately (no spinner)
- [ ] Switching to Inventory tab shows data immediately
- [ ] Switching to Vehicles tab shows data immediately
- [ ] Switching back to a previously visited tab is instant
- [ ] Borrow tab only shows Available items
- [ ] Selecting an item in Borrow tab, then having it borrowed elsewhere removes it from selection in real-time
- [ ] Marking an item as returned updates Borrowed Items tab immediately
- [ ] Adding an inventory item reflects in Dashboard stats immediately
- [ ] Vehicle expense added in Vehicles tab updates Dashboard vehicle section
- [ ] History → Borrow Logbook shows all borrows without spinner
- [ ] History → Inventory Activity still loads (kept local)
- [ ] Profile tab works unchanged
- [ ] No duplicate Firestore subscriptions (check browser Network tab)

---

## Implementation Order

Do these in sequence to minimize broken states during the work:

1. `lib/types/inventory.ts` — add prop interfaces
2. `app/admin/adminpage.tsx` — add subscriptions + state
3. `components/admin/DashboardTab.tsx` — biggest change, do early to unblock dashboard testing
4. `components/admin/BorrowedTab.tsx` — straightforward
5. `components/admin/ReturnedTab.tsx` — straightforward
6. `components/admin/BorrowTab.tsx` — straightforward
7. `components/admin/InventoryTab.tsx` — straightforward
8. `components/admin/VehicleTab.tsx` — moderate
9. `components/admin/HistoryTab.tsx` — split sub-component props

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Tab switch speed | 300–800ms + spinner | Instant |
| Active Firestore subscriptions | 1–4 (per visible tab) | 5–6 (always, app-wide) |
| Firestore reads on tab switch | Fresh read every switch | Zero — data already in memory |
| Data freshness | Real-time per tab | Real-time app-wide |
| Cold load time | Same | Same (subscriptions start at app mount) |
