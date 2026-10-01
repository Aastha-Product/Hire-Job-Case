import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Nav from "./nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Kargo Hiring",
  description: "Ranked shortlist, briefs and drafts for Kargo's PM and SPM roles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <header className="top">
          <Link href="/" className="brand">
            <span className="logo">K</span>
            <span className="brand-text">Kargo Hiring</span>
          </Link>
          <Nav />
          <span className="tagline">The system recommends. Arjun decides.</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
