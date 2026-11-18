import type { Item } from "../components/Site";

export type Gear = "none" | "automatic" | "manual";
export type Theory = "none" | "group" | "individual";
export type Kit = {
  theory: Theory;
  gear: Gear;
  hours: number;
  yard: number;
  priv: boolean;
};
export const KIT_TEXT: Record<string, Record<string, string>> = {
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
    yard: "Ավտոդրոմի պարապմունքներ",
    tariff: "Սակագին",
    standard: "Սովորական",
    priv: "Ուսուցչի ընտրություն և մեքենայի մատակարարում",
    total: "Ընդամենը",
    go: "Ուղարկել հայտ",
    empty: "Ընտրեք առնվազն մեկ մաս",
    hour: "ժ",
    yardWord: "ավտոդրոմ",
    cityWord: "քաղաք",
    kit: "Փաթեթ",
  },
};

/** Sum of a yard-lesson count: individual yard lessons come in pairs for 100 ₾, a single one is 60 ₾. */
export const yardPrice = (n: number, individual: boolean, single: number) =>
  individual ? Math.floor(n / 2) * 100 + (n % 2) * 60 : n * single;

/** Prices a "build your own package" selection from the public price list (also used by the server). */
export function priceKit(kit: Kit, packages: Item[], locale: string) {
  const T = KIT_TEXT[locale] || KIT_TEXT.ru!;
  const p = (id: string) => Number(packages.find((x) => x.id === id)?.price);
  const parts: {
    label: string;
    cost: number;
    kind: "theory" | "city" | "yard";
  }[] = [];
  if (kit.theory !== "none")
    parts.push({
      label: T.theory + " · " + T[kit.theory],
      cost: p("theory-" + kit.theory + "-" + locale),
      kind: "theory",
    });
  if (kit.gear !== "none")
    parts.push({
      label: `${T.cityWord} · ${T[kit.gear]} · ${kit.hours}${T.hour}`,
      cost:
        kit.hours *
        (kit.priv
          ? p(
              `individual-${kit.gear === "automatic" ? "auto" : "manual"}-${locale}`,
            )
          : p(`city-${kit.gear}-${locale}`)),
      kind: "city",
    });
  if (kit.yard > 0)
    parts.push({
      label: `${T.yardWord} ×${kit.yard}`,
      cost: yardPrice(kit.yard, kit.priv, p("yard-" + locale)),
      kind: "yard",
    });
  const total = parts.reduce((a, x) => a + x.cost, 0);
  const ok =
    parts.length > 0 &&
    parts.every((x) => Number.isFinite(x.cost) && x.cost >= 0);
  return { parts, total, ok };
}
/** The selection travels to the order page in the address, so nothing is lost on the way. */
export const kitToQuery = (kit: Kit) =>
  new URLSearchParams({
    kit: "1",
    theory: kit.theory,
    gear: kit.gear,
    hours: String(kit.hours),
    yard: String(kit.yard),
    priv: kit.priv ? "1" : "0",
  }).toString();
export function kitFromQuery(search: string): Kit | null {
  const q = new URLSearchParams(search);
  if (q.get("kit") !== "1") return null;
  const theory = q.get("theory") as Theory;
  const gear = q.get("gear") as Gear;
  if (!["none", "group", "individual"].includes(theory)) return null;
  if (!["none", "automatic", "manual"].includes(gear)) return null;
  const hours = Math.min(40, Math.max(1, Number(q.get("hours")) || 1));
  const yard = Math.min(20, Math.max(0, Number(q.get("yard")) || 0));
  return { theory, gear, hours, yard, priv: q.get("priv") === "1" };
}
