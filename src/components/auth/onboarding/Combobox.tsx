"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string };

/**
 * Accessible searchable single-select combobox (WAI-ARIA combobox pattern),
 * built without a new dependency - options are typically small (<300 items)
 * so plain filtering is enough. Used for governorate/delegation selection.
 */
export function Combobox({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabledHint,
  error,
  ar,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  disabledHint?: string;
  error?: string;
  ar: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  // While closed, the input mirrors the selected option's label; while open,
  // it holds the user's in-progress search text. Deriving from `value`
  // instead of syncing it via an effect avoids a setState-in-effect render
  // cascade for a value that already lives in the parent wizard state.
  const [draft, setDraft] = useState<string | null>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const query = draft ?? selectedLabel;
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const disabled = options.length === 0;

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setDraft(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === selectedLabel.toLowerCase()) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, selectedLabel]);

  function select(option: ComboboxOption) {
    onChange(option.value);
    setDraft(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        select(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setDraft(null);
    }
  }

  return (
    <div className="wizard-field wizard-combobox" ref={rootRef}>
      <span className="wizard-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="wizard-combobox-shell">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${id}-label`}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          aria-describedby={error ? `err-${id}` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          disabled={disabled}
          placeholder={disabled ? disabledHint : placeholder}
          value={query}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            if (event.target.value === "") onChange("");
          }}
          onKeyDown={onKeyDown}
        />
        {open && !disabled && (
          <ul id={listId} role="listbox" className="wizard-combobox-list" aria-labelledby={`${id}-label`}>
            {filtered.length === 0 && (
              <li className="wizard-combobox-empty" role="presentation">
                {ar ? "لا توجد نتائج" : "Aucun résultat"}
              </li>
            )}
            {filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-active={index === activeIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <span id={`err-${id}`} className="wizard-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
