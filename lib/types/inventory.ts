import { Timestamp } from 'firebase/firestore';

export interface BorrowedItem {
  itemId: string;
  itemName: string;
  category: string;
  inventoryNumber: string;
  serialNumber: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  isUnique: boolean;
  quantity: number;
  condition: 'Good' | 'Fair' | 'Damaged' | 'Under Repair';
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
}

export interface AdminHistory {
  id: string;
  action: 'add' | 'update' | 'delete';
  itemId: string;
  itemName: string;
  adminName: string;
  timestamp: Timestamp | null;
  details: string;
}

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
  expenseType: 'Oil Change' | 'Fuel' | 'Tires' | 'Repair' | 'Registration' | 'Other';
  cost: number;
  odometer: string;
  vendor: string;
  notes: string;
  receiptPhotoUrl: string | null;
  createdAt: Timestamp | null;
}

export type TabId = 'dashboard' | 'borrow' | 'borrowed' | 'returned' | 'inventory' | 'history' | 'vehicle' | 'profile';