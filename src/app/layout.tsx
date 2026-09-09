import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EventFlow — Event Management System",
  description:
    "EventFlow brings event planning, team coordination, task boards and notifications together — run flawless events from one place.",
  keywords: ["EventFlow", "event management", "teams", "tasks", "kanban", "planning", "Next.js"],
  authors: [{ name: "EventFlow" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "EventFlow — Event Management System",
    description: "Plan events. Coordinate teams. Ship on time.",
    siteName: "EventFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EventFlow — Event Management System",
    description: "Plan events. Coordinate teams. Ship on time.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
