import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

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
      <head>
        {/*
          Typography: webfonts load client-side from the Google Fonts CDN.
          next/font/google CANNOT be used here — it downloads font files at
          build/compile time and this sandbox has no outbound access to
          fonts.gstatic.com (Turbopack fails with "Module not found: …/font/google/font").
          A plain <link> is build-safe: the browser fetches it at runtime and,
          if unreachable, the system-font fallback stacks defined on :root in
          globals.css take over (display=swap keeps text visible throughout).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: this root-layout head IS global for all pages */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
