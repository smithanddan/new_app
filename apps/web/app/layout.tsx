import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LabMind',
  description: 'Импорт, история и понятный разбор лабораторных анализов',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
