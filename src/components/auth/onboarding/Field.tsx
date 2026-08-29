export function Field({
  label,
  id,
  value,
  onChange,
  error,
  required,
  maxLength,
  hint,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="wizard-field">
      <span className="wizard-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        min={type === "number" ? 0 : undefined}
        max={type === "number" ? 80 : undefined}
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
