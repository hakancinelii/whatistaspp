import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatIstaspp - WhatsApp Toplu Mesaj Platformu",
  description: "Multi-tenant WhatsApp mesajlaşma platformu - Güvenli, hızlı ve kolay",
  keywords: ["whatsapp", "toplu mesaj", "bulk messaging", "saas"],
  manifest: "/manifest.json",
};

import { NotificationProvider } from "@/context/NotificationContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        margin: 0,
        padding: 0
      }}>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
