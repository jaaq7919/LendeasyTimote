import type {Metadata} from 'next';
import './globals.css';
import {SidebarLayout} from '@/components/layout/sidebar-layout';
import {Toaster} from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';

export const metadata: Metadata = {
  title: 'LendEasy',
  description: 'Gestión de préstamos informales de manera organizada y automática.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <SidebarLayout>{children}</SidebarLayout>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
