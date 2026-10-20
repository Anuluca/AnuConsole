import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { PageTransition } from "@/components/page-transition";
import { RouteProgressProvider } from "@/components/route-progress";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./brand-fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AnuConsole", template: "%s · AnuConsole" },
  description: "Anutrium 网站管理控制台",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://assets.anuluca.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://assets.anuluca.com/fonts/unbounded/unboundedsans-latin.b28252ecd183.woff2?v=3ee43649a8ae-anuconsole-20261017"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <RouteProgressProvider>
            <PageTransition>{children}</PageTransition>
          </RouteProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
