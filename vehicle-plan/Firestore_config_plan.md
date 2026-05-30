# Firestore Configuration — Vehicle Tab Update
### 5CRG Inventory Management System

This document covers all Firestore changes required before the new Vehicle Tab features (POL Tracker and Usage Log) can go live.

Hand this to whoever manages the Firebase project. All steps are done in the **Firebase Console** — no CLI required.

---

## 1. New Collections

Two new collections need to be created. Firestore creates them automatically on first write, but the indexes and rules below must be configured **before** the app goes live.

### `vehiclePOL`

One document per vehicle. Stores the current fuel allocation state.

```
vehiclePOL/
  {vehicleId}/                          ← document ID = the vehicle's Firestore ID
    fuels: {
      "Diesel": {
        balance:    number              ← current liters remaining
        allocation: number              ← ceiling / total allocated
      },
      "Octane": {
        balance:    number
        allocation: number
      }
      // ... any custom fuel types the user adds
    }

    polHistory/                         ← subcollection
      {auto-id}/
        type:      string               ← "add" | "dispense"
        fuel:      string               ← e.g. "Diesel"
        liters:    number
        note:      string
        date:      string               ← YYYY-MM-DD
        balance:   number               ← balance AFTER this transaction
        adminName: string
        createdAt: Timestamp
```

### `vehicleUsage`

Flat collection. One document per trip/usage entry.

```
vehicleUsage/
  {auto-id}/
    vehicleId:   string                 ← reference to vehicles/{id}
    vehicleName: string                 ← snapshot for display
    driver:      string                 ← free text, whoever drove
    date:        string                 ← YYYY-MM-DD
    destination: string
    purpose:     string
    mileage:     number | null          ← optional, km
    adminName:   string
    createdAt:   Timestamp
```

---

## 2. Security Rules

Open the Firebase Console → **Firestore Database** → **Rules** tab.

Add the following rules inside the existing `match /databases/{database}/documents` block, alongside your current rules.

```js
// ── Vehicle POL ────────────────────────────────────────────────────────────
match /vehiclePOL/{vehicleId} {
  allow read, write: if request.auth != null;

  match /polHistory/{historyId} {
    allow read, write: if request.auth != null;
  }
}

// ── Vehicle Usage Log ──────────────────────────────────────────────────────
match /vehicleUsage/{usageId} {
  allow read, write: if request.auth != null;
}
```

### What these rules do

- Only authenticated users (admins who are logged in) can read or write these collections
- Same pattern as your existing `inventory`, `borrowRequests`, and `adminHistory` rules
- The `polHistory` subcollection rule is nested inside `vehiclePOL` — both need their own `match` block

### Full rules file for reference

Your complete `firestore.rules` should look like this after adding the new rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Existing collections
    match /inventory/{itemId} {
      allow read, write: if request.auth != null;
    }
    match /borrowRequests/{requestId} {
      allow read, write: if request.auth != null;
    }
    match /adminHistory/{logId} {
      allow read, write: if request.auth != null;
    }
    match /vehicles/{vehicleId} {
      allow read, write: if request.auth != null;
    }
    match /vehicleExpenses/{expenseId} {
      allow read, write: if request.auth != null;
    }
    match /categories/{categoryId} {
      allow read, write: if request.auth != null;
    }
    match /vendorReturns/{returnId} {
      allow read, write: if request.auth != null;
    }

    // ── NEW: Vehicle POL ───────────────────────────────────────────────────
    match /vehiclePOL/{vehicleId} {
      allow read, write: if request.auth != null;

      match /polHistory/{historyId} {
        allow read, write: if request.auth != null;
      }
    }

    // ── NEW: Vehicle Usage Log ─────────────────────────────────────────────
    match /vehicleUsage/{usageId} {
      allow read, write: if request.auth != null;
    }

  }
}
```

> **Note:** If your existing rules file looks different from the above, only add the two NEW blocks marked above. Do not replace your existing rules.

---

## 3. Composite Indexes

Firestore requires composite indexes for queries that filter AND order by different fields. Without these, the app will throw a runtime error when it tries to load the new data.

Go to Firebase Console → **Firestore Database** → **Indexes** tab → **Composite** tab → **Add index**.

### Index 1 — vehicleUsage by vehicle, sorted by date

| Field | | |
|---|---|---|
| Collection | `vehicleUsage` | |
| Field 1 | `vehicleId` | Ascending |
| Field 2 | `createdAt` | Descending |
| Query scope | Collection | |

**Used for:** Loading usage log filtered to a specific vehicle, newest first.

---

### Index 2 — vehicleUsage all vehicles, sorted by date

| Field | | |
|---|---|---|
| Collection | `vehicleUsage` | |
| Field 1 | `createdAt` | Descending |
| Query scope | Collection | |

> This is a single-field index. Firestore usually creates single-field indexes automatically, but it's listed here for completeness. If it already exists, skip it.

---

### Index 3 — polHistory sorted by date (subcollection)

| Field | | |
|---|---|---|
| Collection | `polHistory` | |
| Field 1 | `createdAt` | Descending |
| Query scope | Collection group |

**Used for:** Loading POL transaction history for a vehicle, newest first.

> Set scope to **Collection group** (not Collection) because `polHistory` is a subcollection under `vehiclePOL`.

---

### How to add an index in the Firebase Console (step by step)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **Firestore Database** in the left sidebar
4. Click the **Indexes** tab at the top
5. Click the **Composite** tab
6. Click **Add index**
7. Fill in the Collection ID and fields exactly as shown in the tables above
8. Click **Create**
9. Wait for the index to finish building (status changes from "Building" to a green checkmark — can take 1–5 minutes)

> **Important:** The app will throw a Firestore error if you try to use the new features before the indexes finish building. Deploy the new code only after all three indexes show a green checkmark.

---

## 4. Verification checklist

Before going live with the new Vehicle Tab features, confirm the following in the Firebase Console:

- [ ] Security rules updated and published (Rules tab shows the new `vehiclePOL` and `vehicleUsage` blocks)
- [ ] Index 1 — `vehicleUsage` (vehicleId + createdAt) — status: **Enabled**
- [ ] Index 2 — `vehicleUsage` (createdAt) — status: **Enabled**
- [ ] Index 3 — `polHistory` collection group (createdAt) — status: **Enabled**
- [ ] Test login with an admin account — confirm no permission errors in the browser console

---

## 5. Notes for the developer

- Firestore creates the `vehiclePOL` and `vehicleUsage` collections automatically on the first write. You do not need to manually create them in the console.
- The `vehiclePOL/{vehicleId}` document is created the first time an admin adds a fuel type to a vehicle. Until then, the document simply does not exist — the app handles this gracefully by showing an empty state.
- Existing `vehicles` documents in Firestore still have the old `assignedDriver` field. This is harmless — Firestore ignores extra fields that are no longer used by the app. No data migration is needed.
- All new writes also log to the existing `adminHistory` collection, so the audit log in the Profile tab will automatically include POL and usage log activity.