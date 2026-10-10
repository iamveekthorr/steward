import type { ReactNode } from "react";

const ICON_PATHS: Record<string, string> = {
  links:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8M19 8v6M22 11h-6",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16M21 21l-4.3-4.3",
  device: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11H3zM2 20h20",
  router: "M2 15h20v6H2zM6 18h.01M10 18h.01M15 11V7M17.8 5.2a4 4 0 0 0-5.6 0",
  clock: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7v5l3 2",
  receipt: "M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1zM9 8h6M9 12h6",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
};

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: keyof typeof ICON_PATHS | ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

const btnBase: React.CSSProperties = {
  padding: "0 18px",
  minHeight: 40,
  fontSize: 13,
  fontWeight: 800,
  fontFamily: "'Archivo', system-ui, sans-serif",
  cursor: "pointer",
  letterSpacing: "0.02em",
};

function IconBox({ iconKey }: { iconKey: string }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        display: "grid",
        placeItems: "center",
        border: "2px solid var(--st-divider)",
        color: "var(--st-neutral-700)",
        flexShrink: 0,
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATHS[iconKey]} />
      </svg>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  let iconNode: ReactNode;

  if (typeof icon === "string" && ICON_PATHS[icon]) {
    iconNode = <IconBox iconKey={icon} />;
  } else if (icon) {
    iconNode = icon as ReactNode;
  } else {
    iconNode = <IconBox iconKey="links" />;
  }

  return (
    <div
      style={{
        background: "var(--st-bg)",
        border: "2px solid var(--st-divider)",
        padding: "32px 28px",
        minHeight: 260,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {iconNode}
      <h3
        style={{
          margin: "18px 0 6px",
          fontSize: 21,
          fontWeight: 800,
          fontFamily: "'Archivo', system-ui, sans-serif",
          color: "var(--st-text)",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 14,
            color: "var(--st-neutral-800)",
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 380,
          }}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 16 }}>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              style={{ ...btnBase, background: "var(--st-accent)", color: "#fff", border: "none" }}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              style={{
                ...btnBase,
                background: "transparent",
                color: "var(--st-text)",
                border: "2px solid var(--st-divider)",
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
