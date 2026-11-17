import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import Nav from "@/components/Nav";
import { META } from "@/lib/data";
import { fmtDate } from "@/lib/ui";
import "./globals.css";
export const metadata: Metadata = { title: "Grants and Funding", description: "Screen a company against 127 sourced Dutch, German and EU funding schemes and calls. Indicative only." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <div className="strip"><div className="wrap"><i aria-hidden="true" /><span className="mono">Indicative screening only</span><span className="mono">Consultant review required</span><span className="mono faint">Data as of {fmtDate(META.as_of)}</span></div></div>
      <Nav />
      <main>{children}</main>
      <footer className="footer"><div className="wrap">
        <div className="big">Grants <em style={{ color: "var(--ember)" }}>and</em> Funding</div>
        <div className="grid12"><div style={{ gridColumn: "span 6" }}><p>Indicative screening only. Consultant review required. Not legal or financial advice. Rates, caps and deadlines are true only as of {fmtDate(META.as_of)}. Sample companies are fictional.</p></div>
          <div style={{ gridColumn: "span 6" }} className="mono"><Link href="/screen">Screen</Link> &nbsp; <Link href="/programmes">Programmes</Link> &nbsp; <Link href="/deadlines">Deadlines</Link> &nbsp; <Link href="/method">Method</Link></div></div>
      </div></footer>
    </body></html>
  );
}
