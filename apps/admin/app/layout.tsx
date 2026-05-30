import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Monitor Admin",
  description: "Admin panel for website monitoring and price intelligence"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
