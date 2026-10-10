import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Trimz Salon — Business Management & Operations Platform',
  description: 'Enterprise Salon Operations, POS Billing, Inventory, Staff & Customer Management Platform.',
  icons: {
    icon: '/trimz.png',
    shortcut: '/trimz.png',
    apple: '/trimz.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-workspace-bg text-text-primary min-h-screen antialiased selection:bg-primary-light selection:text-primary">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
