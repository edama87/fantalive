import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav, SideNav } from "@/components/layout/bottom-nav";
import { KickoffReminders } from "@/components/notify/kickoff-reminders";
import { LiveEventNotifier } from "@/components/notify/live-event-notifier";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FantaLive Bundlesliga",
  description: "Live fantacalcio head-to-head per la Bundlesliga",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans pb-16 lg:pb-0 lg:pl-56">
        <SideNav />
        <main className="flex-1 max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto w-full">
          {children}
        </main>
        <BottomNav />
        <KickoffReminders />
        <LiveEventNotifier />
      </body>
    </html>
  );
}
