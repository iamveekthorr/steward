"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const adminNav: NavItem[] = [
  {
    label: "Overview",
    href: "/admin/overview",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "Provision",
    href: "/admin/provision",
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  },
  {
    label: "Managers",
    href: "/admin/managers",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    label: "Links",
    href: "/admin/links",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8M19 8v6M22 11h-6",
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z",
  },
  {
    label: "Subscriptions",
    href: "/admin/subscriptions",
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
];

const WordmarkSvg = () => (
  <svg
    viewBox="0 2 16 19.4"
    className="ds-sidebar__wordmark-icon"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.9"
    strokeLinecap="square"
    aria-hidden="true"
  >
    <path d="M14 3.5H6.2a4.1 4.1 0 0 0 0 8.2h3.6a4.1 4.1 0 0 1 0 8.2H2" />
    <path d="M11.5 1L14 3.5L11.5 6M4.5 17.4L2 19.9L4.5 22.4" />
  </svg>
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="dashboard-layout dashboard-grid">
        <aside className="ds-layout-skel__sidebar">
          <div className="ds-layout-skel__logo">
            <div className="ds-layout-skel__logo-bar" />
          </div>
          <div className="ds-layout-skel__nav">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="ds-layout-skel__nav-item" />
            ))}
          </div>
        </aside>
        <main className="ds-layout-skel__main">
          <div className="ds-layout-skel__title" />
          <div className="ds-layout-skel__grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ds-layout-skel__card" />
            ))}
          </div>
          <div className="ds-layout-skel__chart" />
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout dashboard-grid">
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <div className="ds-topbar__wordmark">
          <WordmarkSvg />
          <span>teward</span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="ds-topbar__hamburger"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="sidebar-overlay" aria-hidden="true" />
      )}

      <aside className={`dashboard-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="ds-sidebar__logo">
          <div className="ds-sidebar__wordmark">
            <WordmarkSvg />
            <span>teward</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--st-accent)", background: "var(--st-accent-100)", padding: "2px 6px" }}>
              Admin
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="sidebar-close-btn"
              aria-label="Close menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="ds-sidebar__nav">
          {adminNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`nav-item${active ? " nav-item--active" : ""}`}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div ref={userMenuRef} className="ds-user-menu">
          {userMenuOpen && (
            <div className="ds-user-dropdown">
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); signOut(); }}
                className="ds-user-signout"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="user-trigger"
            aria-expanded={userMenuOpen}
          >
            <div className="ds-avatar">
              {user.first_name.charAt(0).toUpperCase()}
            </div>
            <div className="ds-user-info">
              <div className="ds-user-name">
                {user.first_name} {user.last_name.charAt(0)}.
              </div>
              <div className="ds-user-role">Admin</div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ds-user-chevron"
              style={{ transform: userMenuOpen ? "rotate(180deg)" : "none" }}
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
