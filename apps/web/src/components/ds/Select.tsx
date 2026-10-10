"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** passed directly to a hidden <select> for form submission */
  name?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  id,
  disabled,
  invalid,
  name,
  className,
}: SelectProps) {
  const uid = useId();
  const triggerId = id ?? `st-sel-${uid}`;
  const listId = `st-sel-list-${uid}`;

  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<number>(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click / focus-out
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  // Move focus into the list when it opens
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Scroll focused option into view
  useEffect(() => {
    if (!open || focused < 0) return;
    const el = listRef.current?.children[focused] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [focused, open]);

  function openList() {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setFocused(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function pick(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open ? setOpen(false) : openList();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { openList(); return; }
      // Forward to list once it has focus (the useEffect will focus it)
      setFocused((f) => {
        if (e.key === "ArrowDown") {
          let next = f + 1;
          while (next < options.length && options[next].disabled) next++;
          return next < options.length ? next : f;
        } else {
          let prev = f - 1;
          while (prev >= 0 && options[prev].disabled) prev--;
          return prev >= 0 ? prev : f;
        }
      });
    }
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused((f) => {
        let next = f + 1;
        while (next < options.length && options[next].disabled) next++;
        return next < options.length ? next : f;
      });
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((f) => {
        let prev = f - 1;
        while (prev >= 0 && options[prev].disabled) prev--;
        return prev >= 0 ? prev : f;
      });
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focused >= 0 && !options[focused].disabled) {
        pick(options[focused]);
      }
    }
    if (e.key === "Tab") {
      setOpen(false);
    }
    // Type-ahead: jump to first option starting with key
    if (e.key.length === 1) {
      const ch = e.key.toLowerCase();
      const idx = options.findIndex(
        (o, i) => i > focused && !o.disabled && o.label.toLowerCase().startsWith(ch)
      );
      if (idx >= 0) setFocused(idx);
      else {
        const idx2 = options.findIndex(
          (o) => !o.disabled && o.label.toLowerCase().startsWith(ch)
        );
        if (idx2 >= 0) setFocused(idx2);
      }
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }} className={className}>
      {/* Hidden native select for form submission */}
      {name && (
        <select name={name} value={value} onChange={() => {}} aria-hidden tabIndex={-1}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKey}
        style={{
          width: "100%",
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 10px",
          border: invalid
            ? "1px solid var(--st-alert-700)"
            : open
            ? "1px solid var(--st-accent)"
            : "1px solid color-mix(in srgb, var(--st-text) 40%, transparent)",
          borderRadius: 0,
          background: "var(--st-surface)",
          color: selected ? "var(--st-text)" : "var(--st-neutral-600)",
          fontFamily: "var(--st-font)",
          fontSize: 14,
          fontWeight: 400,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
          outline: open ? "2px solid var(--st-accent)" : "none",
          outlineOffset: 0,
          textAlign: "left",
          userSelect: "none",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Chevron */}
        <svg
          width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          aria-hidden
          style={{
            flexShrink: 0,
            color: "var(--st-neutral-600)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 160ms cubic-bezier(.2,.75,.3,1)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={triggerId}
          tabIndex={0}
          onKeyDown={onListKey}
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 200,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
            background: "var(--st-bg)",
            border: "1px solid color-mix(in srgb, var(--st-text) 40%, transparent)",
            boxShadow: "var(--st-shadow-md)",
            maxHeight: 260,
            overflowY: "auto",
            overscrollBehavior: "contain",
            // entrance animation
            animation: "st-sel-in 140ms cubic-bezier(.2,.75,.3,1) both",
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isFocused = i === focused;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onMouseEnter={() => !opt.disabled && setFocused(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent trigger blur
                  pick(opt);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "0 12px",
                  height: 40,
                  fontFamily: "var(--st-font)",
                  fontSize: 14,
                  fontWeight: isSelected ? 700 : 400,
                  color: opt.disabled
                    ? "var(--st-neutral-500)"
                    : isSelected
                    ? "var(--st-accent)"
                    : "var(--st-text)",
                  background: isFocused
                    ? "color-mix(in srgb, var(--st-text) 6%, transparent)"
                    : "transparent",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt.label}
                </span>
                {isSelected && (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden style={{ flexShrink: 0, color: "var(--st-accent)" }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <style>{`
        @keyframes st-sel-in {
          from { opacity: 0; transform: translateY(-4px) scaleY(0.97); }
          to   { opacity: 1; transform: translateY(0)   scaleY(1); }
        }
      `}</style>
    </div>
  );
}
