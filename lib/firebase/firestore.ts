import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
  writeBatch, increment, Unsubscribe, DocumentData, QuerySnapshot,
  getDoc, getDocs, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  InventoryItem,
  BorrowRequest,
  AdminHistory,
  BorrowedItem,
  Vehicle,
  VehicleExpense,
  CustomCategory,
  VendorReturn,
} from '../types/inventory';

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

const toInventory = (s: QuerySnapshot<DocumentData>): InventoryItem[] =>
  s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));

const toBorrowRequests = (s: QuerySnapshot<DocumentData>): BorrowRequest[] =>
  s.docs.map(d => ({ id: d.id, ...d.data() } as BorrowRequest));

// ─── Inventory subscriptions ──────────────────────────────────────────────────

export function subscribeInventory(cb: (items: InventoryItem[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'inventory'), orderBy('createdAt', 'desc')),
    s => cb(toInventory(s))
  );
}

export function subscribeAvailableInventory(cb: (items: InventoryItem[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'inventory'), where('status', '==', 'Available'), orderBy('name', 'asc')),
    s => cb(toInventory(s))
  );
}

// ─── Borrow request subscriptions ─────────────────────────────────────────────

export function subscribeActiveBorrows(cb: (reqs: BorrowRequest[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'borrowRequests'), where('status', '==', 'Approved'), orderBy('createdAt', 'desc')),
    s => cb(toBorrowRequests(s))
  );
}

export function subscribeReturnedBorrows(cb: (reqs: BorrowRequest[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'borrowRequests'), where('status', '==', 'Returned'), orderBy('returnedAt', 'desc')),
    s => cb(toBorrowRequests(s))
  );
}

export function subscribeAllBorrows(cb: (reqs: BorrowRequest[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'borrowRequests'), orderBy('createdAt', 'desc')),
    s => cb(toBorrowRequests(s))
  );
}

// ─── Vehicle subscriptions ────────────────────────────────────────────────────

export function subscribeVehicles(cb: (vehicles: Vehicle[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'vehicles'), orderBy('createdAt', 'desc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)))
  );
}

export function subscribeVehicleExpenses(
  vehicleId: string | null,
  cb: (expenses: VehicleExpense[]) => void
): Unsubscribe {
  const q = vehicleId
    ? query(collection(db, 'vehicleExpenses'), where('vehicleId', '==', vehicleId), orderBy('date', 'desc'))
    : query(collection(db, 'vehicleExpenses'), orderBy('date', 'desc'));
  return onSnapshot(q, s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() } as VehicleExpense)))
  );
}

// ─── Category subscriptions & writes ──────────────────────────────────────────

export function subscribeCategories(cb: (cats: CustomCategory[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'categories'), orderBy('name', 'asc')),
    s => cb(s.docs.map(d => ({
      ...d.data(),
      id: d.id,
      subCategories: d.data().subCategories || [],   // ← safe default for old docs without this field
    } as CustomCategory)))
  );
}

export async function addCategory(name: string, adminName: string): Promise<string> {
  const trimmed = name.trim();
  const ref = await addDoc(collection(db, 'categories'), {
    name: trimmed,
    subCategories: [],             // ← initialise empty
    createdAt: serverTimestamp(),
  });
  await logHistory({
    action: 'add',
    itemId: ref.id,
    itemName: trimmed,
    adminName,
    details: `Added inventory category: "${trimmed}"`,
  });
  return ref.id;
}

export async function updateCategory(
  id: string,
  oldName: string,
  newName: string,
  adminName: string
): Promise<void> {
  const trimmed = newName.trim();
  await updateDoc(doc(db, 'categories', id), { name: trimmed });
  await logHistory({
    action: 'update',
    itemId: id,
    itemName: trimmed,
    adminName,
    details: `Renamed category: "${oldName}" → "${trimmed}"`,
  });
}

