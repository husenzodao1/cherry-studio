/**
 * The plans' prices (in somoni) as she reads money where she lives: in Tajikistan in somoni; elsewhere, about
 * as much in her own currency ("≈ 400 ₽"), from the day's rates. Where she lives is told by the phone's time
 * zone (no permission needed).
 */

const ZONES: [RegExp, string][] = [
  [/^Asia\/Dushanbe$/, 'TJS'],
  [/^Asia\/(Tashkent|Samarkand)$/, 'UZS'],
  [/^(Europe\/(Moscow|Samara|Volgograd|Kirov|Ulyanovsk|Astrakhan|Saratov|Kaliningrad)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Vladivostok|Khandyga|Sakhalin|Magadan|Srednekolymsk|Ust-Nera|Kamchatka|Anadyr))$/, 'RUB'],
  [/^(Europe\/Istanbul|Asia\/Istanbul)$/, 'TRY'],
  [/^Asia\/Kabul$/, 'AFN'],
  [/^Asia\/Tehran$/, 'IRR'],
  [/^Asia\/(Almaty|Qostanay|Qyzylorda|Aqtobe|Aqtau|Atyrau|Oral)$/, 'KZT'],
  [/^Asia\/Bishkek$/, 'KGS'],
  [/^Europe\//, 'EUR']
]

/** her currency by the phone's time zone; somoni when it is not known */
export function currencyOf(timeZone: string | undefined): string {
  // not known, or a zone of no place (UTC): somoni
  if (!timeZone || /^(UTC|GMT|Etc\/)/.test(timeZone)) return 'TJS'
  return ZONES.find(([z]) => z.test(timeZone))?.[1] ?? 'USD'
}

/** a price in somoni as she reads it: "45 сомонӣ", or "≈ 400 ₽", "≈ $4.88" */
export function moneyText(somoni: number, o: { currency: string; rates: Record<string, number | undefined>; tag: string; somoniWord: string }): string {
  const rate = o.rates[o.currency]
  if (o.currency === 'TJS' || !rate) return `${somoni} ${o.somoniWord}`
  let v = somoni * rate
  const cents = v < 20
  // big numbers rounded as prices are: to tens, hundreds, thousands
  if (!cents) { const step = v >= 100_000 ? 1000 : v >= 10_000 ? 100 : v >= 1000 ? 10 : 1; v = Math.round(v / step) * step }
  try {
    return `≈ ${new Intl.NumberFormat(o.tag, { style: 'currency', currency: o.currency, maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 }).format(v)}`
  } catch {
    return `≈ ${Math.round(v)} ${o.currency}`
  }
}
