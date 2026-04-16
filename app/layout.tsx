import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/firebase/AuthContext';

export const metadata: Metadata = {
  title: '5CRG Inventory Management System',
  description: 'Internal inventory and borrow tracking — 5CRG',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
