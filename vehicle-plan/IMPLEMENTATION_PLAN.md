# Vehicle Tab — Implementation Plan

POL Tracker + Usage Log + Vehicle card expand behavior.

---

## Overview

| Phase | What | Files touched |
|---|---|---|
| 1 | Types + Firestore functions | `lib/types/inventory.ts`, `lib/firebase/firestore.ts` |
| 2 | Vehicle card expand behavior | `components/admin/VehicleTab.tsx` |
| 3 | Sub-nav restructure | `components/admin/VehicleTab.tsx` |
| 4 | POL sub-view | `components/admin/VehiclePOL.tsx` (new) |
| 5 | Usage Log sub-view | `components/admin/VehicleUsageLog.tsx` (new) |
| 6 | Cleanup | Multiple files |

---

## New Firestore collections

```
vehiclePOL/{vehicleId}
  └── fuels: {
        Diesel: { balance: number, allocation: number },
        Octane:  { balance: number, allocation: number },
        ...
      }
  └── polHistory/ (subcollection)
        └── {docId}
              type:      'add' | 'dispense'
              fuel:      string
              liters:    number
              note:      string
              date:      string        // YYYY-MM-DD
              balance:   number        // balance AFTER this transaction
              adminName: string
              createdAt: Timestamp

vehicleUsage/{docId}
  vehicleId:   string
  vehicleName: string
  driver:      string
  date:        string                  // YYYY-MM-DD
  destination: string
  purpose:     string
  mileage:     number | null
  adminName:   string
  createdAt:   Timestamp
```

---

## Phase 1 — Types + Firestore functions

**Goal:** Add all new types and Firestore functions. No UI changes. Safe to do first.

### 1a. `lib/types/inventory.ts`

- Remove `assignedDriver` field from `Vehicle` interface
- Add `VehiclePOL` interface
- Add `POLTransaction` interface
- Add `VehicleUsage` interface
- Add `'polTransaction'` to `AdminHistory.action` union

```ts
// Remove from Vehicle:
assignedDriver: string   // ← DELETE THIS

// Add:
export interface VehiclePOL {
  vehicleId: string;
  fuels: {
    [fuelName: string]: {
      balance:    number;
      allocation: number;
    };
  };
}

export interface POLTransaction {
  id:        string;
  type:      'add' | 'dispense';
  fuel:      string;
  liters:    number;
  note:      string;
  date:      string;
  balance:   number;
  adminName: string;
  createdAt: Timestamp | null;
}

export interface VehicleUsage {
  id:          string;
  vehicleId:   string;
  vehicleName: string;
  driver:      string;
  date:        string;
  destination: string;
  purpose:     string;
  mileage:     number | null;
  adminName:   string;
  createdAt:   Timestamp | null;
}
```

### 1b. `lib/firebase/firestore.ts`

Add the following functions:

**POL functions:**
- `subscribeVehiclePOL(vehicleId, cb)` — real-time listener on `vehiclePOL/{vehicleId}`
- `subscribePOLHistory(vehicleId, cb)` — real-time listener on subcollection
- `initVehiclePOL(vehicleId)` — creates the doc if it doesn't exist
- `addPOLFuelType(vehicleId, fuelName, initialLiters, adminName)`
- `removePOLFuelType(vehicleId, fuelName, adminName)`
- `recordPOLTransaction(vehicleId, type, fuelName, liters, note, adminName)` — updates balance + logs to history + writes to adminHistory

**Usage Log functions:**
- `subscribeVehicleUsage(vehicleId | null, cb)` — null = all vehicles
- `addVehicleUsage(data, adminName)`
- `updateVehicleUsage(id, data, adminName)`
- `deleteVehicleUsage(id, vehicleName, adminName)`

**Also update:**
- `addVehicle()` — remove `assignedDriver` from payload
- `updateVehicle()` — remove `assignedDriver` from payload

### 1c. `app/admin/adminpage.tsx`

- Add `vehicleUsage` subscription alongside existing vehicle subscriptions
- Pass `vehicleUsage` down to `VehicleTab`

---

## Phase 2 — Vehicle card expand behavior

**Goal:** Clicking a vehicle card expands it full-width inline. No sub-nav changes yet.

### Changes in `VehicleTab.tsx`

**State changes:**
```ts
// Remove:
const [selectedVId, setSelectedVId] = useState<string | null>(null);

// Add:
const [expandedVId, setExpandedVId] = useState<string | null>(null);
```

**Card grid layout:**
```tsx
// Use CSS grid with special handling for expanded card
<div className="grid grid-cols-2 gap-4">
  {vehicles.map(v =>
    expandedVId === v.id
      ? <ExpandedVehicleCard key={v.id} ... />   // col-span-2
      : <CollapsedVehicleCard key={v.id} ... />
  )}
</div>
```

