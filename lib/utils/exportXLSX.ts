import * as XLSX from 'xlsx';
import {
  InventoryItem, BorrowRequest, Vehicle, VehicleExpense,
  VendorReturn, AdminHistory,
} from '@/lib/types/inventory';

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function sheet(wb: XLSX.WorkBook, name: string, data: Record<string, any>[], cols: { wch: number }[]) {
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const today = () => new Date().toISOString().split('T')[0];

// ─── Inventory Items ──────────────────────────────────────────────────────────

export function exportInventory(items: InventoryItem[]) {
  const rows = items.map(i => ({
    'Item Name':         i.name,
    'Category':          i.category,
    'Asset Type':        i.isUnique ? 'Unique' : 'Bulk',
    'Quantity':          i.quantity,
    'Condition':         i.condition,
    'Status':            i.status,
    'Inventory No.':     i.inventoryNumber,
    'Serial No.':        i.serialNumber,
    'Office/Department': i.officeOwner,
    'Date Acquired':     i.dateAcquired,
    'Last Inventory':    i.inventoryDate,
    'Value (₱)':         i.value ?? '',
    'Borrowed By':       i.borrowedBy || '',
    'Notes':             i.notes,
    'Photo Count':       (i.imageUrls?.length ?? (i.imageUrl ? 1 : 0)),
  }));

  const wb = XLSX.utils.book_new();
  sheet(wb, 'Inventory', rows, [
    { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 8 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 20 }, { wch: 30 }, { wch: 12 },
  ]);
  download(wb, `inventory-${today()}.xlsx`);
}

// ─── Borrow Requests ──────────────────────────────────────────────────────────

export function exportBorrows(requests: BorrowRequest[]) {
  const rows = requests.flatMap(r =>
    r.items.map(i => ({
      'Ref ID':          r.id.slice(0, 8),
      'Borrower':        r.borrowerName,
      'Department':      r.borrowerDepartment,
      'Contact':         r.borrowerContact,
      'Item':            i.itemName,
      'Category':        i.category,
      'Inventory No.':   i.inventoryNumber,
      'Serial No.':      i.serialNumber,
      'Quantity':        i.quantity,
      'Borrow Date':     r.borrowDate,
      'Due Date':        r.returnDate || 'Not set',
      'Status':          r.status,
      'Return Condition': r.returnCondition || '',
      'Return Notes':    r.returnNotes || '',
      'Notes':           r.notes,
    }))
  );

  const wb = XLSX.utils.book_new();
  sheet(wb, 'Borrow Requests', rows, [
    { wch: 10 }, { wch: 24 }, { wch: 20 }, { wch: 16 },
    { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 30 }, { wch: 24 },
  ]);
  download(wb, `borrow-requests-${today()}.xlsx`);
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export function exportVehicles(vehicles: Vehicle[]) {
  const rows = vehicles.map(v => ({
    'Vehicle Name':  v.name,
    'Plate Number':  v.plateNumber,
    'Type':          v.type,
    'Year':          v.year,
    'Assigned Driver': v.assignedDriver || '',
    'Notes':         v.notes,
  }));

  const wb = XLSX.utils.book_new();
  sheet(wb, 'Vehicles', rows, [
    { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
    { wch: 24 }, { wch: 30 },
  ]);
  download(wb, `vehicles-${today()}.xlsx`);
}

// ─── Vehicle Expenses ─────────────────────────────────────────────────────────

export function exportVehicleExpenses(expenses: VehicleExpense[]) {
  const rows = expenses.map(e => ({
    'Date':          e.date,
    'Vehicle':       e.vehicleName,
    'Expense Type':  e.expenseType,
    'Cost (₱)':      e.cost,
    'Vendor/Shop':   e.vendor || '',
    'Odometer':      e.odometer || '',
    'Notes':         e.notes,
    'Receipt Count': (e.receiptPhotoUrls?.length ?? (e.receiptPhotoUrl ? 1 : 0)),
  }));

  const wb = XLSX.utils.book_new();
  sheet(wb, 'Vehicle Expenses', rows, [
    { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 },
    { wch: 24 }, { wch: 12 }, { wch: 30 }, { wch: 12 },
  ]);
  download(wb, `vehicle-expenses-${today()}.xlsx`);
}

// ─── Vendor Returns ───────────────────────────────────────────────────────────

export function exportVendorReturns(returns: VendorReturn[]) {
  const rows = returns.map(r => ({
    'Item Name':       r.itemName,
    'Inventory No.':   r.inventoryNumber,
    'Serial No.':      r.serialNumber,
    'Category':        r.category,
    'Item Value (₱)':  r.itemValue ?? '',
    'Vendor Name':     r.vendorName,
    'Vendor Contact':  r.vendorContact,
    'Vendor Address':  r.vendorAddress,
    'Return Date':     r.returnDate,
    'Reason':          r.reason,
    'Notes':           r.notes,
    'Proof Photos':    r.proofPhotoUrls.length,
    'Processed By':    r.adminName,
  }));

  const wb = XLSX.utils.book_new();
  sheet(wb, 'Vendor Returns', rows, [
    { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 35 },
    { wch: 14 }, { wch: 40 }, { wch: 30 }, { wch: 12 }, { wch: 20 },
  ]);
  download(wb, `vendor-returns-${today()}.xlsx`);
}

// ─── Admin History ────────────────────────────────────────────────────────────

export function exportHistory(logs: AdminHistory[]) {
  const rows = logs.map(l => ({
    'Action':        l.action,
    'Item Name':     l.itemName || '',
    'Details':       l.details || '',
    'Performed By':  l.adminName || '',
    'Date & Time':   l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : (l.timestamp?.toString() || ''),
  }));

  const wb = XLSX.utils.book_new();
  sheet(wb, 'Admin History', rows, [
    { wch: 12 }, { wch: 30 }, { wch: 50 }, { wch: 24 }, { wch: 22 },
  ]);
  download(wb, `admin-history-${today()}.xlsx`);
}
