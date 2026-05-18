import { Geist, Geist_Mono } from "next/font/google";
import Template from "@/components/layout/Template";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "P-O-A design studio",
  description:
    "P-O-A is a collaborative practice and design studio based in Naarm Melbourne. The studio brings together three distinct sensibilities through a shared commitment to typographic thinking, research driven methodologies and a belief in design as a form of cultural practice.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Template>{children}</Template>
      </body>
    </html>
  );
}
