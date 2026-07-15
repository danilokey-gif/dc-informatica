import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dc Informática - Assistência Técnica",
  description: "Sistema de gerenciamento de ordens de serviço, clientes e orçamentos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
