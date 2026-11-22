/**
 * The formulas of Mahliyo's live calculators ("calc" blocks): plain arithmetic on the calculator's own
 * values, read by a small parser — never `eval`. Allowed: numbers, the inputs' ids, + − × ÷ ^ %, brackets,
 * and min, max, round, floor, ceil, abs, sqrt. Anything else makes the formula invalid (null).
 */

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, floor: Math.floor, ceil: Math.ceil,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d
}

function tokens(src: string): Tok[] | null {
  const out: Tok[] = []
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    const num = /^(\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i))
    if (num) { out.push({ k: 'num', v: Number(num[0]) }); i += num[0].length; continue }
    const id = /^[a-z_][a-z0-9_]*/i.exec(s.slice(i))
    if (id) { out.push({ k: 'id', v: id[0] }); i += id[0].length; continue }
    if ('+-*/^%(),'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue }
    return null
  }
  return out.length > 200 ? null : out
}

/** The value of `formula` with these values, or null when it is not a valid formula or not a finite number. */
export function evaluate(formula: string, values: Record<string, number>): number | null {
  const t = tokens(formula)
  if (!t || !t.length) return null
  let p = 0
  const peek = () => t[p]
  const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v
  const fail = (): never => { throw new Error('bad') }
  // expr := term (('+'|'-') term)* ; term := power (('*'|'/'|'%') power)* ; power := unary ('^' power)?
  const expr = (): number => {
    let v = term()
    while (isOp('+') || isOp('-')) { const o = t[p++].v; v = o === '+' ? v + term() : v - term() }
    return v
  }
  const term = (): number => {
    let v = power()
    while (isOp('*') || isOp('/') || isOp('%')) { const o = t[p++].v; const r = power(); v = o === '*' ? v * r : o === '/' ? v / r : v % r }
    return v
  }
  const power = (): number => {
    const b = unary()
    if (isOp('^')) { p++; return b ** power() }
    return b
  }
  const unary = (): number => {
    if (isOp('-')) { p++; return -unary() }
    if (isOp('+')) { p++; return unary() }
    return atom()
  }
  const atom = (): number => {
    const x = t[p++] ?? fail()
    if (x.k === 'num') return x.v
    if (x.k === 'op' && x.v === '(') { const v = expr(); if (!isOp(')')) fail(); p++; return v }
    if (x.k === 'id') {
      const fn = FUNCS[x.v.toLowerCase()]
      if (fn && isOp('(')) {
        p++
        const args = [expr()]
        while (isOp(',')) { p++; args.push(expr()) }
        if (!isOp(')')) fail()
        p++
        return fn(...args)
      }
      if (Object.hasOwn(values, x.v)) return values[x.v]
    }
    return fail()
  }
  try {
    const v = expr()
    return p === t.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

/** How a result is written: spaces between thousands, up to `digits` decimals, no trailing zeros. */
export function formatNumber(v: number, digits = 2): string {
  const fixed = Math.abs(v) >= 1000 ? Math.round(v) : Number(v.toFixed(digits))
  return fixed.toLocaleString('ru-RU', { maximumFractionDigits: digits }).replace(/ /g, ' ')
}
