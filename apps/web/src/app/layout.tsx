import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beanstick - Agentic Fiat↔Crypto Onramp",
  description: "Your AI wallet swaps fiat↔crypto without custodians. Powered by zkTLS proofs, 0G blockchain, and autonomous agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-[#F5F5F5] text-black">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
