import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

interface DataTableProps {
  headers: string[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: {
    icon?: string;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    secondaryAction?: { label: string; onClick: () => void };
  };
  children?: ReactNode;
  skeletonRows?: number;
  hasData?: boolean;
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={`sk-${i}`}>
          <div
            className="ds-skeleton"
            style={{ height: "14px", width: i === 0 ? "60%" : "80%" }}
          />
        </td>
      ))}
    </tr>
  );
}

export function DataTable({
  headers,
  loading = false,
  error = null,
  onRetry,
  empty,
  children,
  skeletonRows = 4,
  hasData = true,
}: DataTableProps) {
  const showEmpty = !loading && !error && !hasData;

  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={`skeleton-row-${i}`} columns={headers.length} />
              ))
            : children}
        </tbody>
      </table>

      {error && (
        <div className="ds-table-error">
          <div className="ds-table-error__msg">{error}</div>
          {onRetry && (
            <button type="button" onClick={onRetry} className="st-btn st-btn--secondary">
              Retry
            </button>
          )}
        </div>
      )}

      {showEmpty && (
        <div className="ds-table-empty">
          {empty ? <EmptyState {...empty} /> : <EmptyState title="Nothing here yet" />}
        </div>
      )}
    </div>
  );
}
