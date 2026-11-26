export const tidyLine = (s: string) => { const t = s.replace(/\s+/g, " ").trim(); if (!t) return ""; const c = t.charAt(0).toUpperCase() + t.slice(1); return /[.!?]$/.test(c) ? c : c + "."; };
export const SAMPLE_TITLE = "Sample call: heat pump project";
/** The sample call used by "Try a sample call" and by the guided demo. */
export const sampleText = () => [tidyLine("we're a 40 person manufacturer in gelderland we want to replace our gas heating with heat pumps around 300 thousand euros"), tidyLine("we haven't ordered anything yet they'd like to start in spring and the decision sits with the finance director"), tidyLine("next step is a follow up call on thursday")].join("\n");
