export type Started = "unknown" | "no" | "yes";
/** What is being funded: not the company, but the project. All optional; unknown stays unknown. */
export interface Project { budget?: number; start?: string; started: Started; text?: string; }
export const NO_PROJECT: Project = { started: "unknown" };
