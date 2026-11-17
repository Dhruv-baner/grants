import { LABEL } from "@/lib/ui";
const K: Record<string, [string, string]> = { Verified: ["v", "Verified"], "Verified (framework)": ["f", "Verified, framework"], Partial: ["p", "Partial"], Candidate: ["c", "Candidate"], "Listing only": ["c", "Listing only"] };
export const Trust = ({ v }: { v: string }) => { const [c, l] = K[v] ?? ["c", v]; return <span className="mono" style={{ whiteSpace: "nowrap" }}><span className={"mark " + c} aria-hidden="true" />{l}</span>; };
export const Status = ({ s }: { s: string }) => <span className={"st mono " + s}>{LABEL[s] ?? s}</span>;