**Collapsed card:**
- Remove driver field display
- Add Type + Year in the 2-slot meta row
- `onClick` → `setExpandedVId(v.id)`

**Expanded card (col-span-2, full width):**
- Header row: icon + name + plate + badges (same as collapsed)
- 3-column body:
  - Col 1 — Vehicle info (name, plate, type, year, notes)
  - Col 2 — POL summary (fuel balance mini-cards, or "no fuel types" placeholder)
  - Col 3 — Expenses summary (total, this month, record count)
- Action buttons row at bottom:
  - `View Expenses` → `setSubView('expenses')` + filter to this vehicle
  - `View POL` → `setSubView('pol')` + select this vehicle
  - `Log Usage` → open usage log modal pre-filled with this vehicle
  - `Edit` → open edit modal
  - `Delete` → open delete confirm
  - `Collapse ↑` → `setExpandedVId(null)`

---

## Phase 3 — Sub-nav restructure

**Goal:** Update the sub-nav from 3 tabs to 5 tabs.

### Changes in `VehicleTab.tsx`

```ts
// Old:
type SubView = 'overview' | 'expenses' | 'reports';

// New:
type SubView = 'overview' | 'pol' | 'usage' | 'expenses' | 'reports';
```

Update sub-nav render:

```tsx
const TABS: { id: SubView; label: string }[] = [
  { id: 'overview', label: '🚗 Vehicles'  },
  { id: 'pol',      label: '⛽ POL'       },
  { id: 'usage',    label: '🗺️ Usage Log'  },
  { id: 'expenses', label: '📋 Expenses'  },
  { id: 'reports',  label: '📊 Reports'   },
];
```

Update `renderTab()` switch to handle `'pol'` and `'usage'` — both return placeholder `<div>` at this stage. POL and Usage are wired in Phase 4 and 5.

---

## Phase 4 — POL sub-view

**Goal:** Wire the new POL section. Extracted into its own component.

### New file: `components/admin/VehiclePOL.tsx`

Props:
```ts
interface VehiclePOLProps {
  vehicles:   Vehicle[];
  loading:    boolean;
}
```

Internal state (all Firestore subscriptions live inside this component):
- `polData` — map of vehicleId → `VehiclePOL` doc
- `polHistory` — map of vehicleId → `POLTransaction[]`
- `selectedVehicleId` — which vehicle is selected in the switcher
- `txForm` — dispense/topup form state
- `fuelForm` — add fuel type form state

Layout (matches prototype):
1. Vehicle switcher buttons
2. Low fuel alert banner (if any fuel ≤ 20%)
3. Fuel balance cards grid — each card shows balance, allocation, progress bar, Dispense + Top up shortcuts
4. Actions row — 2 cards side by side:
   - "Dispense or top up" form
   - "Manage fuel types" form (add + pill list to remove)
5. Transaction history table

**Key logic:**
- `recordPOLTransaction()` from firestore.ts handles the balance update + history write atomically using `writeBatch`
- Low fuel threshold: 20% — hardcoded, not a setting (can always make it configurable later)
- Top up auto-adjusts allocation ceiling if new balance exceeds it

### Update `VehicleTab.tsx`

- Import `VehiclePOL`
- Pass `vehicles` and `loading` props
- Handle `setSubView('pol')` + pre-select vehicle from expanded card button

---

## Phase 5 — Usage Log sub-view

**Goal:** Wire the Usage Log section. Extracted into its own component.

### New file: `components/admin/VehicleUsageLog.tsx`

Props:
```ts
interface VehicleUsageLogProps {
  vehicles:   Vehicle[];
  usage:      VehicleUsage[];
  loading:    boolean;
}
```

Layout:
1. Toolbar — vehicle filter dropdown + "Log Usage" button
2. Usage log table:
   - Columns: Date · Vehicle · Driver · Destination · Purpose · Mileage · Actions
   - Edit (pencil) + Delete (trash) per row
   - Empty state if no records

**Log Usage modal fields:**
- Vehicle (dropdown, required)
- Driver name (text, required)
- Date (date picker, required, defaults to today)
- Destination (text, required)
- Purpose (text, required)
- Mileage (number, optional, km)

**CRUD:**
- Add → `addVehicleUsage()`
- Edit → `updateVehicleUsage()` — opens same modal pre-filled
- Delete → confirm dialog → `deleteVehicleUsage()`

All writes also log to `adminHistory` with `action: 'add' | 'update' | 'delete'` and details string.

### Update `VehicleTab.tsx`

- Import `VehicleUsageLog`
- Pass `vehicles`, `usage`, `loading` props
- Wire `openUsageModal(vehicleId)` from expanded vehicle card button

---

## Phase 6 — Cleanup

**Goal:** Remove all `driver`/`assignedDriver` references.

### Files to update:

