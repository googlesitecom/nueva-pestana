export type Game = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  longDescription: string;
  cover: string;
  url: string;
  categories: string[];
  tags: string[];
  rating: number;
  players: string;
  difficulty: string;
  accent: string;
};

export const games: Game[] = [
  {
    id: "velocity-gp",
    title: "Velocity GP",
    tagline: "El campeonato de F1 definitivo",
    description:
      "Súbete al cockpit de un monoplaza de Fórmula 1 y lucha por la vuelta rápida en circuitos nocturnos a máxima velocidad.",
    longDescription:
      "Velocity GP te pone al volante de un bólido de Fórmula 1 de altas prestaciones. Domina cada sector del circuito, frena en el último metro posible, administra el agarre de tus neumáticos y adelanta a tus rivales en curvas imposibles. Con una física de conducción exigente y un manejo preciso, cada décima cuenta en tu camino hacia lo más alto del podio. Ajusta tu línea de carrera, encadena vueltas perfectas y conviértete en el campeón mundial de la temporada.",
    cover: "/games/velocity-gp.png",
    url: "https://googlesitecom.github.io/googleslides/",
    categories: ["Carreras"],
    tags: ["F1", "Velocidad", "Circuito", "Contrarreloj"],
    rating: 4.9,
    players: "128K",
    difficulty: "Media",
    accent: "#ef4444",
  },
  {
    id: "emergency-strike",
    title: "Emergency Strike",
    tagline: "Táctica y acción sin tregua",
    description:
      "Dirige a un operativo de élite en zonas de combate urbanas. Puntería, reflejos y estrategia lo son todo.",
    longDescription:
      "Emergency Strike es un juego de disparos de acción intensa donde cada misión pone a prueba tus nervios. Infíltrate en escenarios urbanos hostiles, cubre tus ángulos, administra la munición y elimina objetivos tácticos bajo presión. Las oleadas enemigas se vuelven más letales en cada round, así que mejora tu equipamiento, perfecciona tu puntería y mantén la calma cuando el caos estalle. Solo los operativos más fríos sobreviven a la última misión.",
    cover: "/games/emergency-strike.png",
    url: "https://googlesitecom.github.io/Googlecom/",
    categories: ["Disparos", "Acción"],
    tags: ["FPS", "Táctico", "Misiones", "Oleadas"],
    rating: 4.8,
    players: "96K",
    difficulty: "Difícil",
    accent: "#f97316",
  },
  {
    id: "apex-kart",
    title: "Apex Kart",
    tagline: "Derrapes, objetos y caos total",
    description:
      "Carreras de karts estilo arcade con derrapes imposibles, objetos explosivos y pistas llenas de sorpresas.",
    longDescription:
      "Apex Kart es el corredor de karts definitivo: elige tu piloto, toma cada curva en derrape para cargar tu turbo y lanza objetos para dejar atrás a tus rivales. Descubre atajos secretos, salta rampas imposibles y aprovecha cada potenciador del camino. Las carreras son caóticas y cualquier cosa puede pasar hasta la última vuelta: un misil bien lanzado puede cambiarte la victoria. Fácil de jugar, difícil de dominar.",
    cover: "/games/apex-kart.png",
    url: "https://googlesitecom.github.io/gmail/",
    categories: ["Carreras", "Casual"],
    tags: ["Karts", "Arcade", "Derrapes", "Objetos"],
    rating: 4.7,
    players: "215K",
    difficulty: "Fácil",
    accent: "#22c55e",
  },
  {
    id: "zona-cero",
    title: "Zona Cero",
    tagline: "Sobrevive o desaparece",
    description:
      "Sobrevive en una zona de exclusión llena de amenazas. Recolecta, mejora tu equipo y sé el último en pie.",
    longDescription:
      "Zona Cero te lanza a un mapa de supervivencia hostil donde cada decisión puede ser la última. Recolecta recursos, fabrica mejoras y elimina cualquier amenaza mientras la zona segura se cierra a tu alrededor, obligándote a enfrentarte con otros supervivientes. El mapa castiga la lentitud y premia la agresión inteligente: controla el botín, domina el terreno y decide cuándo luchar y cuándo esconderse. Solo un jugador se alzará con la victoria.",
    cover: "/games/zona-cero.png",
    url: "https://nflowstudios.github.io/Googlemeet/",
    categories: ["Supervivencia", "Acción"],
    tags: ["Battle Royale", "Io", "Supervivencia", "Recursos"],
    rating: 4.8,
    players: "342K",
    difficulty: "Media",
    accent: "#eab308",
  },
  {
    id: "jeffcraft",
    title: "Jeffcraft",
    tagline: "Construye, mina y sobrevive entre bloques",
    description:
      "Mundo voxel sin límites: mina recursos, construye lo que imagines y sobrevive a la noche en un universo de bloques.",
    longDescription:
      "Jeffcraft te abandona en un mundo de bloques generado al infinito donde cada montaña, cueva y bosque puede explorarse y destruirse. Recoge madera, piedra y minerales raros para fabricar herramientas cada vez mejores, construye tu refugio antes de que caiga la noche y defiéndelo de todo lo que se mueve en la oscuridad. Sueldos bloques para levantar desde una cabaña humilde hasta un castillo imposible, experimenta con granjas automáticas y redstone, o simplemente recorre el mapa en busca de aldeas y tesoros enterrados. Un sandbox puro donde tú pones las reglas y la creatividad es el único límite.",
    cover: "/games/jeffcraft.png",
    url: "https://googlesitecom.github.io/Google-Classroom/",
    categories: ["Sandbox", "Supervivencia"],
    tags: ["Voxel", "Construcción", "Minería", "Mundo abierto"],
    rating: 4.9,
    players: "1.2M",
    difficulty: "Fácil",
    accent: "#10b981",
  },
  {
    id: "grand-theft-voxel",
    title: "Grand Theft Voxel",
    tagline: "El crimen en un mundo de bloques",
    description:
      "Roba coches, escapa de la policía y causa el caos en una ciudad voxel que puedes explorar y destruir entera.",
    longDescription:
      "Grand Theft Voxel mezcla la libertad del crimen a mundo abierto con un universo completamente construido en bloques. Roba cualquier coche que encuentres en la calle, siembra el pánico mientras las estrellas de búsqueda se acumulan y la policía te persigue por toda la ciudad. Salta entre edificios cuadrados, descubre atajos por los callejones y usa el entorno destructible a tu favor: si un bloque estorba, simplemente rompe y abre tu propio camino. Explora libremente la ciudad, cumple misiones y conviértete en el criminal más buscado del mundo voxel.",
    cover: "/games/grand-theft-voxel.png",
    url: "https://googlesitecom.github.io/GTV/",
    categories: ["Acción", "Sandbox"],
    tags: ["Mundo abierto", "Voxel", "Coches", "Policía"],
    rating: 4.9,
    players: "418K",
    difficulty: "Media",
    accent: "#ec4899",
  },
];

export const allCategories = [
  "Todos",
  "Carreras",
  "Disparos",
  "Acción",
  "Sandbox",
  "Supervivencia",
  "Casual",
];

export const featuredGame = games[0];
