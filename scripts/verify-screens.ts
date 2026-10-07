import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

async function verifyScreenshot(path: string, prompt: string): Promise<string> {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(path).toString("base64");
  const response = await zai.chat.completions.create({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
    max_tokens: 400,
  });
  return response.choices[0]?.message?.content ?? "(sin respuesta)";
}

async function main() {
  const homePrompt =
    "Evalúa esta captura de una página web de juegos llamada axcgames. Verifica y responde en español, punto por punto: 1) ¿El fondo es negro/oscuro premium con letras blancas? 2) ¿Se ve un header con logo AXC GAMES y buscador? 3) ¿Se ve un banner destacado del juego VELOCITY GP con portada de un coche F1? 4) ¿Se ven tarjetas de 4 juegos (Velocity GP, Emergency Strike, Apex Kart, Zona Cero) con portadas? 5) ¿Hay footer con enlaces? 6) ¿Se ve algún defecto de layout, texto cortado, elementos encimados o sin estilo? Sé breve.";
  const gamePrompt =
    "Evalúa esta captura de un portal de juegos. Debe mostrar: una barra superior con botón Volver y controles (favorito, reiniciar, pestaña nueva, pantalla completa), y un área grande con un juego cargándose o cargado dentro de un marco (iframe) en página con tema negro. ¿Se ve así? ¿Algún defecto visual grave? Responde breve en español.";

  console.log("=== HOME ===");
  console.log(
    await verifyScreenshot("/home/z/my-project/download/axcgames-home-final.png", homePrompt)
  );
  console.log("\n=== GAME VIEW ===");
  console.log(
    await verifyScreenshot("/home/z/my-project/download/axcgames-gameview-verify.png", gamePrompt)
  );
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
