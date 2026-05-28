import { Timestamp } from 'firebase/firestore';

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  subCategory: string;           // ← NEW: sub-category under parent category
  isUnique: boolean;
  isConsumable: boolean;         // ← NEW: consumable flag (ammo, food, supplies)
  quantity: number;
  condition: string;
  status: 'Available' | 'Unavailable' | 'Returned to Vendor' | 'Out of Stock'; // ← extended
  inventoryNumber: string;
  serialNumber: string;
  officeOwner: string;
  dateAcquired: string;
  inventoryDate: string;
  imageUrl: string | null;
  imageUrls?: string[];
  value: number | null;
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
  subCategory: string;           // ← NEW
  inventoryNumber: string;
  serialNumber: string;
  quantity: number;
  isConsumable: boolean;         // ← NEW: snapshot so history shows correct type
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
  verifiedSerialNumbers?: string[];
  verificationChecklist?: boolean;
  verificationPhotoUrls?: string[];
}

// ─── Admin History ────────────────────────────────────────────────────────────

export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'vendorReturn' | 'consume'; // ← 'consume' added
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

// ─── Custom Categories ────────────────────────────────────────────────────────

export interface CustomCategory {
  id: string;
  name: string;
  subCategories: string[];       // ← NEW: array of sub-category names
  createdAt: Timestamp | null;
}

// ─── Vendor Returns ───────────────────────────────────────────────────────────

export interface VendorReturn {
  id: string;
  itemId: string;
  itemName: string;
  inventoryNumber: string;
  serialNumber: string;
  category: string;
  subCategory: string;           // ← NEW
  itemValue: number | null;
  vendorName: string;
  vendorContact: string;
  vendorAddress: string;
  returnDate: string;
  reason: string;
  notes: string;
  proofPhotoUrls: string[];
  adminName: string;
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
  | 'vendor-return'
  | 'profile';