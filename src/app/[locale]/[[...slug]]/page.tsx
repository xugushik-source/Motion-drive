import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contactOnly, siteUrl } from "../../../lib/deployment";
import Site from "../../../components/Site";
import { records } from "../../../lib/db";
import { locales } from "../../../lib/schemas";
export const dynamic = "force-dynamic";
const pages = [
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
  "booking",
  "account",
  "admin",
  "instructor",
  "operator",
  "privacy",
  "terms",
  "akhalkalaki",
  "ninotsminda",
];
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const messages = (
    await import(
      `../../../../messages/${locales.includes(locale as any) ? locale : "ru"}.json`
    )
  ).default;
  const path = slug?.join("/") || "";
  const base = siteUrl;
  const title = `${(messages as any)[path] || "Motion Drive"} — Motion Drive`;
  return {
    title,
    description:
      (await records("settings")).find(
        (s) =>
          s.key === "site_description" &&
          s.locale === locale &&
          s.status === "published",
      )?.value || messages.heroText,
    metadataBase: new URL(base),
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: Object.fromEntries(
        await Promise.all([
          ...locales.map((l) => [l, `/${l}/${path}`]),
          ["x-default", `/ru/${path}`],
        ]),
      ),
    },
    robots: ["account", "admin", "instructor", "operator", "booking"].includes(
      path,
    )
      ? { index: false, follow: false }
      : { index: false, follow: true },
    openGraph: {
      title,
      description:
        (await records("settings")).find(
          (s) =>
            s.key === "site_description" &&
            s.locale === locale &&
            s.status === "published",
        )?.value || messages.heroText,
      locale,
      images: ["/images/hero.jpg"],
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
}) {
  const { locale, slug } = await params;
  const path = slug?.join("/") || "";
  if (!pages.includes(path)) notFound();
  const content = Object.fromEntries(
    await Promise.all(
      [
        "courses",
        "instructors",
        "branches",
        "media",
        "reviews",
        "faq",
        "materials",
        "translations",
      ].map(async (k) => [
        k,
        (await records(k)).filter(
          (r) =>
            r.status === "published" &&
            (k !== "reviews" || r.permission === true),
        ),
      ]),
    ),
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": ["EducationalOrganization", "LocalBusiness"],
            name: "Motion Drive",
            url: `${siteUrl}/${locale}`,
            areaServed: [
              { "@type": "City", name: "Akhalkalaki" },
              { "@type": "City", name: "Ninotsminda" },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Site
        locale={locale}
        page={path}
        initialContent={content}
        contactOnly={contactOnly}
      />
    </>
  );
}
