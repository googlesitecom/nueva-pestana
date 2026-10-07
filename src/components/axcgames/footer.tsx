"use client";

import { Gamepad2, Heart } from "lucide-react";

type Props = {
  onNavigate: (sectionId: string) => void;
};

export default function Footer({ onNavigate }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#070707]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-lg shadow-amber-500/20">
                <Gamepad2 className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <span className="font-display text-lg font-extrabold tracking-wider">
                <span className="text-white">AXC</span>
                <span className="text-amber-400">GAMES</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Tu portal premium de juegos gratis. Sin descargas, sin registros: entra, elige tu
              juego y juega al instante desde tu navegador, todo dentro de la misma página.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-14 gap-y-8 sm:grid-cols-3">
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white/85">
                Navegación
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate("inicio")}
                    className="text-white/50 transition hover:text-amber-400"
                  >
                    Inicio
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate("juegos")}
                    className="text-white/50 transition hover:text-amber-400"
                  >
                    Todos los juegos
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate("favoritos")}
                    className="flex items-center gap-1.5 text-white/50 transition hover:text-amber-400"
                  >
                    <Heart className="h-3.5 w-3.5" />
                    Favoritos
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white/85">
                Categorías
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {["Carreras", "Disparos", "Acción", "Supervivencia"].map((cat) => (
                  <li key={cat}>
                    <button
                      type="button"
                      onClick={() => onNavigate("juegos")}
                      className="text-white/50 transition hover:text-amber-400"
                    >
                      {cat}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white/85">
                Juegos
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li className="text-white/50">Velocity GP</li>
                <li className="text-white/50">Emergency Strike</li>
                <li className="text-white/50">Apex Kart</li>
                <li className="text-white/50">Zona Cero</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/40 sm:flex-row">
          <p>© {year} axcgames. Todos los derechos reservados.</p>
          <p className="flex items-center gap-1.5">
            Hecho para jugadores, por jugadores
            <Gamepad2 className="h-3.5 w-3.5 text-amber-400/70" />
          </p>
        </div>
      </div>
    </footer>
  );
}
