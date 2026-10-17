import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

interface Base { label: string; name: string; error?: string; hint?: string; required?: boolean }

/** Label above, helper text, input, error below with aria-describedby (DESIGN.md form field). */
export function Field({ label, name, error, hint, required, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [error ? `${name}-err` : '', hint ? `${name}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={name}>{label}{required && ' *'}</label>
      <input id={name} name={name} aria-invalid={!!error} aria-describedby={describedBy} data-error={!!error} {...rest} />
      {hint && !error && <div className="hint" id={`${name}-hint`}>{hint}</div>}
      {error && <div className="err" id={`${name}-err`} role="alert">⚠ {error}</div>}
    </div>
  );
}

export function SelectField({
  label, name, error, hint, required, options, placeholder, ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const describedBy = [error ? `${name}-err` : '', hint ? `${name}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={name}>{label}{required && ' *'}</label>
      <select id={name} name={name} aria-invalid={!!error} aria-describedby={describedBy} data-error={!!error} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && !error && <div className="hint" id={`${name}-hint`}>{hint}</div>}
      {error && <div className="err" id={`${name}-err`} role="alert">⚠ {error}</div>}
    </div>
  );
}
