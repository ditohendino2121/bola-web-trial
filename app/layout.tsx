import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import Shell from "../components/Shell";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"] });

export const metadata: Metadata = {
  title: "MUBA FC",
  description: "Komunitas futsal Masjid Utsman Bin Affan — jadwal main, top-up kredit, dan liga internal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={archivo.variable}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MUBA FC" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-192.png" />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
