"use client";
import Link from "next/link";
/** Starts the guided demo. It is a link in look and in keyboard use, and falls back to the Notes page without scripts. */
export default function DemoStart() {
  return <Link className="link-u" href="/notes" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event("gf:demo-start")); }}>Run the guided demo</Link>;
}