export async function deleteCategory(
  id: string,
  name: string,
  adminName: string
): Promise<void> {
  await deleteDoc(doc(db, 'categories', id));
  await logHistory({
    action: 'delete',
    itemId: id,
    itemName: name,
    adminName,
    details: `Deleted inventory category: "${name}"`,
  });
}

// ─── Sub-category writes ──────────────────────────────────────────────────────

export async function addSubCategory(
  categoryId: string,
  categoryName: string,
  subName: string,
  adminName: string
): Promise<void> {
  const trimmed = subName.trim();
  await updateDoc(doc(db, 'categories', categoryId), {
    subCategories: arrayUnion(trimmed),
  });
  await logHistory({
    action: 'update',
    itemId: categoryId,
    itemName: categoryName,
    adminName,
    details: `Added sub-category "${trimmed}" under "${categoryName}"`,
  });
}

export async function deleteSubCategory(
  categoryId: string,
  categoryName: string,
  subName: string,
  adminName: string
): Promise<void> {
  await updateDoc(doc(db, 'categories', categoryId), {
    subCategories: arrayRemove(subName),
  });
  await logHistory({
    action: 'update',
    itemId: categoryId,
    itemName: categoryName,
    adminName,
    details: `Deleted sub-category "${subName}" from "${categoryName}"`,
  });
}

export async function renameSubCategory(
  categoryId: string,
  categoryName: string,
  oldName: string,
  newName: string,
  adminName: string
): Promise<void> {
  const trimmed = newName.trim();
  // Firestore has no atomic array-element rename — remove old, add new
  const batch = writeBatch(db);
  const ref = doc(db, 'categories', categoryId);
  batch.update(ref, { subCategories: arrayRemove(oldName) });
  batch.update(ref, { subCategories: arrayUnion(trimmed) });
  await batch.commit();
  await logHistory({
    action: 'update',
    itemId: categoryId,
    itemName: categoryName,
    adminName,
    details: `Renamed sub-category "${oldName}" → "${trimmed}" under "${categoryName}"`,
  });
}

// ─── Serial number validation helpers ─────────────────────────────────────────

/**
 * Strips all characters that are not alphanumeric, spaces, or hyphens.
 * Use as an onChange sanitizer on serial number inputs.
 */
export function sanitizeSerialNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9 \-]/g, '');
}

/**
 * Checks whether a serial number is already used by another inventory item.
 * Comparison is case-insensitive. Empty serials are always allowed.
 *
 * @param serial      The serial to check
 * @param excludeId   The id of the item being edited (to exclude itself)
 * @param allItems    Current inventory list (from subscription)
 */
export function isSerialDuplicate(
  serial: string,
  excludeId: string | null,
  allItems: InventoryItem[]
): boolean {
  if (!serial.trim()) return false;
  const lower = serial.trim().toLowerCase();
  return allItems.some(
    item =>
      item.id !== excludeId &&
      item.serialNumber?.trim().toLowerCase() === lower
  );
}

// ─── Admin history ─────────────────────────────────────────────────────────────

async function logHistory(entry: Omit<AdminHistory, 'id' | 'timestamp'>): Promise<void> {
  await addDoc(collection(db, 'adminHistory'), { ...entry, timestamp: serverTimestamp() });
}

// ─── Inventory writes ──────────────────────────────────────────────────────────

export async function addInventoryItem(
  data: Omit<InventoryItem, 'id' | 'createdAt'>,
  adminName: string
): Promise<string> {
  const imageUrls = normaliseImageUrls(data.imageUrls, data.imageUrl);
  const imageUrl  = imageUrls[0] ?? null;

  const ref = await addDoc(collection(db, 'inventory'), {
    ...data,
    isConsumable: data.isConsumable ?? false,
    subCategory:  data.subCategory ?? '',
    imageUrl,
    imageUrls,
    createdAt: serverTimestamp(),
  });

  await logHistory({
    action: 'add', itemId: ref.id, itemName: data.name, adminName,
    details: `Added: ${data.name} (${data.inventoryNumber || 'no inv no.'})${data.isConsumable ? ' [Consumable]' : ''}`,
  });
  return ref.id;
}

