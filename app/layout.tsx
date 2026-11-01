import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "Dictaloop · English dictation practice",
  description: "Import audio and subtitles, listen sentence by sentence and write down what you hear.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dictaloop",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><PwaRegister />{children}</body>
    </html>
  );
}
