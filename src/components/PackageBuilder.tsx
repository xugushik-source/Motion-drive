"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import type { Item } from "./Site";
import {
  KIT_TEXT as TEXT,
  kitToQuery,
  priceKit,
  type Gear,
  type Kit,
} from "../lib/kit";

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
  const kit: Kit = { theory, gear, hours, yard, priv };
  const sum = useMemo(
    () => priceKit(kit, packages, locale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theory, gear, hours, yard, priv, packages, locale],
  );
  const ok = sum.ok;
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
          <Link className="button" href={`${bookingHref}?${kitToQuery(kit)}`}>
            {T.go}
            <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
    </section>
  );
}