export async function updateInventoryItem(
  itemId: string, itemName: string,
  data: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>,
  adminName: string
): Promise<void> {
  const imageUrls = normaliseImageUrls(data.imageUrls, data.imageUrl ?? null);
  const imageUrl  = imageUrls[0] ?? null;

  await updateDoc(doc(db, 'inventory', itemId), {
    ...data,
    imageUrl,
    imageUrls,
  } as DocumentData);

  await logHistory({ action: 'update', itemId, itemName, adminName, details: `Updated: ${itemName}` });
}

export async function deleteInventoryItem(
  itemId: string, itemName: string, adminName: string
): Promise<void> {
  await deleteDoc(doc(db, 'inventory', itemId));
  await logHistory({ action: 'delete', itemId, itemName, adminName, details: `Deleted: ${itemName}` });
}

// ─── Image normalisation helper ───────────────────────────────────────────────

function normaliseImageUrls(
  imageUrls: string[] | undefined,
  imageUrl: string | null
): string[] {
  const base = Array.isArray(imageUrls) ? imageUrls : [];
  if (base.length === 0 && imageUrl) return [imageUrl];
  return base.filter(Boolean);
}

// ─── Vehicle writes ───────────────────────────────────────────────────────────

export async function addVehicle(
  data: Omit<Vehicle, 'id' | 'createdAt'>,
  adminName: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'vehicles'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logHistory({
    action: 'add', itemId: ref.id, itemName: data.name, adminName,
    details: `Added vehicle: ${data.name} (${data.plateNumber})`,
  });
  return ref.id;
}

export async function updateVehicle(
  vehicleId: string,
  data: Partial<Omit<Vehicle, 'id' | 'createdAt'>>,
  adminName: string
): Promise<void> {
  await updateDoc(doc(db, 'vehicles', vehicleId), data as DocumentData);
  await logHistory({
    action: 'update', itemId: vehicleId, itemName: data.name || vehicleId, adminName,
    details: `Updated vehicle: ${data.name || vehicleId}`,
  });
}

export async function deleteVehicle(
  vehicleId: string, vehicleName: string, adminName: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'vehicles', vehicleId));
  const expensesSnap = await getDocs(
    query(collection(db, 'vehicleExpenses'), where('vehicleId', '==', vehicleId))
  );
  expensesSnap.forEach(expDoc => { batch.delete(expDoc.ref); });
  await batch.commit();
  await logHistory({
    action: 'delete', itemId: vehicleId, itemName: vehicleName, adminName,
    details: `Deleted vehicle: ${vehicleName} and ${expensesSnap.size} expense record(s).`,
  });
}

// ─── Expense writes ───────────────────────────────────────────────────────────

export async function addVehicleExpense(
  data: Omit<VehicleExpense, 'id' | 'createdAt'>,
  adminName: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'vehicleExpenses'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logHistory({
    action: 'add', itemId: ref.id, itemName: data.vehicleName, adminName,
    details: `Expense logged: ${data.expenseType} ₱${data.cost.toLocaleString('en-PH')} for ${data.vehicleName}`,
  });
  return ref.id;
}

export async function updateVehicleExpense(
  expenseId: string,
  data: Partial<Omit<VehicleExpense, 'id' | 'createdAt'>>,
  adminName: string
): Promise<void> {
  await updateDoc(doc(db, 'vehicleExpenses', expenseId), data as DocumentData);
  await logHistory({
    action: 'update', itemId: expenseId, itemName: data.vehicleName || expenseId, adminName,
    details: `Updated expense: ${data.expenseType} for ${data.vehicleName}`,
  });
}

