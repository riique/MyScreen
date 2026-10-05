import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os handlers leem `process.env` no import. O `.env` local pode nao existir
    // em CI, entao o segredo vem daqui, nunca de um arquivo.
    env: {
      LIVEKIT_API_KEY: "chavede-teste",
      LIVEKIT_API_SECRET: "segredode-teste-com-tamanho-suficiente-para-o-hmac",
      LIVEKIT_URL: "http://localhost:7880",
      DATABASE_URL: "file:./test.sqlite",
    },
  },
});
