'use client';
import { useAuth } from '@/lib/firebase/AuthContext';

export default function TopBar({ tabLabel, onMenuClick }: { tabLabel: string; onMenuClick: () => void }) {
  const { user } = useAuth();
  const name = user?.displayName || user?.email || 'Admin';
  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0 z-10">
      <h1 className="text-lg font-semibold text-gray-800">{tabLabel}</h1>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{name}</p>
          <p className="text-xs text-gray-500">Administrator</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center">
          <span className="text-white text-sm font-semibold">{name.charAt(0).toUpperCase()}</span>
        </div>
      </div>
    </header>
  );
}