import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "axcgames — Juega gratis al instante",
  description:
    "axcgames: tu portal de juegos gratis estilo premium. Carreras, disparos, acción y supervivencia. Sin descargas, juega al instante en tu navegador.",
  keywords: [
    "axcgames",
    "juegos",
    "juegos gratis",
    "jugar online",
    "Velocity GP",
    "Emergency Strike",
    "Apex Kart",
    "Zona Cero",
  ],
  authors: [{ name: "axcgames" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "axcgames — Juega gratis al instante",
    description:
      "Tu portal de juegos premium: Velocity GP, Emergency Strike, Apex Kart y Zona Cero. Juega sin descargas.",
    siteName: "axcgames",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased bg-[#050505] text-white`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
