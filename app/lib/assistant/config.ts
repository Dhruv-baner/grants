// Scope and wording for the consultant assistant. The scope itself comes from the data: only checklists marked "recorded" are answered.
// Every in-scope programme needs an entry here (a test enforces it), so nothing can be answerable but unreachable.
export interface ProgCfg { label: string; aliases: string[]; }
export const CONFIG: Record<string, ProgCfg> = {
  WBSO: { label: "WBSO", aliases: ["wbso", "speur en ontwikkelingswerk", "dutch r and d tax credit", "dutch rd tax credit"] },
  INNOVATIEBOX: { label: "Innovation box", aliases: ["innovatiebox", "innovation box", "patent box", "dutch patent box"] },
  EIA: { label: "EIA", aliases: ["eia", "energie investeringsaftrek", "energy investment allowance", "energy investment deduction"] },
  MIA_VAMIL: { label: "MIA and Vamil", aliases: ["mia vamil", "mia", "vamil", "milieu investeringsaftrek", "environmental investment allowance", "milieulijst"] },
  ISDE: { label: "ISDE", aliases: ["isde", "investeringssubsidie duurzame energie"] },
  SDE_PP: { label: "SDE++", aliases: ["sde", "sde plus plus", "stimulering duurzame energieproductie"] },
  VEKI: { label: "VEKI", aliases: ["veki", "versnelde klimaatinvesteringen industrie"] },
  INNOVATIEKREDIET: { label: "Innovation Credit", aliases: ["innovatiekrediet", "innovation credit", "innovation loan"] },
  STUDI: { label: "STUDI", aliases: ["studi", "studies voor duurzame industrie", "tse industrie studies"] },
  MKB_EBL: { label: "SME energy-saving loan", aliases: ["mkb energiebesparingslening", "energiebesparingslening", "sme energy saving loan", "mkb ebl", "ebl"] },
  FZULG: { label: "Research allowance (Forschungszulage)", aliases: ["forschungszulage", "research allowance", "german research allowance", "german r and d tax credit", "fzulg", "bsfz"] },
  BIK_M2_TM2_R3: { label: "BIK Module 2: carbon management", aliases: ["bik carbon management", "bik module 2", "bik module two", "bik ccus", "bik ccu", "bik ccs", "bik m2"] },
  EBN: { label: "EBN energy advice", aliases: ["ebn", "energieberatung", "energieberatung fur nichtwohngebaude", "bafa energy advice", "bafa energy audit"] },
  EEW: { label: "EEW", aliases: ["eew", "energie und ressourceneffizienz", "energy and resource efficiency", "bafa eew", "kfw 295"] },
  BEG_NWG: { label: "BEG non-residential buildings", aliases: ["beg", "beg nwg", "beg nichtwohngebaude", "kfw 263", "kfw 522", "bundesforderung fur effiziente gebaude", "efficient buildings"] },
  GSTIP_NRW: { label: "Gründungsstipendium.NRW", aliases: ["grundungsstipendium", "gruendungsstipendium", "grunderstipendium", "gruenderstipendium", "founder stipend", "founders stipend", "nrw stipend"] },
  EIC_ACC: { label: "EIC Accelerator", aliases: ["eic accelerator", "accelerator"] },
  EIC_STEP: { label: "EIC STEP Scale Up", aliases: ["eic step scale up", "step scale up", "step scaleup", "eic step", "eic scale up", "step scale"] },
  HORIZON: { label: "Horizon Europe", aliases: ["horizon europe", "horizon"] },
  INT_WASSERSTOFF: { label: "International hydrogen projects", aliases: ["international hydrogen", "international hydrogen projects", "internationale wasserstoffprojekte", "h2 international"] },
};
/** A bare name that could mean more than one covered programme: the assistant asks which. */
export const AMBIGUOUS: Record<string, { ids: string[]; question: string }> = {
  eic: { ids: ["EIC_ACC", "EIC_STEP"], question: "Do you mean the EIC Accelerator or EIC STEP Scale Up?" },
};
/** A bare name where only part of the programme is covered. */
export const PARTIAL_PARENT: Record<string, { id: string; note: string }> = {
  bik: { id: "BIK_M2_TM2_R3", note: "BIK has two research calls open. I have complete information on Module 2 (carbon management) and show that below. I don't have a complete checklist for Module 1 yet." },
};
export const BETA = "This is a beta version, and more updates are coming.";
export const AS_COUNTRY = (c: string) => (c.startsWith("EU") ? "EU" : c.includes("/") ? "Cross-border" : c);
