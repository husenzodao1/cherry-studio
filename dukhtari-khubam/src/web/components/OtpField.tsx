'use client'

/** Six digit boxes over an invisible field (keyboard, paste and e-mail/SMS autofill work). */
export function OtpField({ value, onChange, label, autoFocus = true }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  return (
    <label className="otp-field">
      <span className="otp-boxes" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={i < value.length ? 'is-on' : i === value.length ? 'is-now' : ''}>{value[i] ?? ''}</span>)}
      </span>
      <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" autoFocus={autoFocus} value={value} maxLength={6}
        aria-label={label} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </label>
  )
}
