import type { NextConfig } from "next";

/**
 * Configuración para GitHub Pages (hosting estático).
 *
 * - output: "export" genera el sitio estático en ./out
 * - NEXT_PUBLIC_BASE_PATH: se define al compilar cuando el sitio se sirve
 *   bajo un subdirectorio (p. ej. https://usuario.github.io/nueva-pestana/).
 *   En desarrollo no se define y la app se sirve desde la raíz.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(basePath ? { basePath, trailingSlash: true } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
