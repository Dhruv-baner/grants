import type { Metadata } from "next";
import Calls from "@/components/Calls";

export const metadata: Metadata = { title: "Calls", description: "One row per recorded call: company, sector, country, region, size, project, budget, status and a short summary, editable and exportable." };
export default function Page() { return <Calls />; }
