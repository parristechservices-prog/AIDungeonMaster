import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PartyQuest V0",
  description: "Solo fantasy tabletop RPG prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeToggle />
        {children}
        <script
          src="https://cdn.jsdelivr.net/gh/joshualparris/JoshHub@main/public/podcast-dock-universal.js"
          data-bank="dnd"
          data-label="🎲 Listen to a different D&D podcast"
          data-only-paths="/|/start|/builder"
          data-quiet-on-input="true"
          defer
        />
      </body>
    </html>
  );
}
