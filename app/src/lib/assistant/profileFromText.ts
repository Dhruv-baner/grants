// Reads a company description typed into the chat and turns it into the same profile the Screen page uses.
// Plain rules, no AI: what it cannot read stays "unknown" and is reported back, never guessed.
import { canonRegions, conceptsIn } from "../matcher";
import type { Profile } from "../types";
import { norm } from "./text";

export interface Parsed { profile: Profile | null; signals: number; found: string[]; missing: string[]; }
const NL = /\b(netherlands|nederland|dutch|holland|amsterdam|rotterdam|eindhoven|utrecht|gelderland|limburg|zeeland|brabant|groningen|twente|friesland|overijssel|flevoland)\b/;
const DE = /\b(germany|german|deutschland|berlin|munich|munchen|bavaria|bayern|saxony|sachsen|nrw|north rhine|hamburg|stuttgart|baden wurttemberg|frankfurt|cologne|dusseldorf|lower saxony|niedersachsen|hessen|thuringia|brandenburg)\b/;
const EU = /\b(belgium|france|spain|italy|portugal|austria|poland|sweden|denmark|finland|ireland|czech|greece|romania|hungary|luxembourg|estonia|latvia|lithuania|croatia|slovenia|slovakia|bulgaria|malta|cyprus|eu|european)\b/;
const OTHER = /\b(india|united states|usa|us based|uk|united kingdom|britain|england|canada|australia|china|japan|switzerland|norway|turkey|brazil|singapore|uae)\b/;
const SECTOR: [RegExp, string][] = [
  [/\b(manufactur\w*|factory|factories|production plant|industrial|machining|metal\w*|steel|chemical\w*|packaging|plastics?|components?)\b/, "Industry & manufacturing"],
  [/\b(software|saas|ai|artificial intelligence|machine learning|data|digital|app|platform|cyber\w*|ict|it services)\b/, "Digital, AI & ICT"],
  [/\b(medical|medtech|health\w*|pharma\w*|biotech|clinical|hospital|diagnostic\w*)\b/, "Health & life sciences"],
  [/\b(farm\w*|agri\w*|food|dairy|greenhouse|horticulture|crops?)\b/, "Agriculture & food"],
  [/\b(building\w*|real estate|property|construction|offices?|warehouse|retrofit)\b/, "Buildings & real estate"],
  [/\b(ship\w*|vessel\w*|maritime|logistics|transport\w*|trucks?|fleet|port|aviation|barge\w*)\b/, "Transport & maritime"],
  [/\b(recycl\w*|waste|circular|plastics? recycl\w*|biobased|bio based)\b/, "Circular economy & environment"],
  [/\b(energy|solar|wind|hydrogen|heat pumps?|heating|electrolys\w*|battery|batteries|decarboni[sz]\w*|carbon|co2|power)\b/, "Energy & climate"],
  [/\b(games?|gaming|media|film|creative|music|publishing)\b/, "Creative, media & games"],
  [/\b(defen[cs]e|security|dual use|drone\w*)\b/, "Defence & security"],
  [/\b(education|training|skills|apprentice\w*|school|university)\b/, "Education & skills"],
  [/\b(municipalit\w*|city council|public sector|local authority)\b/, "Public sector & municipalities"],
];
function sizeOf(t: string): { size: Profile["size"]; why: string } {
  const m = t.match(/\b(\d{1,5})\s*(?:person|people|employees?|staff|fte|workers?|strong|members)\b/) ?? t.match(/\b(?:team|staff|workforce|headcount) of (\d{1,5})\b/) ?? t.match(/\bwith (\d{1,5}) (?:employees|staff|people)\b/);
  if (m) { const n = Number(m[1]); return { size: n < 10 ? "micro" : n < 50 ? "small" : n < 250 ? "medium" : "large", why: `${n} staff` }; }
  if (/\b(start ?up|founder|founders|solo|freelanc\w*|one person|sole trader|zzp|pre revenue|not yet incorporated|before (we )?incorporat\w*)\b/.test(t)) return { size: "micro", why: "start-up" };
  if (/\b(micro)\b/.test(t)) return { size: "micro", why: "micro" };
  if (/\b(small (company|business|firm|manufacturer|team)|small)\b/.test(t) && !/\bsmall and medium\b/.test(t)) return { size: "small", why: "small" };
  if (/\b(medium sized|mid sized|midsize\w*|medium)\b/.test(t)) return { size: "medium", why: "medium" };
  if (/\b(large (company|corporation|firm|group)|multinational|corporate|listed|enterprise|big company|thousands of (employees|staff))\b/.test(t)) return { size: "large", why: "large" };
  return { size: "unknown", why: "" };
}
export function parseCompany(original: string): Parsed {
  const t = norm(original); const found: string[] = []; const missing: string[] = [];
  let country: Profile["country"] | null = null;
  if (NL.test(t) || /\bNL\b/.test(original)) country = "NL"; else if (DE.test(t) || /\bDE\b/.test(original)) country = "DE"; else if (OTHER.test(t)) country = "OTHER"; else if (EU.test(t)) country = "EU";
  const region = [...canonRegions(original)][0] ?? "";
  const { size, why } = sizeOf(t);
  const sectors = SECTOR.filter(([re]) => re.test(t)).map(([, s]) => s).slice(0, 2);
  const themes = [...conceptsIn(original)];
  if (country) found.push({ NL: "Netherlands", DE: "Germany", EU: "elsewhere in the EU", OTHER: "outside the EU" }[country] + (region ? ` (${region})` : "")); else missing.push("country");
  if (size !== "unknown") found.push(`size: ${why}`); else missing.push("company size");
  if (sectors.length) found.push(sectors.join(", "));
  if (themes.length) found.push(`themes: ${themes.slice(0, 4).map((x) => x.replace(/_/g, " ")).join(", ")}`);
  const signals = (country ? 1 : 0) + (size !== "unknown" ? 1 : 0) + (sectors.length ? 1 : 0) + (themes.length ? 1 : 0);
  if (!country) return { profile: null, signals, found, missing };
  return { profile: { country, region, size, sectors, signals: [], description: original.slice(0, 400), activities: original.slice(0, 400) }, signals, found, missing };
}
