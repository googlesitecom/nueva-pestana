/**
 * Utilidades de rutas para GitHub Pages.
 *
 * El sitio se sirve bajo un subdirectorio
 * (https://googlesitecom.github.io/nueva-pestana/), así que todo asset
 * público referenciado con una ruta absoluta debe llevar el prefijo
 * NEXT_PUBLIC_BASE_PATH (definido al compilar en el workflow de Pages).
 *
 * En desarrollo la variable no se define y la ruta se devuelve tal cual.
 *
 * Uso: <Image src={asset("/logo-emblem.png")} … /> o
 *      <Image src={asset(game.cover)} … />
 */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefija la ruta pública con el basePath del despliegue. */
export function asset(path: string): string {
  if (!BASE_PATH) return path;
  if (path.startsWith(BASE_PATH)) return path;
  return `${BASE_PATH}${path}`;
}
