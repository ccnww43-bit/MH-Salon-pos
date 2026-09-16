"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { ModeBanner } from "@/components/mode-banner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [rightSidebarOpen, setRightSidebarOpen] =
    useState(true);

  const isLoginPage =
    pathname === "/" || pathname === "/setup";

  // The POS screen has its own 400px cart panel plus a product grid whose
  // column count is decided by total window width. The 280px "Quick
  // Actions" right panel doesn't add anything useful while a cashier is
  // already on POS (its only links are shortcuts to *get to* POS,
  // bookings, etc.), so hiding it here gives the POS grid that 280px
  // back on every machine size — laptop, POS terminal, or desktop —
  // instead of the product cards getting squeezed on the smaller ones.
  const isPosPage = pathname === "/pos";

  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased font-sans text-slate-900 selection:bg-blue-600 selection:text-white overflow-x-hidden`}
      >
        {isLoginPage ? (
          <main className="min-h-screen flex flex-col">
            <ModeBanner />

            <div className="flex-1">
              {children}
            </div>
          </main>
        ) : (
          <div className="min-h-screen bg-slate-50">
            <ModeBanner />

            <Sidebar />

            <div className="flex h-screen pt-0 lg:pl-[245px]">
              <main className="app-scroll min-w-0 flex-1 min-h-0 overflow-y-auto lg:pt-0">
                {children}
              </main>

              <RightSidebar
                open={rightSidebarOpen && !isPosPage}
                onClose={() =>
                  setRightSidebarOpen(false)
                }
              />
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
