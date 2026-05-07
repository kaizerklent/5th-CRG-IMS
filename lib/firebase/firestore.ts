import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
  writeBatch, increment, Unsubscribe, DocumentData, QuerySnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { 
  InventoryItem, 
  BorrowRequest, 
  AdminHistory, 
  BorrowedItem, 
  Vehicle, 
  VehicleExpense 
} from '../types/inventory';

// ─── Snapshot helpers ────────────────────────────────────────────────────────
const toInventory = (s: QuerySnapshot<DocumentData>): InventoryItem[] =>
  s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));

const toBorrowRequests = (s: QuerySnapshot<DocumentData>): BorrowRequest[] =>
  s.docs.map(d => ({ id: d.id, ...d.data() } as BorrowRequest));

// ─── Inventory subscriptions ─────────────────────────────────────────────────
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

// ─── Borrow request subscriptions ────────────────────────────────────────────
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
    query(collection(db, 'vehicles'), orderBy('createdAt', 'asc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)))
  );
}

export function subscribeVehicleExpenses(
  vehicleId: string | null,
  cb: (expenses: VehicleExpense[]) => void
): Unsubscribe {
  const q = vehicleId
    ? query(
        collection(db, 'vehicleExpenses'),
        where('vehicleId', '==', vehicleId),
        orderBy('date', 'desc')
      )
    : query(collection(db, 'vehicleExpenses'), orderBy('date', 'desc'));
  return onSnapshot(q, s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() } as VehicleExpense)))
  );
}

// ─── Admin history ────────────────────────────────────────────────────────────
async function logHistory(entry: Omit<AdminHistory, 'id' | 'timestamp'>): Promise<void> {
  await addDoc(collection(db, 'adminHistory'), { ...entry, timestamp: serverTimestamp() });
}

// ─── Inventory writes ─────────────────────────────────────────────────────────
export async function addInventoryItem(
  data: Omit<InventoryItem, 'id' | 'createdAt'>,
  adminName: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'inventory'), { ...data, createdAt: serverTimestamp() });
  await logHistory({ action: 'add', itemId: ref.id, itemName: data.name, adminName,
    details: `Added: ${data.name} (${data.inventoryNumber || 'no inv no.'})` });
  return ref.id;
}

export async function updateInventoryItem(
  itemId: string, itemName: string,
  data: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>,
  adminName: string
): Promise<void> {
  await updateDoc(doc(db, 'inventory', itemId), data as DocumentData);
  await logHistory({ action: 'update', itemId, itemName, adminName, details: `Updated: ${itemName}` });
}

export async function deleteInventoryItem(
  itemId: string, itemName: string, adminName: string
): Promise<void> {
  await deleteDoc(doc(db, 'inventory', itemId));
  await logHistory({ action: 'delete', itemId, itemName, adminName, details: `Deleted: ${itemName}` });
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
  await deleteDoc(doc(db, 'vehicles', vehicleId));
  await logHistory({
    action: 'delete', itemId: vehicleId, itemName: vehicleName, adminName,
    details: `Deleted vehicle: ${vehicleName}`,
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
  borrowerName: string, borrowerDepartment: string, borrowerContact: string,
  selectedItems: SelectedBorrowItem[],
  borrowDate: string, returnDate: string | null, notes: string
): Promise<string> {
  const batch = writeBatch(db);
  const borrowRef = doc(collection(db, 'borrowRequests'));

  const items: BorrowedItem[] = selectedItems.map(s => ({
    itemId: s.item.id, itemName: s.item.name, category: s.item.category,
    inventoryNumber: s.item.inventoryNumber, serialNumber: s.item.serialNumber,
    quantity: s.quantity,
  }));

  batch.set(borrowRef, {
    borrowerName, borrowerDepartment, borrowerContact, items,
    borrowDate, returnDate: returnDate || null, notes,
    status: 'Approved', createdAt: serverTimestamp(),
    returnedAt: null, returnCondition: null, returnNotes: null, damagePhotoUrl: null,
  });

  for (const s of selectedItems) {
    const invRef = doc(db, 'inventory', s.item.id);
    if (s.item.isUnique) {
      batch.update(invRef, { quantity: 0, status: 'Unavailable',
        borrowedBy: borrowerName, borrowRequestId: borrowRef.id });
    } else {
      const newQty = s.item.quantity - s.quantity;
      batch.update(invRef, { quantity: newQty, status: newQty <= 0 ? 'Unavailable' : 'Available' });
    }
  }

  await batch.commit();
  return borrowRef.id;
}

// ─── Mark returned ────────────────────────────────────────────────────────────
export async function markReturned(
  request: BorrowRequest,
  returnCondition: 'Good' | 'Fair' | 'Damaged',
  returnNotes: string,
  damagePhotoUrls: string[]    // now an array — first item kept in damagePhotoUrl for backward compat
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, 'borrowRequests', request.id), {
    status: 'Returned', returnedAt: serverTimestamp(),
    returnCondition, returnNotes: returnNotes || null,
    // Keep single-url field for backward compat with ReturnedTab / HistoryTab
    damagePhotoUrl: damagePhotoUrls[0] ?? null,
    // Full array for new multi-photo display
    damagePhotoUrls: damagePhotoUrls.length > 0 ? damagePhotoUrls : null,
  });

  const isDamaged = returnCondition === 'Damaged';

  for (const bi of request.items) {
    batch.update(doc(db, 'inventory', bi.itemId), {
      quantity: increment(bi.quantity),
      // Damaged items are flagged Unavailable so admins must review before re-lending.
      // Good / Fair items go back to Available.
      status: isDamaged ? 'Unavailable' : 'Available',
      // Update condition to reflect the state the item came back in.
      condition: returnCondition,
      borrowedBy: null,
      borrowRequestId: null,
    });
  }

  await batch.commit();
}