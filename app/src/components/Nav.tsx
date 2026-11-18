"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCHEMES } from "@/lib/data";

const PAGES = [{ href: "/screen", label: "Screen a company" }, { href: "/programmes", label: "Programmes" }, { href: "/deadlines", label: "Deadlines" }, { href: "/assistant", label: "Ask the consultant" }, { href: "/method", label: "How fit is judged" }];

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter(); const [q, setQ] = useState(""); const [sel, setSel] = useState(0); const inp = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    const all = [...PAGES.map((p) => ({ key: p.href, label: p.label, sub: "Page", href: p.href, id: "" })), ...SCHEMES.map((s) => ({ key: s.id, label: s.name, sub: `${s.country} · ${s.type_group}`, href: `/programmes#${s.id}`, id: s.id, hay: (s.name + " " + s.aliases + " " + s.id).toLowerCase() }))];
    return all.filter((i) => t.every((w) => ((i as { hay?: string }).hay ?? i.label.toLowerCase()).includes(w))).slice(0, 40);
  }, [q]);
  useEffect(() => { inp.current?.focus(); }, []); useEffect(() => { setSel(0); }, [q]);
  const go = (i: (typeof items)[number]) => { onClose(); router.push(i.href); if (i.id) setTimeout(() => window.dispatchEvent(new CustomEvent("gf:scheme", { detail: i.id })), 80); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose(); else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === "Enter" && items[sel]) go(items[sel]);
  };
  return (
    <div className="pal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Search programmes and pages" onKeyDown={onKey}>
        <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schemes or pages" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={items[sel] ? "pal-" + items[sel].key : undefined} />
        <ul id="pal-list" role="listbox">{items.map((i, n) => <li key={i.key} id={"pal-" + i.key} role="option" aria-selected={n === sel}><button onClick={() => go(i)} onMouseEnter={() => setSel(n)} tabIndex={-1}><span>{i.label}</span><span className="mono" style={{ opacity: .7 }}>{i.sub}</span></button></li>)}{!items.length && <li style={{ padding: "12px 22px" }} className="faint">Nothing matches.</li>}</ul>
        <div className="hint mono"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div>
      </div>
    </div>
  );
}

export default function Nav() {
  const path = usePathname(); const [live, setLive] = useState(false); const [menu, setMenu] = useState(false); const [pal, setPal] = useState(false);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then((s) => setLive(!!s.live)).catch(() => setLive(false)); }, []);
  useEffect(() => { setMenu(false); }, [path]);
  const openPal = useCallback(() => { setMenu(false); setPal(true); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal((p) => !p); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useEffect(() => { document.body.style.overflow = menu || pal ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menu, pal]);
  return (
    <>
      <header className="nav"><div className="wrap">
        <Link href="/" className="brand" aria-label="Grants and Funding, home">Grants <b>and</b> Funding</Link>
        <nav className="nav-links mono" aria-label="Main">{PAGES.map((p) => <Link key={p.href} href={p.href} aria-current={path === p.href ? "page" : undefined}>{p.label.replace("How fit is judged", "Method").replace("Ask the consultant", "Ask")}</Link>)}</nav>
        {live && <span className="live mono">Live</span>}
        <button className="kbd mono" onClick={openPal} aria-label="Search (Ctrl or Command K)">Search <span style={{ opacity: .6 }}>⌘K</span></button>
        <button className="menu-btn mono" onClick={() => setMenu(true)} aria-expanded={menu}>Menu</button>
      </div></header>
      {menu && <div className="menu" role="dialog" aria-modal="true" aria-label="Menu"><div className="top"><span className="brand">Grants <b>and</b> Funding</span><button className="menu-btn mono" style={{ display: "inline-flex", borderColor: "var(--cream)", color: "var(--cream)" }} onClick={() => setMenu(false)}>Close</button></div>
        {PAGES.map((p) => <Link key={p.href} href={p.href}>{p.label}<span className="mono">→</span></Link>)}<button className="mono" style={{ all: "unset", cursor: "pointer", marginTop: 28, color: "var(--cream-2)" }} onClick={openPal}>Search all programmes ⌘K</button></div>}
      {pal && <Palette onClose={() => setPal(false)} />}
    </>
  );
}