export async function deleteVehicleExpense(
  expenseId: string, vehicleName: string, expenseType: string, adminName: string
): Promise<void> {
  await deleteDoc(doc(db, 'vehicleExpenses', expenseId));
  await logHistory({
    action: 'delete', itemId: expenseId, itemName: vehicleName, adminName,
    details: `Deleted expense: ${expenseType} for ${vehicleName}`,
  });
}

// ─── Borrow submit ────────────────────────────────────────────────────────────

export interface SelectedBorrowItem { item: InventoryItem; quantity: number; }

export async function submitBorrowRequest(
  borrowerName: string,
  borrowerDepartment: string,
  borrowerContact: string,
  selectedItems: SelectedBorrowItem[],
  borrowDate: string,
  returnDate: string | null,
  notes: string
): Promise<string> {

  for (const s of selectedItems) {
    const snap = await getDoc(doc(db, 'inventory', s.item.id));
    if (!snap.exists()) {
      throw new Error(`"${s.item.name}" no longer exists in inventory.`);
    }
    const current = snap.data() as InventoryItem;
    if (current.status === 'Unavailable' || current.status === 'Out of Stock') {
      throw new Error(`"${s.item.name}" is no longer available.`);
    }
    if (!current.isUnique && current.quantity < s.quantity) {
      throw new Error(
        `Not enough stock for "${s.item.name}". ` +
        `Requested: ${s.quantity}, Available: ${current.quantity}.`
      );
    }
  }

  const batch = writeBatch(db);
  const borrowRef = doc(collection(db, 'borrowRequests'));

  const items: BorrowedItem[] = selectedItems.map(s => ({
    itemId:          s.item.id,
    itemName:        s.item.name,
    category:        s.item.category,
    subCategory:     s.item.subCategory ?? '',
    inventoryNumber: s.item.inventoryNumber,
    serialNumber:    s.item.serialNumber,
    quantity:        s.quantity,
    isConsumable:    s.item.isConsumable ?? false,
  }));

  batch.set(borrowRef, {
    borrowerName, borrowerDepartment, borrowerContact, items,
    borrowDate, returnDate: returnDate || null, notes,
    status: 'Approved', createdAt: serverTimestamp(),
    returnedAt: null, returnCondition: null,
    returnNotes: null, damagePhotoUrl: null, damagePhotoUrls: null,
    verificationPhotoUrls: null,
    verifiedSerialNumbers: null,
    verificationChecklist: null,
  });

  for (const s of selectedItems) {
    const invRef = doc(db, 'inventory', s.item.id);

    if (s.item.isConsumable) {
      // ── Consumable: quantity goes down permanently ───────────────────────
      const newQty = s.item.quantity - s.quantity;
      batch.update(invRef, {
        quantity: newQty,
        status:   newQty <= 0 ? 'Out of Stock' : 'Available',
      });
    } else if (s.item.isUnique) {
      // ── Unique asset: mark unavailable, track borrower ───────────────────
      batch.update(invRef, {
        quantity:        0,
        status:          'Unavailable',
        borrowedBy:      borrowerName,
        borrowRequestId: borrowRef.id,
      });
    } else {
      // ── Bulk: reduce quantity ────────────────────────────────────────────
      const newQty = s.item.quantity - s.quantity;
      batch.update(invRef, {
        quantity: newQty,
        status:   newQty <= 0 ? 'Unavailable' : 'Available',
      });
    }
  }

  await batch.commit();

  // ── Log consume action for consumable items ──────────────────────────────
  for (const s of selectedItems) {
    if (s.item.isConsumable) {
      await logHistory({
        action:   'consume',
        itemId:   s.item.id,
        itemName: s.item.name,
        adminName: borrowerName,
        details:  `Consumed ${s.quantity}x "${s.item.name}" by ${borrowerName} (${borrowerDepartment})`,
      });
    }
  }

  return borrowRef.id;
}

// ─── Mark returned ─────────────────────────────────────────────────────────────

export interface ReturnVerification {
  verificationPhotoUrls: string[];
  verifiedSerialNumbers: string[];
  verificationChecklist: boolean;
}

