"use client";
import { useState } from "react";
import { AlertTriangle, Copy, Printer } from "lucide-react";
import { guideFor, guideMarkdown } from "../lib/guide";

/** Instructions for the signed-in person's role, always in step with the screens. */
export default function Guide({ role }: { role: string }) {
  const g = guideFor(role);
  const [copied, setCopied] = useState(false);
  return (
    <div className="guide">
      <h3>{g.title}</h3>
      <p className="muted">{g.who}</p>
      {g.intro.map((x) => (
        <p key={x}>{x}</p>
      ))}
      <div className="row-actions no-print">
        <button
          type="button"
          className="button small outline-dark"
          onClick={async () => {
            await navigator.clipboard?.writeText(guideMarkdown(g));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }}
        >
          <Copy size={15} />
          {copied ? "Скопировано" : "Скопировать текст (для отправки)"}
        </button>
        <button
          type="button"
          className="button small outline-dark"
          onClick={() => window.print()}
        >
          <Printer size={15} />
          Распечатать
        </button>
      </div>
      {g.sections.map((s, i) => (
        <details key={s.title} className="guide-section" open={i === 0}>
          <summary>{s.title}</summary>
          <ol>
            {s.steps.map((x) =>
              x.startsWith("!") ? (
                <li key={x} className="guide-warn">
                  <AlertTriangle size={15} />
                  {x.slice(1)}
                </li>
              ) : (
                <li key={x}>{x}</li>
              ),
            )}
          </ol>
        </details>
      ))}
    </div>
  );
}
