import { Inter, Lexend } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  weight: ["400", "500", "700"],
});

export const appfonts = `${inter.variable}  ${lexend.variable}   antialiased`;
