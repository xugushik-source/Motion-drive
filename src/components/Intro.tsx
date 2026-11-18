"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { playRev } from "../lib/revSound";

/**
 * The opening "garage door": the logo, then the shutter rolls up. Once per browser session, only
 * on the home page. A tap opens it with an engine sound (browsers allow sound only after a tap);
 * with no tap it rolls up silently after 2.6 s. Skipped for "reduce motion".
 */
export default function Intro({ hint }: { hint: string }) {
  const [phase, setPhase] = useState<"show" | "open" | "gone">("show");
  const auto = useRef<number | undefined>(undefined);
  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem("md-intro");
    } catch {}
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (seen || reduce) {
      setPhase("gone");
      return;
    }
    document.documentElement.classList.add("intro-lock");
    auto.current = window.setTimeout(() => setPhase("open"), 2600);
    return () => {
      window.clearTimeout(auto.current);
      document.documentElement.classList.remove("intro-lock");
    };
  }, []);
  useEffect(() => {
    if (phase !== "open") return;
    try {
      sessionStorage.setItem("md-intro", "1");
    } catch {}
    const done = window.setTimeout(() => setPhase("gone"), 1150);
    return () => window.clearTimeout(done);
  }, [phase]);
  useEffect(() => {
    if (phase === "gone")
      document.documentElement.classList.remove("intro-lock");
  }, [phase]);
  if (phase === "gone") return null;
  const openWithSound = () => {
    if (phase !== "show") return;
    window.clearTimeout(auto.current);
    playRev().catch(() => {});
    setPhase("open");
  };
  return (
    <div
      className={"intro-curtain" + (phase === "open" ? " open" : "")}
      onClick={openWithSound}
    >
      <img
        className="intro-logo"
        src="/images/logo-splash.webp"
        alt="Motion Drive — Driving School"
        fetchPriority="high"
      />
      <span className="intro-line" aria-hidden="true" />
      <button type="button" className="intro-sound" onClick={openWithSound}>
        <Volume2 size={18} />
        {hint}
      </button>
    </div>
  );
}
