"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseYMD(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDisplay(s: string): string {
  const d = parseYMD(s);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export interface DatePickerProps {
  value: string;       // "YYYY-MM-DD"
  onChange: (v: string) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  min?: string;
  max?: string;
}

export function DatePicker({ value, onChange, id, disabled, invalid, min, max }: DatePickerProps) {
  const uid = useId();
  const triggerId = id ?? `st-dp-${uid}`;
  const dialogId = `st-dp-cal-${uid}`;

  const [open, setOpen] = useState(false);
  const today = new Date();
  const selected = parseYMD(value);

  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const d = selected ?? today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Compute dropdown position — viewport-relative for position:fixed
  function computePos() {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
  }

  // Keep dropdown anchored to trigger when the modal scrolls
  useEffect(() => {
    if (!open) return;
    function onScroll() { computePos(); }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click — check both container and portal dropdown
  useEffect(() => {
    if (!open) return;
    computePos();
    function handle(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const portalEl = document.getElementById("st-dp-portal");
      const inPortal = portalEl?.contains(target);
      if (!inContainer && !inPortal) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sync view to selected value when it changes externally
  useEffect(() => {
    if (selected) setView({ year: selected.getFullYear(), month: selected.getMonth() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Auto-focus the day grid when the calendar opens
  useEffect(() => {
    if (open) {
      // rAF so the portal has rendered before we try to focus
      requestAnimationFrame(() => { gridRef.current?.focus(); });
    }
  }, [open]);

  function pick(y: number, m: number, d: number) {
    const date = new Date(y, m, d);
    const str = toYMD(date);
    if (min && str < min) return;
    if (max && str > max) return;
    onChange(str);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function prevMonth() {
    setView(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  }
  function nextMonth() {
    setView(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  }

  const { year, month } = view;
  const firstDay = firstDayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);

  // Build calendar cells: leading blanks + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function isDayDisabled(d: number) {
    const str = toYMD(new Date(year, month, d));
    if (min && str < min) return true;
    if (max && str > max) return true;
    return false;
  }

  function isToday(d: number) {
    return year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  }

  function isSelected(d: number) {
    return !!selected && year === selected.getFullYear() && month === selected.getMonth() && d === selected.getDate();
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const cur = selected && isSelected(selected.getDate()) ? selected.getDate() : 1;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); const next = cur + 1; if (next <= totalDays) pick(year, month, next); else { nextMonth(); } }
    else if (e.key === "ArrowLeft") { e.preventDefault(); const prev = cur - 1; if (prev >= 1) pick(year, month, prev); else prevMonth(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); const n = cur + 7; if (n <= totalDays) pick(year, month, n); else nextMonth(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const p = cur - 7; if (p >= 1) pick(year, month, p); else prevMonth(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(year, month, cur); }
  }

  const triggerBorder = invalid
    ? "1px solid var(--st-alert-700)"
    : open
    ? "1px solid var(--st-accent)"
    : "1px solid color-mix(in srgb, var(--st-text) 40%, transparent)";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger — styled like st-input but with calendar icon */}
      <div style={{ position: "relative", display: "flex" }}>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          aria-invalid={invalid}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            if ((e.key === "Enter" || e.key === " " || e.key === "ArrowDown") && !open) {
              e.preventDefault(); setOpen(true);
            }
          }}
          style={{
            flex: 1,
            height: 36,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            borderTop: triggerBorder,
            borderBottom: triggerBorder,
            borderLeft: triggerBorder,
            borderRight: "none",
            borderRadius: 0,
            background: "var(--st-surface)",
            color: value ? "var(--st-text)" : "var(--st-neutral-600)",
            fontFamily: "var(--st-font)",
            fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
            outline: open ? "2px solid var(--st-accent)" : "none",
            outlineOffset: 0,
            textAlign: "left",
            userSelect: "none",
          }}
        >
          <span style={{ flex: 1 }}>{value ? fmtDisplay(value) : "Select date"}</span>
        </button>
        {/* Calendar icon button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-hidden
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            flexShrink: 0,
            border: triggerBorder,
            borderRadius: 0,
            background: open ? "color-mix(in srgb, var(--st-accent) 8%, var(--st-surface))" : "var(--st-surface)",
            color: open ? "var(--st-accent)" : "var(--st-neutral-600)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="0" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {/* Calendar dropdown — rendered via portal to escape overflow:hidden parents */}
      {open && dropdownPos && typeof document !== "undefined" && createPortal(
        <div id="st-dp-portal">
        <div
          id={dialogId}
          role="dialog"
          aria-label="Date picker"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
            background: "var(--st-bg)",
            border: "1px solid color-mix(in srgb, var(--st-text) 40%, transparent)",
            boxShadow: "var(--st-shadow-lg)",
            width: Math.max(dropdownPos.width, 280),
            padding: "12px",
            animation: "st-sel-in 140ms cubic-bezier(.2,.75,.3,1) both",
            pointerEvents: "auto",
          }}
        >
          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} aria-label="Previous month"
              style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--st-neutral-700)" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span style={{ fontFamily: "var(--st-font)", fontSize: 13, fontWeight: 800, color: "var(--st-text)" }}>
              {MONTHS[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} aria-label="Next month"
              style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--st-neutral-700)" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--st-neutral-600)", fontFamily: "var(--st-font)", padding: "2px 0" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div
            ref={gridRef}
            tabIndex={0}
            onKeyDown={onGridKey}
            aria-label={`${MONTHS[month]} ${year}`}
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, outline: "none" }}
          >
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const sel = isSelected(day);
              const tod = isToday(day);
              const dis = isDayDisabled(day);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={dis}
                  tabIndex={-1}
                  onClick={() => pick(year, month, day)}
                  aria-label={`${day} ${MONTHS[month]} ${year}${sel ? ", selected" : ""}${tod ? ", today" : ""}`}
                  aria-pressed={sel}
                  style={{
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--st-font)",
                    fontSize: 13,
                    fontWeight: sel ? 800 : tod ? 600 : 400,
                    background: sel ? "var(--st-accent)" : "transparent",
                    color: sel
                      ? "var(--st-on-dark)"
                      : tod
                      ? "var(--st-accent)"
                      : dis
                      ? "var(--st-neutral-400)"
                      : "var(--st-text)",
                    border: tod && !sel ? "1px solid var(--st-accent)" : "none",
                    cursor: dis ? "not-allowed" : "pointer",
                    opacity: dis ? 0.4 : 1,
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ marginTop: 10, borderTop: "1px solid var(--st-divider)", paddingTop: 8, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => pick(today.getFullYear(), today.getMonth(), today.getDate())}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--st-accent)", fontWeight: 700, fontFamily: "var(--st-font)" }}
            >
              Today
            </button>
          </div>
        </div>
        </div>,
        document.body
      )}
    </div>
  );
}
