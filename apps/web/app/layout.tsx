import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Reel AI Studio",
  description: "AI showrunner studio for short-form business reels.",
  icons: {
    icon: "/reelai_logo.jpeg",
    apple: "/reelai_logo.jpeg",
  },
  openGraph: {
    title: "Reel AI Studio",
    description: "AI showrunner studio for short-form business reels.",
    images: [{ url: "/reelai_logo.jpeg", width: 1254, height: 1254 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
