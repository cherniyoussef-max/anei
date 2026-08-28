export function Field({
  label,
  id,
  value,
  onChange,
  error,
  required,
  maxLength,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="wizard-field">
      <span className="wizard-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        aria-describedby={error ? `err-${id}` : undefined}
        aria-invalid={Boolean(error)}
      />
      {hint && <small>{hint}</small>}
      {error && (
        <span id={`err-${id}`} className="wizard-field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
