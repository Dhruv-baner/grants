// Reads the text of an uploaded document (PDF, Word or plain text) so it can be profiled like a website. Server side only.
export const MAX_DOC_BYTES = 4_000_000, MAX_DOC_CHARS = 20_000;
export class DocumentError extends Error { constructor(message: string, public status = 422) { super(message); } }
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").replace(/\s+/g, " ").trim();
const starts = (b: Uint8Array, sig: string) => sig.split("").every((c, i) => b[i] === c.charCodeAt(0));
export async function extractDocumentText(name: string, bytes: Uint8Array): Promise<{ text: string; kind: "pdf" | "docx" | "txt" }> {
  if (!bytes.length) throw new DocumentError("That file is empty.", 400);
  const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""); let text = "", kind: "pdf" | "docx" | "txt";
  try {
    if (ext === "pdf" || starts(bytes, "%PDF-")) { kind = "pdf"; if (!starts(bytes, "%PDF-")) throw new DocumentError("That file is not a PDF."); const { extractText, getDocumentProxy } = await import("unpdf"); const pdf = await getDocumentProxy(bytes); text = (await extractText(pdf, { mergePages: true })).text as string; }
    else if (ext === "docx") { kind = "docx"; if (!starts(bytes, "PK")) throw new DocumentError("That file is not a Word (.docx) document."); const mammoth = (await import("mammoth")).default; text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value; }
    else if (["txt", "md", "csv"].includes(ext)) { kind = "txt"; text = new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
    else throw new DocumentError("Use a PDF, a Word (.docx) file or a text file.", 415);
  } catch (e) { if (e instanceof DocumentError) throw e; throw new DocumentError("Could not read that file. If it is a scan, paste its text instead."); }
  text = clean(text); if (text.length < 80) throw new DocumentError("No text could be read from that file. If it is a scan, paste its text instead.");
  return { text: text.slice(0, MAX_DOC_CHARS), kind };
}
