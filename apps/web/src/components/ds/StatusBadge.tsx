interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  active: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  verified: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  completed: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  paid: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  on_schedule: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  with_manager: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  with_link: { bg: "var(--st-accent-100)", color: "var(--st-accent)" },
  pending: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-700)" },
  pending_invite: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-700)" },
  in_transit: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-700)" },
  unassigned: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-600)" },
  inactive: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-600)" },
  offline: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-600)" },
  cancelled: { bg: "var(--st-neutral-200)", color: "var(--st-neutral-600)" },
  suspended: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
  terminated: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
  overdue: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
  late: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
  failed: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
  revoked: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
  lost: { bg: "var(--st-alert-100)", color: "var(--st-alert-700)" },
};

function normalise(s: string) {
  return s.toLowerCase().replace(/[\s-]+/g, "_");
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const key = normalise(status);
  const cfg = STATUS_MAP[key] ?? { bg: "var(--st-neutral-200)", color: "var(--st-neutral-700)" };
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        fontWeight: 800,
        fontSize: size === "sm" ? "10px" : "11px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: size === "sm" ? "2px 6px" : "3px 8px",
        fontFamily: "'Archivo', system-ui, sans-serif",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
