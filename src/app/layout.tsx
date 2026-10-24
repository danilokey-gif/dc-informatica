import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./aparencia.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import { cookies } from "next/headers";
import { COOKIE_TEMA, lerTema } from "@/lib/aparencia";

export const metadata: Metadata = {
  title: "Dc Informática - Assistência Técnica",
  description: "Sistema de gerenciamento de ordens de serviço, clientes e orçamentos.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dc Informática",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cores escolhidas no botão "Aparência" (cada computador guarda a sua).
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value)
  return (
    <html lang="pt-BR" data-tema={tema}>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
