'use client';
import Image from 'next/image';
import { TabId } from '@/lib/types/inventory';
import { logOut } from '@/lib/firebase/auth';

interface Props {
  activeTab: TabId; onTabChange: (t: TabId) => void;
  collapsed: boolean; onToggleCollapse: () => void;
}

const NAV: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'borrow',    label: 'Borrow Item',    icon: 'M12 4v16m8-8H4' },
  { id: 'borrowed',  label: 'Borrowed Items', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'returned',  label: 'Returned Items', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'inventory', label: 'Inventory',      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'vehicle',   label: 'Vehicles',       icon: 'M8 17l-1.5-5.5L5 10h14l-1.5 1.5L16 17M3 17h18M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M9 17v1m6-1v1' },
  { id: 'vendor-return', label: 'Vendor Returns', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' }, // ← NEW
  { id: 'history',   label: 'History',        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'profile',   label: 'Profile',        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

export default function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: Props) {
  return (
    <aside className="flex flex-col bg-purple-950 text-white flex-shrink-0 transition-all duration-200"
      style={{ width: collapsed ? 64 : 240 }}>

      {/* Header */}
      <div className="flex items-center h-[60px] px-4 border-b border-purple-800 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              <Image src="/logo/639041159_928934899785899_6548860578269527636_n.png" alt="5CRG logo" width={28} height={28} className="object-cover" />
            </div>
            <span className="text-sm font-bold tracking-wide whitespace-nowrap">5CRG IMS</span>
          </div>
        )}
        <button onClick={onToggleCollapse}
          className="ml-auto p-1.5 rounded-lg hover:bg-purple-800 transition flex-shrink-0">
          <svg className="w-4 h-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            }
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV.map(item => (
          <button key={item.id} onClick={() => onTabChange(item.id)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center text-sm font-medium transition ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 ${activeTab === item.id ? 'bg-purple-700 text-white' : 'text-purple-300 hover:bg-purple-900 hover:text-white'}`}>
            <svg className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon}/>
            </svg>
            {!collapsed && <span className="whitespace-nowrap truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-purple-800 p-3 flex-shrink-0">
        <button onClick={async () => { await logOut(); window.location.href = '/'; }}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center justify-center text-sm font-medium transition ${collapsed ? 'px-0' : 'gap-3 px-4'} py-2.5 rounded-lg text-purple-300 hover:bg-purple-900 hover:text-white`}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}