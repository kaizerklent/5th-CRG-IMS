'use client';
import { useState } from 'react';
import { TabId } from '@/lib/types/inventory';
import Sidebar from '@/components/admin/Sidebar';
import TopBar  from '@/components/admin/TopBar';
import DashboardTab from '@/components/admin/DashboardTab';
import BorrowTab    from '@/components/admin/BorrowTab';
import BorrowedTab  from '@/components/admin/BorrowedTab';
import ReturnedTab  from '@/components/admin/ReturnedTab';
import InventoryTab from '@/components/admin/InventoryTab';
import HistoryTab   from '@/components/admin/HistoryTab';
import ProfileTab   from '@/components/admin/ProfileTab';

const TAB_LABELS: Record<TabId, string> = {
  dashboard: 'Dashboard', borrow: 'Borrow Item', borrowed: 'Borrowed Items',
  returned: 'Returned Items', inventory: 'Inventory', history: 'History', profile: 'Profile',
};

export default function AdminPage() {
  const [activeTab, setActiveTab]       = useState<TabId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function renderTab() {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab onNavigate={setActiveTab}/>;
      case 'borrow':    return <BorrowTab/>;
      case 'borrowed':  return <BorrowedTab/>;
      case 'returned':  return <ReturnedTab/>;
      case 'inventory': return <InventoryTab/>;
      case 'history':   return <HistoryTab/>;
      case 'profile':   return <ProfileTab/>;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)}/>
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar tabLabel={TAB_LABELS[activeTab]} onMenuClick={() => setSidebarCollapsed(c => !c)}/>
        <main className="flex-1 overflow-y-auto p-6">{renderTab()}</main>
      </div>
    </div>
  );
}
