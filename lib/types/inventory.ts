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
  imageUrl: string | null;        // keep — backward compat for old single-image records
  imageUrls?: string[];           // new — multi-image support (first image = primary thumbnail)
  notes: string;
  value: number | null;
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
  damagePhotoUrl: string | null;
  damagePhotoUrls?: string[];
}

// ─── Custom Categories (Feature B) ────────────────────────────────────────────

export interface CustomCategory {
  id: string;
  name: string;
  createdAt: Timestamp | null;
}

// ─── Admin History ────────────────────────────────────────────────────────────

export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'turnedIn';
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
  expenseType: string;
  cost: number;
  odometer: string;
  vendor: string;
  notes: string;
  receiptPhotoUrl: string | null;
  receiptPhotoUrls?: string[];
  createdAt: Timestamp | null;
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

// ─── Shared Tab Props ─────────────────────────────────────────────────────────

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