import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { themeBootScript } from "@/components/theme";

/**
 * Geist para a interface e Geist Mono para todo valor medido (FPS, bitrate,
 * ids). As variáveis alimentam --font-sans/--font-mono em brand-tokens.css.
 */
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyScreen",
  description: "Sua tela, com o som do PC, a 60 FPS, no seu próprio servidor.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${geistMono.variable}`}
      // O script de tema escreve `data-theme` antes da hidratação.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <div className="flex min-h-dvh flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