export async function markReturned(
  request: BorrowRequest,
  returnCondition: 'Good' | 'Fair' | 'Damaged',
  returnNotes: string,
  damagePhotoUrls: string[],
  verification: ReturnVerification = {
    verificationPhotoUrls: [],
    verifiedSerialNumbers: [],
    verificationChecklist: false,
  }
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, 'borrowRequests', request.id), {
    status:          'Returned',
    returnedAt:      serverTimestamp(),
    returnCondition,
    returnNotes:     returnNotes || null,
    damagePhotoUrl:  damagePhotoUrls[0] ?? null,
    damagePhotoUrls: damagePhotoUrls.length > 0 ? damagePhotoUrls : null,
    verificationPhotoUrls: verification.verificationPhotoUrls.length > 0
      ? verification.verificationPhotoUrls : null,
    verifiedSerialNumbers: verification.verifiedSerialNumbers.length > 0
      ? verification.verifiedSerialNumbers : null,
    verificationChecklist: verification.verificationChecklist || null,
  });

  const isDamaged = returnCondition === 'Damaged';

  for (const bi of request.items) {
    if (bi.isConsumable) {
      // ── Consumable: quantity was already permanently reduced on borrow.
      //    On "return" (e.g. unused portion), restore the returned qty.
      //    Status: if qty > 0 → Available; else stays Out of Stock.
      const snap = await getDoc(doc(db, 'inventory', bi.itemId));
      if (snap.exists()) {
        const current = snap.data() as InventoryItem;
        const restored = (current.quantity ?? 0) + bi.quantity;
        batch.update(doc(db, 'inventory', bi.itemId), {
          quantity: restored,
          status:   restored > 0 ? 'Available' : 'Out of Stock',
        });
      }
    } else {
      // ── Non-consumable: restore quantity as before ───────────────────────
      batch.update(doc(db, 'inventory', bi.itemId), {
        quantity:        increment(bi.quantity),
        status:          isDamaged ? 'Unavailable' : 'Available',
        condition:       returnCondition,
        borrowedBy:      null,
        borrowRequestId: null,
      });
    }
  }

  await batch.commit();
}

// ─── Vendor Returns ───────────────────────────────────────────────────────────

export function subscribeVendorReturns(
  cb: (returns: VendorReturn[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'vendorReturns'), orderBy('createdAt', 'desc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() } as VendorReturn)))
  );
}

export async function submitVendorReturn(
  item: InventoryItem,
  data: {
    vendorName: string;
    vendorContact: string;
    vendorAddress: string;
    returnDate: string;
    reason: string;
    notes: string;
    proofPhotoUrls: string[];
  },
  adminName: string
): Promise<string> {
  const batch = writeBatch(db);

  const returnRef = doc(collection(db, 'vendorReturns'));
  batch.set(returnRef, {
    itemId:          item.id,
    itemName:        item.name,
    inventoryNumber: item.inventoryNumber,
    serialNumber:    item.serialNumber,
    category:        item.category,
    subCategory:     item.subCategory ?? '',
    itemValue:       item.value ?? null,
    vendorName:      data.vendorName,
    vendorContact:   data.vendorContact,
    vendorAddress:   data.vendorAddress,
    returnDate:      data.returnDate,
    reason:          data.reason,
    notes:           data.notes,
    proofPhotoUrls:  data.proofPhotoUrls,
    adminName,
    createdAt:       serverTimestamp(),
  });

  batch.delete(doc(db, 'inventory', item.id));
  await batch.commit();

  await logHistory({
    action:   'vendorReturn',
    itemId:   item.id,
    itemName: item.name,
    adminName,
    details:  `Vendor Return: ${item.name}${item.inventoryNumber ? ` (${item.inventoryNumber})` : ''} returned to ${data.vendorName} and removed from inventory. Reason: ${data.reason}`,
  });

  return returnRef.id;
}