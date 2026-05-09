# 5CRG IMS — Feature Scaling Plan

**Project:** 5th Civil Relations Group Inventory Management System  
**Document Type:** Phased Feature Implementation Plan  
**Status:** Planning

---

## Overview

This document outlines the implementation plan for three upcoming features, broken into discrete phases with clear file targets, implementation steps, and testing checklists. Each phase is self-contained and can be implemented and tested independently before moving to the next.

---

## Feature A — Multiple Images per Inventory Item

**Goal:** Replace the single `imageUrl` field with a multi-image gallery per inventory item. Admins can upload, reorder-by-position, and remove individual photos. The first photo serves as the table thumbnail.

**Backward Compatibility:** The old `imageUrl: string | null` field is kept on all existing records and is read as a fallback. New records will write to `imageUrls: string[]` only.

---

### Phase A1 — Type & Firestore Schema

**Files to change:**
- `lib/types/inventory.ts`
- `lib/firebase/firestore.ts`

**Steps:**

1. In `lib/types/inventory.ts`, add `imageUrls?: string[]` to `InventoryItem` interface alongside the existing `imageUrl: string | null`.

2. In `lib/firebase/firestore.ts`, update `addInventoryItem` and `updateInventoryItem` to write `imageUrls` as the primary field. No migration needed — old records without `imageUrls` will fall back to `imageUrl` at read time.

3. Add a helper function `resolveImages(item: InventoryItem): string[]` to `firestore.ts` or a new `lib/utils/images.ts`:
```typescript
export function resolveImages(item: InventoryItem): string[] {
  if (item.imageUrls && item.imageUrls.length > 0) return item.imageUrls;
  if (item.imageUrl) return [item.imageUrl];
  return [];
}
```

**Testing checklist:**
- [ ] TypeScript compiles without errors after type change
- [ ] Old inventory records without `imageUrls` still display correctly using `imageUrl` fallback
- [ ] New records written to Firestore contain `imageUrls` array

---

### Phase A2 — Multi-Image Uploader Component

**Files to change:**
- `components/admin/ImageUploader.tsx` (extend, or create new `MultiImageUploader.tsx`)

**Steps:**

1. Create a new component `MultiImageUploader` (either in the same file or a new `MultiImageUploader.tsx`) that accepts:
```typescript
interface Props {
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  folder: UploadFolder;
  label?: string;
}
```

2. The component renders:
   - A responsive grid of existing uploaded images (3 columns), each with a remove button on hover
   - A drag-and-drop drop zone below the grid for adding more images
   - Upload progress bar during upload
   - A badge on each thumbnail showing `#1`, `#2`, etc. (first = primary/thumbnail)
   - A lightbox for full-size preview when clicking a thumbnail

3. Reuse the existing `uploadToCloudinary` logic from `lib/cloudinary.ts` — no changes needed there.

4. Keep the existing single `ImageUploader` component untouched — it is still used in `BorrowedTab` for damage photos.

**Testing checklist:**
- [ ] Can upload a first image — displays in grid
- [ ] Can upload additional images — all display in grid
- [ ] Remove button works per image — remaining images shift correctly
- [ ] Drop zone still works after images are already uploaded
- [ ] Lightbox opens on click, closes on backdrop click or Escape key
- [ ] Upload progress bar appears and completes correctly
- [ ] Component handles upload errors with a visible error message

---

### Phase A3 — InventoryTab Integration

**Files to change:**
- `components/admin/InventoryTab.tsx`

**Steps:**

1. Replace the single `ImageUploader` in the Add/Edit modal with `MultiImageUploader`.

2. Update `form` state: change `imageUrl: string | null` to `imageUrls: string[]` in `FormData` type and `EMPTY` default.

3. Update `upd()` helper calls accordingly.

4. In the inventory **table row**, update the thumbnail cell to read `resolveImages(item)[0] ?? null` as the thumbnail source.

