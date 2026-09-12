import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Factory",
  description: "AI-решения для роста бизнеса"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
