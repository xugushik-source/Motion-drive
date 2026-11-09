"use client";
import { useEffect, useState } from "react";
export default function BackgroundVideo({
  url,
  poster,
}: {
  url: string;
  poster: string;
}) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const update = () =>
      setEnabled(
        !reduced.matches &&
          !connection?.saveData &&
          !["slow-2g", "2g", "3g"].includes(connection?.effectiveType || ""),
      );
    update();
    reduced.addEventListener("change", update);
    return () => reduced.removeEventListener("change", update);
  }, []);
  return enabled ? (
    <video
      className="hero-background-video"
      src={url}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      onError={() => setEnabled(false)}
    />
  ) : null;
}
