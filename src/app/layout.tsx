import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav, SideNav } from "@/components/layout/bottom-nav";
import { KickoffReminders } from "@/components/notify/kickoff-reminders";
import { LiveEventNotifier } from "@/components/notify/live-event-notifier";
import { ServiceWorkerRegister } from "@/components/notify/sw-register";
import { PushSync } from "@/components/notify/push-sync";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FantaLive Bundlesliga",
  description: "Live fantacalcio head-to-head per la Bundlesliga",
  applicationName: "FantaLive",
  // iOS: apple-mobile-web-app-capable + titolo e icona per l'app dalla schermata Home.
  appleWebApp: { capable: true, title: "FantaLive", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Next emette solo mobile-web-app-capable: il tag Apple storico serve ai vecchi iOS.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#059669",
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
        <ServiceWorkerRegister />
        <PushSync />
      </body>
    </html>
  );
}
