import type { Metadata } from "next";
import Assistant from "@/components/Assistant";
import { IN_SCOPE } from "@/lib/assistant/knowledge";

export const metadata: Metadata = { title: "Ask the consultant", description: "What documents a funding programme asks for, its deadline, and who can apply, for the programmes with complete information." };
export default function Page() {
  return (
    <div className="wrap ask" style={{ paddingTop: "var(--s7)" }}>
      <p className="mono muted">Ask the consultant <span className="beta-tag">Beta</span></p>
      <h1 className="ask-h1">What do I need to apply?</h1>
      <p className="ask-lede">Ask what documents a programme requires, when it closes, and who can apply. It answers for the {IN_SCOPE.length} programmes with complete information, from the same sourced data as the rest of this site. For anything else it says so.</p>
      <Assistant />
    </div>
  );
}
