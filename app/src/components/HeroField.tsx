"use client";
import { useRouter } from "next/navigation";
import DotField from "./DotField";
export default function HeroField() {
  const r = useRouter();
  return <DotField ambient urgent label="All 127 schemes and calls, one dot each" onPick={(s) => { r.push(`/programmes#${s.id}`); setTimeout(() => window.dispatchEvent(new CustomEvent("gf:scheme", { detail: s.id })), 80); }} />;
}
