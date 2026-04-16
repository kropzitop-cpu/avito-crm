import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, Wallet, Bell, CalendarDays, HardDrive, BarChart3, ChevronRight, Brain, UsersRound, LogOut, StickyNote, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAccess } from "@/lib/auth";
import { useState } from "react";

const allNavItems = [
  { icon: LayoutDashboard, label: "Дашборд",     href: "/",          section: null },
  { icon: Users,           label: "Клиенты",     href: "/clients",   section: "clients" },
  { icon: Wallet,          label: "Финансы",     href: "/finance",   section: "finance" },
  { icon: Bell,            label: "Напоминания", href: "/reminders", section: "reminders" },
  { icon: CalendarDays,    label: "Календарь",   href: "/calendar",  section: null },
  { icon: HardDrive,       label: "Яндекс Диск", href: "/yadisk",    section: "yadisk" },
  { icon: Brain,           label: "Промты",      href: "/prompts",   section: "prompts" },
  { icon: StickyNote,      label: "Заметки",     href: "/notes",     section: null },
];

// Tabs to show in the bottom bar (most used)
const BOTTOM_TABS = ["/", "/clients", "/reminders", "/notes"];

export default function AppSidebar() {
  const [location] = useLocation();
  const { user, permissions, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = allNavItems.filter(item => {
    if (!item.section) return true;
    if (user?.role === "admin") return true;
    return hasAccess(permissions, user?.role, item.section as any);
  });

  const bottomItems = navItems.filter(i => BOTTOM_TABS.includes(i.href));
  const drawerItems = navItems.filter(i => !BOTTOM_TABS.includes(i.href));

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col border-r"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", minHeight: "100vh" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c6bff, #22d3ee)" }}
            >
              <BarChart3 size={18} color="white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color: "#e2e8f0" }}>ВоблаCRM</div>
              <div className="text-xs" style={{ color: "#64748b" }}>для авитологов</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map(({ icon: Icon, label, href }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-medium"
                  style={{
                    color: isActive ? "#a78bfa" : "#94a3b8",
                    background: isActive ? "rgba(124,107,255,0.1)" : "transparent",
                    borderLeft: isActive ? "3px solid #7c6bff" : "3px solid transparent",
                  }}
                  data-testid={`nav-${href.replace("/", "") || "dashboard"}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </div>
              </Link>
            );
          })}

          {user?.role === "admin" && (() => {
            const isActive = location.startsWith("/team");
            return (
              <Link href="/team">
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-medium"
                  style={{
                    color: isActive ? "#22d3ee" : "#94a3b8",
                    background: isActive ? "rgba(34,211,238,0.1)" : "transparent",
                    borderLeft: isActive ? "3px solid #22d3ee" : "3px solid transparent",
                  }}
                >
                  <UsersRound size={17} />
                  <span>Команда</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </div>
              </Link>
            );
          })()}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          {user && (
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: user.role === "admin" ? "rgba(124,107,255,0.2)" : "rgba(34,211,238,0.15)", color: user.role === "admin" ? "#a78bfa" : "#22d3ee" }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: "#e2e8f0" }}>{user.name}</div>
                  <div className="text-xs truncate" style={{ color: "#475569" }}>
                    {user.role === "admin" ? "Администратор" : "Помощник"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => logout()}
                title="Выйти"
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                style={{ color: "#475569" }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
          <div className="text-xs" style={{ color: "#334155" }}>v2.0</div>
        </div>
      </aside>

      {/* ── Mobile: top header ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ height: 52, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c6bff, #22d3ee)" }}
          >
            <BarChart3 size={14} color="white" />
          </div>
          <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>ВоблаCRM</span>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: user.role === "admin" ? "rgba(124,107,255,0.2)" : "rgba(34,211,238,0.15)", color: user.role === "admin" ? "#a78bfa" : "#22d3ee" }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile: bottom tab bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
        style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", height: 60 }}
      >
        {bottomItems.map(({ icon: Icon, label, href }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href} className="flex-1">
              <div
                className="flex flex-col items-center justify-center gap-0.5 py-2 transition-all"
                style={{ color: isActive ? "#a78bfa" : "#475569" }}
              >
                <Icon size={20} />
                <span className="text-xs font-medium" style={{ fontSize: 10 }}>{label}</span>
                {isActive && (
                  <div className="w-4 h-0.5 rounded-full" style={{ background: "#7c6bff" }} />
                )}
              </div>
            </Link>
          );
        })}

        {/* More button */}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all"
          style={{ color: drawerOpen ? "#a78bfa" : "#475569" }}
          onClick={() => setDrawerOpen(true)}
        >
          <MoreHorizontal size={20} />
          <span className="text-xs font-medium" style={{ fontSize: 10 }}>Ещё</span>
        </button>
      </nav>

      {/* ── Mobile drawer (slides up from bottom) ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="rounded-t-2xl flex flex-col"
            style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", maxHeight: "80vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>Меню</span>
              <button onClick={() => setDrawerOpen(false)} style={{ color: "#475569" }}>
                <X size={18} />
              </button>
            </div>

            <div className="px-3 pb-3 flex flex-col gap-1 overflow-y-auto">
              {/* All nav items */}
              {navItems.map(({ icon: Icon, label, href }) => {
                const isActive = href === "/" ? location === "/" : location.startsWith(href);
                return (
                  <Link key={href} href={href} onClick={() => setDrawerOpen(false)}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                      style={{
                        color: isActive ? "#a78bfa" : "#e2e8f0",
                        background: isActive ? "rgba(124,107,255,0.12)" : "transparent",
                      }}
                    >
                      <Icon size={18} style={{ color: isActive ? "#a78bfa" : "#64748b" }} />
                      <span>{label}</span>
                      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#7c6bff" }} />}
                    </div>
                  </Link>
                );
              })}

              {user?.role === "admin" && (() => {
                const isActive = location.startsWith("/team");
                return (
                  <Link href="/team" onClick={() => setDrawerOpen(false)}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                      style={{
                        color: isActive ? "#22d3ee" : "#e2e8f0",
                        background: isActive ? "rgba(34,211,238,0.1)" : "transparent",
                      }}
                    >
                      <UsersRound size={18} style={{ color: isActive ? "#22d3ee" : "#64748b" }} />
                      <span>Команда</span>
                    </div>
                  </Link>
                );
              })()}

              {/* Logout */}
              <button
                onClick={() => { logout(); setDrawerOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm w-full mt-1"
                style={{ color: "#f87171", background: "rgba(248,113,113,0.08)" }}
              >
                <LogOut size={18} />
                <span>Выйти</span>
              </button>
            </div>

            {/* Safe area padding for iOS */}
            <div style={{ height: 8 }} />
          </div>
        </div>
      )}
    </>
  );
}
