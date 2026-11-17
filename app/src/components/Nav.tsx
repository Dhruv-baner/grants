"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const LINKS = [["/", "Overview"], ["/screen", "Screen a company"], ["/programmes", "Programmes"], ["/deadlines", "Deadlines"], ["/data", "Data trust"]];
export default function Nav() {
  const p = usePathname();
  return (
    <div className="nav"><div className="wrap">
      <Link href="/" className="brand">Grants <b>&amp;</b> Funding</Link>
      {LINKS.map(([h, l]) => <Link key={h} href={h} className={"link" + (p === h ? " on" : "")}>{l}</Link>)}
      <span className="spacer" /><span className="tag">demo mode, no AI calls</span>
    </div></div>
  );
}
