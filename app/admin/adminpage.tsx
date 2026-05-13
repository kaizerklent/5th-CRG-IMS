'use client';
import { useState, useEffect } from 'react';
import {
  InventoryItem, BorrowRequest, Vehicle, VehicleExpense, CustomCategory, TabId,
} from '@/lib/types/inventory';
import {
  subscribeInventory, subscribeActiveBorrows, subscribeAllBorrows,
  subscribeVehicles, subscribeVehicleExpenses,
  subscribeCategories,
} from '@/lib/firebase/firestore';
import Sidebar from '@/components/admin/Sidebar';
import TopBar  from '@/components/admin/TopBar';
import DashboardTab from '@/components/admin/DashboardTab';
import BorrowTab    from '@/components/admin/BorrowTab';
import BorrowedTab  from '@/components/admin/BorrowedTab';
import ReturnedTab  from '@/components/admin/ReturnedTab';
import InventoryTab from '@/components/admin/InventoryTab';
import HistoryTab   from '@/components/admin/HistoryTab';
import VehicleTab   from '@/components/admin/VehicleTab';
import ProfileTab   from '@/components/admin/ProfileTab';

const TAB_LABELS: Record<TabId, string> = {
  dashboard: 'Dashboard', borrow: 'Borrow Item', borrowed: 'Borrowed Items',
  returned: 'Returned Items', inventory: 'Inventory', history: 'History',
  vehicle: 'Vehicles', profile: 'Profile',
};

export default function AdminPage() {
  const [activeTab, setActiveTab]       = useState<TabId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Shared state from Firestore subscriptions ──────────────────────────────
  const [inventoryItems, setInventoryItems]     = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [activeBorrows, setActiveBorrows]       = useState<BorrowRequest[]>([]);
  const [allBorrows, setAllBorrows]             = useState<BorrowRequest[]>([]);
  const [loadingBorrows, setLoadingBorrows]     = useState(true);
  const [vehicles, setVehicles]                 = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles]   = useState(true);
  const [vehicleExpenses, setVehicleExpenses]   = useState<VehicleExpense[]>([]);
  const [categories, setCategories]             = useState<CustomCategory[]>([]);

  // Single effect — all subscriptions start at app mount, run for session lifetime
  useEffect(() => {
    const u1 = subscribeInventory(data => {
      setInventoryItems(data);
      setLoadingInventory(false);
    });
    const u2 = subscribeActiveBorrows(data => {
      setActiveBorrows(data);
      setLoadingBorrows(false);
    });
    const u3 = subscribeAllBorrows(data => setAllBorrows(data));
    const u4 = subscribeVehicles(data => {
      setVehicles(data);
      setLoadingVehicles(false);
    });
    const u5 = subscribeVehicleExpenses(null, data => setVehicleExpenses(data));
    const u6 = subscribeCategories(data => {
      setCategories(data);
    });

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  function renderTab() {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab
            onNavigate={setActiveTab}
            items={inventoryItems}
            borrows={allBorrows}
            vehicles={vehicles}
            vExpenses={vehicleExpenses}
            loading={loadingInventory || loadingBorrows || loadingVehicles}
          />
        );
      case 'borrow':
        return (
          <BorrowTab
            items={inventoryItems.filter(i => i.status === 'Available')}
            loadingItems={loadingInventory}
            categories={categories}
          />
        );
      case 'borrowed':
        return <BorrowedTab requests={activeBorrows} loading={loadingBorrows} />;
      case 'returned':
        return (
          <ReturnedTab
            requests={allBorrows.filter(b => b.status === 'Returned')}
            loading={loadingBorrows}
          />
        );
      case 'inventory':
        return (
          <InventoryTab
            items={inventoryItems}
            loading={loadingInventory}
            categories={categories}
          />
        );
      case 'history':
        return (
          <HistoryTab allBorrows={allBorrows} loadingBorrows={loadingBorrows} />
        );
      case 'vehicle':
        return (
          <VehicleTab
            vehicles={vehicles}
            expenses={vehicleExpenses}
            loading={loadingVehicles}
          />
        );
      case 'profile':
        return <ProfileTab />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)}/>
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar tabLabel={TAB_LABELS[activeTab]} onMenuClick={() => setSidebarCollapsed(c => !c)}/>
        <main className="flex-1 overflow-y-auto p-6 w-full">{renderTab()}</main>
      </div>
    </div>
  );
}
