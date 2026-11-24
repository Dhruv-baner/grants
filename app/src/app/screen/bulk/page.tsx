import type { Metadata } from "next";
import Bulk from "@/components/Bulk";

export const metadata: Metadata = { title: "Screen a list", description: "Upload a CSV of companies and see which funding programmes fit each one, ranked, with a heat map and a CSV to export." };
export default function Page() { return <Bulk />; }
