"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Every page opens at its very top. Next keeps the old scroll position when the new page is
 * already "visible" (for example after pressing a footer link), and it no longer cancels the
 * site's smooth scrolling during navigation, so the jump is done here, instantly.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {}
  }, []);
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
