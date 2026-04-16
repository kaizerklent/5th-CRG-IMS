import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
  writeBatch, increment, Unsubscribe, DocumentData, QuerySnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { InventoryItem, BorrowRequest, AdminHistory, BorrowedItem } from '../types/inventory';

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
  damagePhotoUrl: string | null
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, 'borrowRequests', request.id), {
    status: 'Returned', returnedAt: serverTimestamp(),
    returnCondition, returnNotes: returnNotes || null,
    damagePhotoUrl: damagePhotoUrl || null,
  });

  for (const bi of request.items) {
    batch.update(doc(db, 'inventory', bi.itemId), {
      quantity: increment(bi.quantity),
      status: 'Available',
      borrowedBy: null,
      borrowRequestId: null,
    });
  }

  await batch.commit();
}
