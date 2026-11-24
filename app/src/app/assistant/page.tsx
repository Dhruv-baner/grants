import type { Metadata } from "next";
import Assistant from "@/components/Assistant";

export const metadata: Metadata = { title: "Ask the consultant", description: "What documents a funding programme asks for, its deadline, and who can apply, with the source for every answer." };
export default function Page() { return <Assistant />; }
