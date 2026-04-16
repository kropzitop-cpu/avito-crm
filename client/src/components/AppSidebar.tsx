import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, Wallet, Bell, CalendarDays, HardDrive, BarChart3, ChevronRight, Brain, UsersRound, LogOut, StickyNote } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAccess } from "@/lib/auth";

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

export default function AppSidebar() {
  const [location] = useLocation();
  const { user, permissions, logout } = useAuth();

  // Фильтруем пункты меню по правам
  const navItems = allNavItems.filter(item => {
    if (!item.section) return true; // Дашборд/Календарь — всегда видны
    if (user?.role === "admin") return true;
    return hasAccess(permissions, user?.role, item.section as any);
  });

  return (
    <aside
      className="w-60 shrink-0 flex flex-col border-r"
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
            <div className="font-bold text-sm leading-tight" style={{ color: "#e2e8f0" }}>АвитоCRM</div>
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

        {/* Команда — только для админа */}
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

      {/* User info + logout */}
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
  );
}
