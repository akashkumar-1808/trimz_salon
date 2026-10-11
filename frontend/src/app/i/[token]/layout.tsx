import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Digital Bill / Invoice — TRiMZ Unisex Salon',
  description: 'Verified digital invoice from TRiMZ Unisex Salon.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PublicInvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700;800;900&family=Mrs+Saint+Delafield&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
