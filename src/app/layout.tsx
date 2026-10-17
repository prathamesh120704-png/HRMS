import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tarang HRMS',
  description: 'Employee records, attendance and leave for Konkan Coastal Foods',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <a className="skip" href="#main">Skip to content</a>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
