'use client'

export type OtpState = 'idle' | 'bad' | 'ok'

/**
 * Six digit boxes over an invisible field (keyboard, paste and e-mail/SMS autofill work).
 * A wrong code turns the boxes red and shakes them; a right one makes them hop one after another.
 */
export function OtpField({ value, onChange, label, autoFocus = true, state = 'idle' }: {
  value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean; state?: OtpState
}) {
  return (
    <label className={`otp-field${state === 'bad' ? ' is-bad' : state === 'ok' ? ' is-ok' : ''}`}>
      <span className="otp-boxes" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} className={i < value.length ? 'is-on' : i === value.length && state === 'idle' ? 'is-now' : ''}>{value[i] ?? ''}</span>
        ))}
      </span>
      <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" autoFocus={autoFocus} value={value} maxLength={6}
        aria-label={label} aria-invalid={state === 'bad'} readOnly={state === 'ok'} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </label>
  )
}
