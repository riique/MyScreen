import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@livekit/components-styles";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyScreen — Transmissão de Tela, Câmera e Áudio em Tempo Real",
  description:
    "Plataforma completa de transmissão de tela de alta taxa de quadros e áudio do sistema com câmera concomitante.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#090a0f] text-foreground antialiased`}>
        <div className="relative flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
