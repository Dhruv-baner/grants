import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/archivo";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import DemoGuide from "@/components/DemoGuide";
import Nav from "@/components/Nav";
import "./globals.css";
export const metadata: Metadata = { title: "Consulting Toolkit", description: "Screen a company against 127 sourced Dutch, German and EU funding schemes and calls. Indicative only." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <Nav />
      <DemoGuide />
      <main>{children}</main>
      <footer className="footer"><div className="wrap">
        <div className="big">Consulting <span style={{ color: "var(--ember)" }}>Toolkit</span></div>
        <div className="mono"><Link href="/screen">Screen</Link> &nbsp; <Link href="/programmes">Programmes</Link> &nbsp; <Link href="/assistant">Ask</Link> &nbsp; <Link href="/notes">Notes</Link> &nbsp; <Link href="/method">Method</Link></div>
      </div></footer>
    </body></html>
  );
}
