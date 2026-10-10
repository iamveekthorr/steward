import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";
import "./steward.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: { default: "Steward", template: "%s · Steward" },
  description: "Workforce management for diaspora managers and their links",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
