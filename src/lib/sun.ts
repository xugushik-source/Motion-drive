/** Sunset in UTC for a calendar day and place (NOAA / Almanac method, error about a minute). */
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export function sunsetUtc(
  year: number,
  month: number, // 1–12
  day: number,
  lat: number,
  lon: number,
): Date | null {
  const start = Date.UTC(year, 0, 0);
  const N = Math.floor((Date.UTC(year, month - 1, day) - start) / 86400000);
  const lngHour = lon / 15;
  const t = N + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = deg(Math.atan(0.91764 * Math.tan(rad(L))));
  RA = ((RA % 360) + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(rad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(lat))) /
    (cosDec * Math.cos(rad(lat)));
  if (cosH > 1 || cosH < -1) return null; // no sunset that day (polar)
  const H = deg(Math.acos(cosH)) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = (((T - lngHour) % 24) + 24) % 24;
  return new Date(Date.UTC(year, month - 1, day) + UT * 3600 * 1000);
}
/** Akhalkalaki, where driving practice takes place. */
export const AKHALKALAKI = { lat: 41.4067, lon: 43.4865 };
/**
 * Lesson starts (UTC ISO) for one local day: hourly from `startHour` (Georgian time, UTC+4)
 * while the lesson still ends before the sun sets.
 */
export function daylightLessons(
  year: number,
  month: number,
  day: number,
  { startHour = 9, minutes = 60, place = AKHALKALAKI } = {},
) {
  const sunset = sunsetUtc(year, month, day, place.lat, place.lon);
  if (!sunset) return [];
  const dayStartUtc = Date.UTC(year, month - 1, day) - 4 * 3600 * 1000;
  const out: { start: string; end: string }[] = [];
  for (
    let s = dayStartUtc + startHour * 3600 * 1000;
    s + minutes * 60000 <= sunset.getTime();
    s += minutes * 60000
  )
    out.push({
      start: new Date(s).toISOString(),
      end: new Date(s + minutes * 60000).toISOString(),
    });
  return out;
}
