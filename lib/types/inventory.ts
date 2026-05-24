import { Timestamp } from 'firebase/firestore';

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  isUnique: boolean;
  quantity: number;
  condition: string;
  status: 'Available' | 'Unavailable' | 'Returned to Vendor'; // ← extended
  inventoryNumber: string;
  serialNumber: string;
  officeOwner: string;
  dateAcquired: string;
  inventoryDate: string;
  imageUrl: string | null;        // keep — backward compat for old single-image records
  imageUrls?: string[];           // new — multi-image support (first image = primary thumbnail)
  value: number | null;           // ← NEW: peso value, used for vendor return threshold check
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
  damagePhotoUrl: string | null;
  damagePhotoUrls?: string[];
  verifiedSerialNumbers?: string[];
  verificationChecklist?: boolean;
  verificationPhotoUrls?: string[];
}

// ─── Admin History ────────────────────────────────────────────────────────────

export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete' | 'vendorReturn'; // ← extended
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
  itemValue: number | null;       // snapshot of item value at time of return
  vendorName: string;             // store / org / supplier name
  vendorContact: string;          // phone or email
  vendorAddress: string;          // full address
  returnDate: string;             // ISO date string YYYY-MM-DD
  reason: string;                 // why it is being returned
  notes: string;                  // optional extra notes
  proofPhotoUrls: string[];       // Cloudinary URLs — proof of return photos
  adminName: string;              // who processed this return
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
  | 'vendor-return'   // ← NEW
  | 'profile';