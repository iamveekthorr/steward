import type { ReactNode } from "react";

interface PageHeaderProps {
  role?: string;
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ role, title, actions }: PageHeaderProps) {
  return (
    <header className="st-header ds-page-header">
      <div>
        {role && (
          <div className="st-kicker st-kicker--accent st-header__kicker">{role}</div>
        )}
        <h1 className="st-page-title">{title}</h1>
      </div>
      {actions && <div className="st-header__actions">{actions}</div>}
    </header>
  );
}
