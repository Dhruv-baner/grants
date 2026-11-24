import type { Metadata } from "next";
import Notes from "@/components/Notes";

export const metadata: Metadata = { title: "Notes", description: "Record a call and get structured notes with the quotes behind every point, a funding rule check and a standard CRM record." };
export default function Page() { return <Notes />; }
