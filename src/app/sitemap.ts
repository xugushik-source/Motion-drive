import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/deployment";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl;
  return ["ka", "hy", "ru", "en"].flatMap((l) =>
    [
      "",
      "about",
      "courses",
      "pricing",
      "instructors",
      "exam",
      "gallery",
      "faq",
      "contacts",
      "reviews",
      "akhalkalaki",
      "ninotsminda",
    ].map((p) => ({
      url: `${base}/${l}/${p}`,
      alternates: {
        languages: Object.fromEntries(
          ["ka", "hy", "ru", "en"].map((x) => [x, `${base}/${x}/${p}`]),
        ),
      },
    })),
  );
}
