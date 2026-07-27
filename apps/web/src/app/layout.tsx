import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tablia | Personas",
  description: "Administración de personas con Next.js y AWS"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
