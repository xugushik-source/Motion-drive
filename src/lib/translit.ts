const MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};
/** A sign-in name from a person's name: "Мкртич Карапетян" becomes "mkrtich.karapetyan". */
export function loginFromName(name: string) {
  const latin = String(name || "")
    .toLowerCase()
    .split("")
    .map((c) => (c in MAP ? MAP[c] : c))
    .join("")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return (latin.length >= 3 ? latin : latin + "user").slice(0, 40);
}
export const loginPattern = /^[a-z0-9._-]{3,40}$/;
