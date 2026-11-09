// Copia a marca (brand/) para o site: tokens, favicon e ícone da Apple.
// A fonte da identidade mora aqui; o site recebe cópias. Uso:
//   npm run brand:sync              (site em ../MyScreen)
//   npm run brand:sync -- <pasta>   (site em outro lugar)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const site = path.resolve(process.argv[2] ?? "../MyScreen");
if (!existsSync(path.join(site, "src/app"))) {
  console.error(`não achei o site em ${site} (esperava src/app/)`);
  process.exit(1);
}
const header = "/* GERADO por MyScreen-app/scripts/sync-brand.mjs a partir de brand/tokens.css — não edite aqui. */\n";
writeFileSync(path.join(site, "src/app/brand-tokens.css"), header + readFileSync("brand/tokens.css", "utf8"));
copyFileSync("brand/mark.svg", path.join(site, "src/app/icon.svg"));
copyFileSync("build/icon.png", path.join(site, "src/app/apple-icon.png"));
console.log(`marca sincronizada em ${site}`);