5. In the **View Details modal**, replace the single large image with a gallery carousel:
   - If 1 image: show full-width, same as before
   - If 2+ images: show a carousel with prev/next arrows and dot indicators
   - Click any image to open the existing lightbox

6. In the **Property Sticker** section — no change needed, sticker does not show photos.

**Testing checklist:**
- [ ] Add Item modal shows `MultiImageUploader` with empty state
- [ ] Edit Item modal pre-populates existing images (both old `imageUrl` and new `imageUrls` records)
- [ ] Table thumbnail shows first image correctly
- [ ] Table thumbnail shows placeholder icon when no images
- [ ] View modal shows single image correctly for single-image items
- [ ] View modal shows carousel for multi-image items
- [ ] Carousel arrows and dots work
- [ ] Lightbox opens from carousel
- [ ] Saving an edited item with added/removed images persists correctly to Firestore

---

### Phase A4 — BorrowTab Integration

**Files to change:**
- `components/admin/BorrowTab.tsx`

**Steps:**

1. In the `ItemRow` expanded detail panel, update the image display to use `resolveImages(item)` and show a simple carousel if multiple images exist.

2. The existing single-image display in the collapsed row thumbnail remains unchanged (shows first image only).

**Testing checklist:**
- [ ] Expanded item row shows carousel when item has multiple images
- [ ] Carousel is navigable with prev/next arrows
- [ ] Single-image items show no carousel controls

---

## Feature B — Custom Categories

**Goal:** Admins can create and delete their own item categories stored in Firestore. Categories are shared across all admin sessions. Default categories are pre-seeded on first load if none exist. A dedicated management UI lives inside the Inventory tab.

---

### Phase B1 — Type & Firestore Layer

**Files to change:**
- `lib/types/inventory.ts`
- `lib/firebase/firestore.ts`

**Steps:**

1. In `lib/types/inventory.ts`, add the `CustomCategory` interface:
```typescript
export interface CustomCategory {
  id: string;
  name: string;
  createdAt: Timestamp | null;
}
```

2. In `lib/firebase/firestore.ts`, add these functions:

```typescript
// Subscribe to categories — real-time
export function subscribeCategories(
  cb: (cats: CustomCategory[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'categories'), orderBy('name', 'asc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() } as CustomCategory)))
  );
}

// Add a new category
export async function addCategory(
  name: string,
  adminName: string
): Promise<string> { ... }

// Delete a category
export async function deleteCategory(
  id: string,
  name: string,
  adminName: string
): Promise<void> { ... }

// Seed defaults if collection is empty
export async function seedDefaultCategories(): Promise<void> { ... }
```

3. Default categories to seed (matching current hardcoded list):
   `Camera, Accessories, Cable, Projector, Lighting, Laptop, Audio, Other`

4. Both `addCategory` and `deleteCategory` write to `adminHistory` via `logHistory`.

**Testing checklist:**
- [ ] `subscribeCategories` returns real-time updates
- [ ] `addCategory` adds to Firestore and logs history
- [ ] `deleteCategory` removes from Firestore and logs history
- [ ] `seedDefaultCategories` only seeds when collection is empty (idempotent)
- [ ] Duplicate category names are prevented (case-insensitive check before write)

---

### Phase B2 — Category Manager UI in InventoryTab

**Files to change:**
- `components/admin/InventoryTab.tsx`

**Steps:**

1. Add a collapsible **"Manage Categories"** panel at the top of the Inventory tab, above the toolbar. It should be collapsed by default.

2. Panel contents:
   - A list of all existing categories displayed as pill/badge chips
   - Each chip has a small ✕ delete button (disabled for categories currently in use by at least one inventory item)
   - An inline text input + "Add" button to create a new category
   - A note: *"Deleting a category does not affect existing items already assigned to it."*

3. Subscribe to `subscribeCategories` at the top of `InventoryTab` component with a `useEffect`.

4. Replace all hardcoded `CATS` arrays in `InventoryTab` with the live `categories` state from Firestore.

