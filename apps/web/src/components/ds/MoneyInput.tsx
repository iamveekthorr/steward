"use client";

import { useRef, type ChangeEvent, type InputHTMLAttributes } from "react";

// Format a raw numeric string with commas, preserving trailing dot + up to 2 decimals
// "1234567.8" → "1,234,567.8"
function formatMoney(raw: string): string {
  if (!raw) return "";
  const dotIdx = raw.indexOf(".");
  const hasDot = dotIdx !== -1;
  const intPart = hasDot ? raw.slice(0, dotIdx) : raw;
  const decPart = hasDot ? raw.slice(dotIdx + 1, dotIdx + 3) : "";
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasDot ? `${formatted}.${decPart}` : formatted;
}

// Strip commas, keep digits and at most one decimal point (max 2 decimal places)
function toRaw(display: string): string {
  const stripped = display.replace(/[^0-9.]/g, "");
  const [int, ...rest] = stripped.split(".");
  if (!rest.length) return int;
  return `${int}.${rest.join("").slice(0, 2)}`;
}

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  /** Clean numeric string — no commas, e.g. "250000.50". Empty = empty field. */
  value: string;
  onChange: (raw: string) => void;
  /** Currency code shown as a prefix badge, e.g. "NGN" or "USD" */
  currency?: string;
}

export function MoneyInput({
  value,
  onChange,
  currency,
  id,
  disabled,
  className,
  placeholder = "0.00",
  style,
  ...rest
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = toRaw(e.target.value);

    // Count significant chars (digits + dot) before cursor in the displayed value
    const oldDisplay = e.target.value;
    const selEnd = e.target.selectionEnd ?? 0;
    const sigBefore = oldDisplay.slice(0, selEnd).replace(/[^0-9.]/g, "").length;

    onChange(raw);

    // After React re-renders, reposition the cursor
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      let count = 0;
      let pos = 0;
      for (; pos < el.value.length; pos++) {
        if (/[0-9.]/.test(el.value[pos])) {
          count++;
          if (count >= sigBefore) { pos++; break; }
        }
      }
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div style={{ position: "relative", display: "flex", ...(style as object) }}>
      {currency && (
        <span
          aria-hidden
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--st-neutral-700)",
            background: "var(--st-neutral-200)",
            border: "1px solid color-mix(in srgb, var(--st-text) 40%, transparent)",
            borderRight: "none",
            userSelect: "none",
            flexShrink: 0,
            fontFamily: "var(--st-font)",
          }}
        >
          {currency}
        </span>
      )}
      <input
        {...rest}
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={formatMoney(value)}
        onChange={handleChange}
        className={`st-input${className ? ` ${className}` : ""}`}
        style={{
          flex: 1,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
      />
    </div>
  );
}
