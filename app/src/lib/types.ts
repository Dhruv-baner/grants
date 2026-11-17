export interface Source { field: string; url: string; tier: "Official" | "Secondary" | "Trade press"; }
export interface Scheme {
  id: string; row_type: "scheme" | "call"; parent_id: string; closes_on: string; name: string; summary: string; ignite_listed: string;
  country: string; level: string; region: string; type: string; type_group: string; sector: string; authority: string; official_url: string;
  status: string; status_clean: string; closes_date: string; eligible_sizes: string; before_start_flag: string; geo_scope: string;
  applicants: string; size_rule: string; consortium: string; stage: string; activities: string; funding_rate: string; caps: string; budget: string;
  window: string; before_start: string; assessment: string; fit_signals: string; rejection_risks: string; call_questions: string;
  verification: "Verified" | "Verified (framework)" | "Partial" | "Candidate" | "Listing only"; as_of: string; confidence: string; conflicts: string;
  open_questions: string; aliases: string; sources: Source[]; [k: string]: unknown;
}
export interface Profile {
  name?: string; country: "NL" | "DE" | "EU" | "OTHER"; region?: string; size?: "micro" | "small" | "medium" | "large" | "unknown";
  sectors?: string[]; signals?: string[]; description?: string; activities?: string; confidence?: string;
}
export interface MatchEntry {
  scheme_id: string; name: string; score: number; reasons: string[]; flags: string[]; status_clean: string; next_deadline: string;
  data_confidence: string; type_group: string; questions_for_consultant: string[]; fit?: "high" | "medium" | "low";
}
export interface MatchResult { matches: MatchEntry[]; not_open: MatchEntry[]; check_manually: MatchEntry[]; excluded: Record<string, number>; }
