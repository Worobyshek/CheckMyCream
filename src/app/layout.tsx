import type { Metadata } from "next";
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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
