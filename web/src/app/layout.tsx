import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { DatabaseHealthChecker } from '@/components/DatabaseHealthChecker';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'Flight Delay Monitor - Dự báo trễ chuyến bay Việt Nam',
  description:
    'Theo dõi và dự báo độ trễ chuyến bay tại 3 sân bay lớn nhất Việt Nam: Nội Bài, Đà Nẵng, Tân Sơn Nhất.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full">
      <body className={`${inter.className} h-full flex flex-col antialiased bg-gray-50`}>
        <ToastProvider>
          <DatabaseHealthChecker />
          <Navbar />
          <main className="flex-1">
            <div className="max-w-8xl mx-auto px-1 sm:px-2 lg:px-4 py-8">
              {children}
            </div>
          </main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