5. In the Add/Edit modal category `<select>`, populate options from the live categories list.

6. Guard: if an admin tries to delete a category that is currently assigned to one or more items, show a warning tooltip/message instead of deleting — or allow it with a confirmation dialog noting affected items won't be re-categorized automatically.

**Testing checklist:**
- [ ] Panel is collapsed by default, expands on click
- [ ] All seeded default categories appear on first load
- [ ] Adding a new category appears instantly (real-time)
- [ ] Duplicate names are rejected with an inline error
- [ ] Deleting a category removes it from the list and from the filter dropdown
- [ ] Items already using a deleted category still display their category string (no data loss)
- [ ] Category filter dropdown in toolbar reflects live category list
- [ ] Add/Edit modal category select reflects live category list

---

### Phase B3 — BorrowTab Category Filter Sync

**Files to change:**
- `components/admin/BorrowTab.tsx`

**Steps:**

1. Replace the hardcoded `CATS` array in `BorrowTab` with a subscription to `subscribeCategories`.

2. Add a `useEffect` + `useState` for categories, same pattern as `InventoryTab`.

3. The category filter dropdown in the item picker now reflects custom categories in real-time.

**Testing checklist:**
- [ ] New custom categories appear in BorrowTab filter without page reload
- [ ] Deleted categories disappear from BorrowTab filter without page reload
- [ ] Items filtered by custom category display correctly

---

## Feature C — Vehicle Sorting (Newest to Oldest)

**Goal:** The vehicle list in the Vehicles tab Overview shows newest vehicles first instead of oldest first.

**Scope:** Single one-line change. No UI changes needed.

---

### Phase C1 — Firestore Query Change

**Files to change:**
- `lib/firebase/firestore.ts`

**Steps:**

1. In `subscribeVehicles`, change:
```typescript
// Before
query(collection(db, 'vehicles'), orderBy('createdAt', 'asc'))

// After
query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'))
```

That's it.

**Testing checklist:**
- [ ] Newly added vehicle appears at the top of the Vehicles Overview grid
- [ ] Existing vehicles reorder correctly (newest first)
- [ ] Vehicle expense data still links correctly after reorder
- [ ] Dashboard "Recent Vehicle Expenses" unaffected (uses separate expenses query)

---

## Implementation Order

Recommended sequence to minimize broken states during development:

| Order | Phase | Effort | Risk |
|-------|-------|--------|------|
| 1 | C1 — Vehicle sorting | Trivial | None |
| 2 | A1 — Types & Firestore schema | Low | Low |
| 3 | A2 — MultiImageUploader component | Medium | Low |
| 4 | A3 — InventoryTab integration | Medium | Medium |
| 5 | A4 — BorrowTab integration | Low | Low |
| 6 | B1 — Category types & Firestore | Low | Low |
| 7 | B2 — Category Manager UI | Medium | Medium |
| 8 | B3 — BorrowTab category sync | Low | Low |

---

## Files Modified — Full Summary

| File | Features |
|------|----------|
| `lib/types/inventory.ts` | A1, B1 |
| `lib/firebase/firestore.ts` | A1, B1, C1 |
| `lib/utils/images.ts` *(new)* | A1 |
| `components/admin/MultiImageUploader.tsx` *(new)* | A2 |
| `components/admin/InventoryTab.tsx` | A3, B2 |
| `components/admin/BorrowTab.tsx` | A4, B3 |

---

## Notes

- **No database migration required.** All schema changes are additive. Old records missing new fields fall back gracefully via the `resolveImages()` helper and existing `imageUrl` field.
- **Categories are Firestore-backed**, not localStorage. All admin sessions see the same category list instantly via real-time listener.
- **The existing `ImageUploader.tsx`** (single image, used for damage photos in BorrowedTab) is **not changed** by any of these phases.
- **Audit log coverage:** All category add/delete operations are logged to `adminHistory` and will appear in the Profile → Audit Log section automatically.
