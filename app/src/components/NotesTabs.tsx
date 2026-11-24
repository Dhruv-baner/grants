"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [{ href: "/notes", label: "Notes" }, { href: "/notes/calls", label: "Calls" }];
/** The two parts of the Notes section: recording a call, and the table of all calls. */
export default function NotesTabs() {
  const path = usePathname();
  return <div className="subnav-wrap"><nav className="subnav mono" aria-label="Notes section">{TABS.map((t) => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>)}</nav></div>;
}
