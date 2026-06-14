import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LabPrice OS",
  description: "Сравнение цен лабораторий, корзины анализов и pricing intelligence API"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
