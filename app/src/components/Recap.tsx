"use client";
import { useMemo, useState } from "react";
import { copyText, download } from "@/lib/browser";
import { buildRecap } from "@/lib/notes/recap";
import type { NoteResult } from "@/lib/notes/types";

/** The follow-up email, drafted from the verified facts. The text is editable, and a change to the call starts a fresh draft. */
export default function Recap({ note, title }: { note: NoteResult; title: string }) {
  const base = useMemo(() => buildRecap(note, { title }), [note, title]), key = base.subject + "\n" + base.body;
  const [edit, setEdit] = useState<{ key: string; subject: string; body: string } | null>(null); const [copied, setCopied] = useState(false);
  const cur = edit && edit.key === key ? edit : { key, subject: base.subject, body: base.body }, changed = cur.subject !== base.subject || cur.body !== base.body;
  const body = cur.body.length > 1800 ? cur.body.slice(0, Math.max(0, cur.body.lastIndexOf("\n", 1800))) + "\n…" : cur.body;
  return (
    <article className="sec rcp" id="recap" aria-label="Follow-up email">
      <h3>Follow-up email</h3>
      <p className="nt-muted rcp-note">Drafted only from what the call said and the programme data. Read it, change it, and put your name on it.</p>
      <div className="field"><label htmlFor="rcp-s">Subject</label><input id="rcp-s" value={cur.subject} onChange={(e) => setEdit({ ...cur, subject: e.target.value })} /></div>
      <div className="field"><label htmlFor="rcp-b">Email</label><textarea id="rcp-b" rows={16} value={cur.body} onChange={(e) => setEdit({ ...cur, body: e.target.value })} spellCheck /></div>
      <div className="rcp-acts">
        <button type="button" className="nbtn pri" onClick={async () => { if (await copyText(`Subject: ${cur.subject}\n\n${cur.body}`)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800); } }}>{copied ? "Copied" : "Copy"}</button>
        <a className="nbtn" href={`mailto:?subject=${encodeURIComponent(cur.subject)}&body=${encodeURIComponent(body)}`}>Open in email app</a>
        <button type="button" className="nbtn" onClick={() => download("follow-up-email.txt", `Subject: ${cur.subject}\n\n${cur.body}\n`)}>Download</button>
        {changed && <button type="button" className="nbtn" onClick={() => setEdit(null)}>Reset to the draft</button>}
      </div>
      {cur.body.length > 1800 && <p className="nt-muted">The email app opens with the first part only. Use Copy for the whole email.</p>}
    </article>
  );
}
