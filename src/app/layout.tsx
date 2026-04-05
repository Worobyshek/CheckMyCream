import type { Metadata } from "next";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Check My Cream",
  description:
    "",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
    >
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
        >
          {`(() => {
            try {
              const storageKey = "check-my-cream-theme";
              const savedTheme = window.localStorage.getItem(storageKey);
              const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
              const theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : systemTheme;
              document.documentElement.dataset.theme = theme;
            } catch {}
          })();`}
        </Script>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
