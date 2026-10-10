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

const managerNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/manager",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "Links",
    href: "/manager/links",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8M19 8v6M22 11h-6",
  },
  {
    label: "Devices",
    href: "/manager/devices",
    icon: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11H3zM2 20h20",
  },
  {
    label: "Routers",
    href: "/manager/routers",
    icon: "M2 15h20v6H2zM6 18h.01M10 18h.01M15 11V7M17.8 5.2a4 4 0 0 0-5.6 0M20.6 2.3a8 8 0 0 0-11.2 0",
  },
  {
    label: "Overtime",
    href: "/manager/overtime",
    icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  },
];

const workerNav: NavItem[] = [
  {
    label: "Home",
    href: "/worker",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "Payments",
    href: "/worker/payments",
    icon: "M17 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2m2 4h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm7-5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  },
  {
    label: "My details",
    href: "/worker/details",
    icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z",
  },
  {
    label: "Devices",
    href: "/worker/devices",
    icon: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11H3zM2 20h20",
  },
  {
    label: "Routers",
    href: "/worker/routers",
    icon: "M2 15h20v6H2zM6 18h.01M10 18h.01M15 11V7M17.8 5.2a4 4 0 0 0-5.6 0M20.6 2.3a8 8 0 0 0-11.2 0",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const isWorker = pathname.startsWith("/worker");
  const navItems = isWorker ? workerNav : managerNav;
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

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="sidebar-overlay"
          aria-hidden="true"
        />
      )}

      <aside className={`dashboard-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="ds-sidebar__logo">
          <div className="ds-sidebar__wordmark">
            <WordmarkSvg />
            <span>teward</span>
          </div>
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

        <nav className="ds-sidebar__nav">
          {navItems.map((item) => {
            const isRoot = item.href.split("/").filter(Boolean).length <= 1;
            const active = isRoot
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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

        {/* User menu */}
        <div ref={userMenuRef} className="ds-user-menu">
          {userMenuOpen && (
            <div className="ds-user-dropdown">
              <Link
                href="/change-password"
                onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); }}
                className="ds-user-menu-item"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="0" ry="0" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Change password
              </Link>
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
              <div className="ds-user-role">
                {isWorker ? "Worker" : "Manager"}
              </div>
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
