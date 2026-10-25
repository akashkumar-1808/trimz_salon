import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import TypographyProvider from '@/components/TypographyProvider';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=Lato:wght@400;700&family=Manrope:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700&family=Nunito+Sans:opsz,wght@6..12,400..700&family=Open+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Source+Sans+3:wght@400;600;700&family=Urbanist:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-workspace-bg text-text-primary min-h-screen antialiased selection:bg-primary-light selection:text-primary">
        <AuthProvider>
          <TypographyProvider>
            {children}
          </TypographyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
