import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import PwaRegister from "./pwa-register";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Dictaloop · English dictation practice",
  description: "Import audio and subtitles, listen sentence by sentence and write down what you hear.",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dictaloop",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
    apple: `${basePath}/favicon.svg`,
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
