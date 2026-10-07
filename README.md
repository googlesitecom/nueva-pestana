# nueva-pestaña · axcgames

Portal de juegos estilo Poki con tema dark premium: juega dentro de la página y chatea con amigos **sin servidor** — todo funciona desplegado en [GitHub Pages](https://googlesitecom.github.io/nueva-pestana/).

## Qué incluye

- 🎮 **5 juegos embebidos** (iframe con pantalla completa, reinicio y favoritos): Velocity GP, Emergency Strike, Apex Kart, Zona Cero y Jeffcraft.
- 👤 **Cuentas reales sin email**: usuario + contraseña hasheada con PBKDF2 (Web Crypto). Las cuentas viven en el navegador del usuario — no hay base de datos.
- 💬 **Chat estilo Discord sin backend**: amigos, mensajes directos, grupos, escribiendo…, presencia en línea.
- 📞 **Llamadas de voz y vídeo (WebRTC)** entre usuarios conectados.
- 🔔 **Notificaciones en todo momento**: toasts, sonido, Notification API del navegador y contador `(N)` en el título de la pestaña — también mientras juegas.

## Cómo funciona el chat sin servidor

La comunicación en tiempo real es **peer-to-peer** con [Trystero](https://github.com/dmotz/trystero): la señalización viaja por relés Nostr públicos y los datos (mensajes, voz y vídeo) fluyen directamente entre navegadores mediante WebRTC. Solo necesitáis tener la web abierta a la vez.

## Desarrollo

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint     # ESLint
```

## Despliegue

El workflow de GitHub Actions (`.github/workflows/deploy.yml`) compila el sitio estático y lo publica en GitHub Pages en cada push a `main`:

```bash
NEXT_PUBLIC_BASE_PATH=/nueva-pestana bun run build   # genera ./out
```

> `NEXT_PUBLIC_BASE_PATH` solo es necesario al servir el sitio bajo un subdirectorio. Para un dominio propio o `usuario.github.io` raíz, compila sin esa variable.
