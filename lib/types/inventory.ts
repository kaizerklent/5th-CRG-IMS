import { Timestamp } from 'firebase/firestore';

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  isUnique: boolean;
  quantity: number;
  condition: string;
  status: 'Available' | 'Unavailable';
  inventoryNumber: string;
  serialNumber: string;
  officeOwner: string;
  dateAcquired: string;
  inventoryDate: string;
  imageUrl: string | null;
  notes: string;
  borrowedBy: string | null;
  borrowRequestId: string | null;
  createdAt: Timestamp | null;
}

// ─── Borrow ───────────────────────────────────────────────────────────────────

export interface BorrowedItem {
  itemId: string;
  itemName: string;
  category: string;
  inventoryNumber: string;
  serialNumber: string;
  quantity: number;
}

export interface BorrowRequest {
  id: string;
  borrowerName: string;
  borrowerDepartment: string;
  borrowerContact: string;
  items: BorrowedItem[];
  borrowDate: string;
  returnDate: string | null;
  notes: string;
  status: 'Approved' | 'Returned';
  createdAt: Timestamp | null;
  returnedAt: Timestamp | null;
  returnCondition: 'Good' | 'Fair' | 'Damaged' | null;
  returnNotes: string | null;
  // Phase 1.1 fix: both fields present
  damagePhotoUrl: string | null;    // keep — backward compat for old records
  damagePhotoUrls?: string[];       // add — new multi-photo field
}

// ─── Admin History ────────────────────────────────────────────────────────────

export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete';
  itemId: string;
  itemName: string;
  adminName: string;
  details: string;
  timestamp: Timestamp | null;
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  type: string;
  year: string;
  assignedDriver: string;
  notes: string;
  createdAt: Timestamp | null;
}

export interface VehicleExpense {
  id: string;
  vehicleId: string;
  vehicleName: string;
  date: string;
  // Phase 1.2 fix: changed from strict union to string — free text input
  expenseType: string;
  cost: number;
  odometer: string;
  vendor: string;
  notes: string;
  receiptPhotoUrl: string | null;   // keep — backward compat for old records
  receiptPhotoUrls?: string[];      // add — new multi-photo field
  createdAt: Timestamp | null;
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

export type TabId =
  | 'dashboard'
  | 'borrow'
  | 'borrowed'
  | 'returned'
  | 'inventory'
  | 'history'
  | 'vehicle'
  | 'profile';