| File | Change |
|---|---|
| `components/admin/VehicleTab.tsx` | Remove `assignedDriver` from add/edit vehicle form |
| `lib/utils/exportXLSX.ts` | Remove `Assigned Driver` column from `exportVehicles()` |
| `components/admin/DashboardTab.tsx` | Remove driver display from vehicle expense table if present |
| `lib/firebase/firestore.ts` | Already handled in Phase 1 |

**Firestore note:** Existing vehicle documents in Firestore will still have `assignedDriver` field — that's fine, Firestore ignores extra fields. No migration needed.

---

## Component file structure after all phases

```
components/admin/
  VehicleTab.tsx          — shell, sub-nav, shared state, card grid
  VehicleOverview.tsx     — collapsed + expanded card components
  VehiclePOL.tsx          — POL tracker section (new)
  VehicleUsageLog.tsx     — usage log section (new)
```

---

## Composite Firestore indexes needed

```
vehicleUsage: vehicleId ASC + createdAt DESC
vehicleUsage: createdAt DESC (for all-vehicles view)
polHistory (subcollection): createdAt DESC
```

Add these to `firestore.indexes.json` before deploying Phase 4 and 5, otherwise Firestore will throw on the ordered queries.

---

## Checklist

### Phase 1
- [ ] Remove `assignedDriver` from `Vehicle` type
- [ ] Add `VehiclePOL`, `POLTransaction`, `VehicleUsage` types
- [ ] Add POL Firestore functions
- [ ] Add Usage Log Firestore functions
- [ ] Update `addVehicle` / `updateVehicle` to drop driver field
- [ ] Subscribe to `vehicleUsage` in `adminpage.tsx`

### Phase 2
- [ ] Replace `selectedVId` with `expandedVId` state
- [ ] Build `CollapsedVehicleCard` component
- [ ] Build `ExpandedVehicleCard` component (3-col layout)
- [ ] Wire expand/collapse on click
- [ ] Wire action buttons (View Expenses, View POL, Log Usage, Edit, Delete, Collapse)

### Phase 3
- [ ] Update `SubView` type to 5 options
- [ ] Update sub-nav render
- [ ] Add placeholder cases in `renderTab()` for `pol` and `usage`

### Phase 4
- [ ] Create `VehiclePOL.tsx`
- [ ] Vehicle switcher
- [ ] Low fuel alert
- [ ] Fuel balance cards
- [ ] Dispense / top up form
- [ ] Manage fuel types form
- [ ] Transaction history
- [ ] Wire into `VehicleTab.tsx`

### Phase 5
- [ ] Create `VehicleUsageLog.tsx`
- [ ] Usage log table with filter
- [ ] Log Usage modal (add + edit)
- [ ] Delete confirm
- [ ] Wire into `VehicleTab.tsx`
- [ ] Wire "Log Usage" from expanded vehicle card

### Phase 6
- [ ] Remove driver from vehicle form
- [ ] Remove driver from export
- [ ] Final review — search codebase for `assignedDriver` and `driver` references

---

## Prototype reference files

The following files are the working HTML/CSS/JS prototype for the Vehicle tab redesign. Open `pol-tracker.html` in any browser to see and interact with the full prototype before and during implementation.

```
pol-tracker.html   — Entry point. Open this in a browser to run the prototype.
pol-tracker.css    — All styles. DM Sans + DM Mono via Google Fonts.
pol-tracker.js     — All logic. Vanilla JS, no dependencies.
```

> All three files must be in the same folder for the prototype to work.

### What the prototype covers

| Section | Prototype tab | Notes |
|---|---|---|
| Vehicle card grid (collapsed + expanded) | 🚗 Vehicles | Click any card to expand. All 5 action buttons work. |
| POL tracker | ⛽ POL | Fuel cards, dispense/topup form, manage fuel types, history |
| Usage log | 🗺️ Usage Log | Table, Log Usage modal, edit and delete per row |
| Expenses | 📋 Expenses | Table with vehicle filter |
| Reports | 📊 Reports | Summary stats, breakdown charts |

### Key logic to carry over from prototype to real code

- **Card expand** — `toggleExpand(id)` in `pol-tracker.js`. Expanded card uses `grid-column: 1 / -1` (full width). Only one card expanded at a time.
- **POL transaction** — `doPolTransaction()`. Validates liters > 0 and liters ≤ balance for dispense. Top up auto-adjusts allocation ceiling if new balance exceeds it.
- **Low fuel threshold** — 20%. Fires warning banner and sidebar badge when any fuel type drops to or below 20% of allocation.
- **Usage modal** — same form for add and edit. `saveUsage()` handles both modes via `S.usageModal.mode`.
- **Cross-tab navigation** — "View Expenses", "View POL", and "Log Usage" buttons in the expanded card pre-select the vehicle in their respective tabs before switching the sub-nav.
