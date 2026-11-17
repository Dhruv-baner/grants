import { vClass, vLabel } from "@/lib/ui";
export const Confidence = ({ v }: { v: string }) => <span className={"badge " + vClass(v)}>{vLabel(v)}</span>;
export const Status = ({ s }: { s: string }) => <span className={"badge s-" + s}>{s.replace("_", " ")}</span>;
