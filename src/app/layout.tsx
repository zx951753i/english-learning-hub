import "@fontsource-variable/fraunces";
import "@fontsource-variable/noto-sans-tc";
import "@fontsource-variable/noto-serif-tc";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "English Learning Hub", template: "%s｜English Learning Hub" },
  description: "學生英文自學互動平台",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#073f68" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
