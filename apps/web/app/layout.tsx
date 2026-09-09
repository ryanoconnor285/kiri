import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiri — STEM Flashcards",
  description: "Hybrid STEM flashcard platform for pre-med and science coursework",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
