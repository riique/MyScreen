import type { Metadata, Viewport } from "next";
import { Archivo, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

/**
 * Duas faces, um trabalho cada. Archivo tem osso de grotesk impressa e Caps que
 * aguentam a coluna; Spline Sans Mono tem algarismo tabular de verdade, que e o
 * que segura valor de coluna numa folha pautada. Nenhuma das duas e fallback de
 * sistema: a voz da pagina e delas.
 */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-spline-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyScreen — Transmissão de Tela, Câmera e Áudio em Tempo Real",
  description:
    "Plataforma completa de transmissão de tela de alta taxa de quadros e áudio do sistema com câmera concomitante.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${splineMono.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <div className="flex min-h-dvh flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
