import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";
export const metadata: Metadata = { title: "Grants and Funding: funding screening for NL, DE and EU", description: "Screen a company against 127 sourced Dutch, German and EU funding schemes. Indicative only." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <div className="banner">Indicative screening only. Consultant review required. Rates, caps and deadlines are true as of 17 Nov 2026.</div>
      <Nav />
      <main><div className="wrap">{children}</div></main>
      <div className="footer"><div className="wrap">Grants and Funding data layer v1.0.0. Demo companies are fictional. Not legal or financial advice.</div></div>
    </body></html>
  );
}
