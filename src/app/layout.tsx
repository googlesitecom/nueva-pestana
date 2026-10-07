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

const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  metadataBase: new URL("https://googlesitecom.github.io/nueva-pestana"),
  title: "nueva-pestaña",
  description:
    "Tu página de inicio: juegos, chat y amigos. Velocity GP, Emergency Strike, Apex Kart, Zona Cero y Jeffcraft. Sin descargas, juega al instante en tu navegador.",
  keywords: [
    "juegos",
    "juegos gratis",
    "jugar online",
    "Velocity GP",
    "Emergency Strike",
    "Apex Kart",
    "Zona Cero",
    "Jeffcraft",
  ],
  authors: [{ name: "nueva-pestaña" }],
  icons: {
    icon: [{ url: `${BP}/icon.png`, type: "image/png", sizes: "512x512" }],
    apple: [{ url: `${BP}/apple-icon.png`, type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "nueva-pestaña",
    description:
      "Tu portal premium: Velocity GP, Emergency Strike, Apex Kart, Zona Cero y Jeffcraft. Juega sin descargas.",
    siteName: "nueva-pestaña",
    type: "website",
    images: [{ url: `${BP}/logo-full.png`, width: 1024, height: 1024 }],
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
