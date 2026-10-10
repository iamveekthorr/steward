import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className={[
          "w-full rounded-md border bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600",
          "transition-colors duration-150",
          error
            ? "border-red-500/60 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
            : "border-white/10 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20",
          className,
        ].join(" ")}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
