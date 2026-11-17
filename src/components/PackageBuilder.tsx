"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import type { Item } from "./Site";

type Gear = "none" | "automatic" | "manual";
const TEXT: Record<string, Record<string, string>> = {
  ru: {
    title: "Соберите свой пакет",
    theory: "Теория",
    none: "Без",
    group: "Группа",
    individual: "Индивидуально",
    gear: "Вождение по городу",
    automatic: "Автомат",
    manual: "Механика",
    hours: "Часов вождения",
    yard: "Занятий на площадке",
    tariff: "Тариф",
    standard: "Обычный",
    priv: "С выбором инструктора и подачей авто",
    total: "Итого",
    go: "Оставить заявку",
    empty: "Выберите хотя бы одну часть",
    hour: "ч",
    yardWord: "площадка",
    cityWord: "город",
    kit: "Комплект",
  },
  en: {
    title: "Build your package",
    theory: "Theory",
    none: "None",
    group: "Group",
    individual: "Individual",
    gear: "City driving",
    automatic: "Automatic",
    manual: "Manual",
    hours: "Driving hours",
    yard: "Yard lessons",
    tariff: "Tariff",
    standard: "Standard",
    priv: "Instructor choice and car pick-up",
    total: "Total",
    go: "Send request",
    empty: "Pick at least one part",
    hour: "h",
    yardWord: "yard",
    cityWord: "city",
    kit: "Bundle",
  },
  ka: {
    title: "ააწყვეთ თქვენი პაკეტი",
    theory: "თეორია",
    none: "არა",
    group: "ჯგუფი",
    individual: "ინდივიდუალური",
    gear: "ქალაქში მართვა",
    automatic: "ავტომატი",
    manual: "მექანიკა",
    hours: "მართვის საათები",
    yard: "მოედნის გაკვეთილები",
    tariff: "ტარიფი",
    standard: "სტანდარტული",
    priv: "ინსტრუქტორის არჩევა და მანქანის მოყვანა",
    total: "ჯამი",
    go: "განაცხადის გაგზავნა",
    empty: "აირჩიეთ მინიმუმ ერთი ნაწილი",
    hour: "სთ",
    yardWord: "მოედანი",
    cityWord: "ქალაქი",
    kit: "კომპლექტი",
  },
  hy: {
    title: "Կազմեք ձեր փաթեթը",
    theory: "Տեսություն",
    none: "Ոչ",
    group: "Խումբ",
    individual: "Անհատական",
    gear: "Քաղաքային վարում",
    automatic: "Ավտոմատ",
    manual: "Մեխանիկա",
    hours: "Վարման ժամեր",
    yard: "Հրապարակի պարապմունքներ",
    tariff: "Սակագին",
    standard: "Սովորական",
    priv: "Ուսուցչի ընտրություն և մեքենայի մատակարարում",
    total: "Ընդամենը",
    go: "Ուղարկել հայտ",
    empty: "Ընտրեք առնվազն մեկ մաս",
    hour: "ժ",
    yardWord: "հրապարակ",
    cityWord: "քաղաք",
    kit: "Փաթեթ",
  },
};

/** Sum of a yard-lesson count: individual yard lessons come in pairs for 100 ₾, a single one is 60 ₾. */
export const yardPrice = (n: number, individual: boolean, single: number) =>
  individual ? Math.floor(n / 2) * 100 + (n % 2) * 60 : n * single;

export default function PackageBuilder({
  packages,
  locale,
  bookingHref,
}: {
  packages: Item[];
  locale: string;
  bookingHref: string;
}) {
  const T = TEXT[locale] || TEXT.ru;
  const [theory, setTheory] = useState<"none" | "group" | "individual">("none");
  const [gear, setGear] = useState<Gear>("none");
  const [hours, setHours] = useState(5);
  const [yard, setYard] = useState(0);
  const [priv, setPriv] = useState(false);
  const p = (id: string) => Number(packages.find((x) => x.id === id)?.price);
  const sum = useMemo(() => {
    const parts: { label: string; cost: number }[] = [];
    if (theory !== "none")
      parts.push({
        label: T.theory + " · " + T[theory],
        cost: p("theory-" + theory + "-" + locale),
      });
    if (gear !== "none")
      parts.push({
        label: `${T.cityWord} · ${T[gear]} · ${hours}${T.hour}`,
        cost:
          hours *
          (priv
            ? p(
                `individual-${gear === "automatic" ? "auto" : "manual"}-${locale}`,
              )
            : p(`city-${gear}-${locale}`)),
      });
    if (yard > 0)
      parts.push({
        label: `${T.yardWord} ×${yard}`,
        cost: yardPrice(yard, priv, p("yard-" + locale)),
      });
    const total = parts.reduce((a, x) => a + x.cost, 0);
    return { parts, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theory, gear, hours, yard, priv, packages, locale]);
  const ok = sum.parts.length > 0 && sum.parts.every((x) => x.cost >= 0);
  const note = `${T.kit}: ${sum.parts.map((x) => x.label).join(" + ")} = ${sum.total} ₾${priv ? " (" + T.priv + ")" : ""}`;
  const stepper = (
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
  ) => (
    <span className="builder-step">
      <button
        type="button"
        aria-label="−"
        onClick={() => set(Math.max(min, value - 1))}
      >
        <Minus size={16} />
      </button>
      <b>{value}</b>
      <button
        type="button"
        aria-label="+"
        onClick={() => set(Math.min(max, value + 1))}
      >
        <Plus size={16} />
      </button>
    </span>
  );
  const chips = <K extends string>(
    opts: K[],
    value: K,
    set: (v: K) => void,
  ) => (
    <span className="builder-chips">
      {opts.map((o) => (
        <button
          type="button"
          key={o}
          className={o === value ? "on" : ""}
          onClick={() => set(o)}
        >
          {T[o]}
        </button>
      ))}
    </span>
  );
  return (
    <section className="builder" aria-label={T.title}>
      <h3>{T.title}</h3>
      <div className="builder-row">
        <label>{T.theory}</label>
        {chips(["none", "group", "individual"], theory, setTheory)}
      </div>
      <div className="builder-row">
        <label>{T.gear}</label>
        {chips(["none", "automatic", "manual"] as Gear[], gear, setGear)}
        {gear !== "none" && (
          <>
            <label>{T.hours}</label>
            {stepper(hours, setHours, 1, 40)}
          </>
        )}
      </div>
      <div className="builder-row">
        <label>{T.yard}</label>
        {stepper(yard, setYard, 0, 20)}
      </div>
      <div className="builder-row">
        <label>{T.tariff}</label>
        {chips(["standard", "priv"], priv ? "priv" : "standard", (v) =>
          setPriv(v === "priv"),
        )}
      </div>
      <div className="builder-total">
        <span>
          {ok
            ? sum.parts.map((x) => `${x.label}: ${x.cost} ₾`).join(" · ")
            : T.empty}
        </span>
        <strong>
          {T.total}: {sum.total} ₾
        </strong>
        {ok && (
          <Link
            className="button"
            href={`${bookingHref}?note=${encodeURIComponent(note)}`}
          >
            {T.go}
            <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
    </section>
  );
}
