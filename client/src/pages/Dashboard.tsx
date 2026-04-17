import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Wallet, Bell, TrendingUp, ChevronRight, Clock, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { Reminder, Client } from "@shared/schema";

function StatCard({ icon: Icon, label, value, accent, sub }: {
  icon: any; label: string; value: string | number; accent: string; sub?: string;
}) {
  return (
    <div className="stat-card flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accent}20` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div>
        <div className="text-xs font-medium mb-1" style={{ color: "#64748b" }}>{label}</div>
        <div className="text-2xl font-bold" style={{ color: "#e2e8f0" }}>{value}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{sub}</div>}
      </div>
    </div>
  );
}

function ReminderRow({ r }: { r: Reminder }) {
  const dueDate = new Date(r.dueDate);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isOverdue = dueDate < todayStart && !r.isDone;
  const typeLabels: Record<string, string> = {
    report: "Отчёт", payment: "Оплата", renewal: "Продление", task: "Задача", general: "Общее",
  };
  const priorityColor: Record<string, string> = {
    high: "#f87171", medium: "#fbbf24", low: "#4ade80",
  };
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: priorityColor[r.priority || "medium"] }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "#e2e8f0" }}>{r.title}</div>
        <div className="text-xs" style={{ color: "#64748b" }}>
          {typeLabels[r.type] || r.type}
        </div>
      </div>
      <div
        className="text-xs font-medium shrink-0"
        style={{ color: isOverdue ? "#f87171" : "#94a3b8" }}
      >
        {dueDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats } = useQuery<{
    totalClients: number;
    activeClients: number;
    monthlyRevenue: number;
    pendingReminders: number;
    potentialRevenue: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: reminders = [] } = useQuery<Reminder[]>({ queryKey: ["/api/reminders"] });

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const allPending = reminders
    .filter(r => !r.isDone)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const todayTasks = allPending.filter(r => new Date(r.dueDate) <= todayEnd);
  const tomorrowTasks = allPending.filter(r => {
    const d = new Date(r.dueDate);
    return d > todayEnd && d <= tomorrowEnd;
  });

  // Show today's tasks; if fewer than 3, also show tomorrow's (up to 6 total)
  const upcoming: Array<{ task: Reminder; label: string }> = [
    ...todayTasks.map(r => ({ task: r, label: "today" })),
    ...(todayTasks.length < 3 ? tomorrowTasks.map(r => ({ task: r, label: "tomorrow" })) : []),
  ].slice(0, 6);

  const [showAll, setShowAll] = useState(false);
  const visibleTasks = showAll ? allPending.map(r => ({ task: r, label: "" })) : upcoming;

  const recentClients = clients.slice(0, 5);

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#e2e8f0" }}>
          Дашборд
        </h1>
        <p className="text-sm" style={{ color: "#64748b" }}>
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats — 5 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={Users} label="Всего клиентов" value={stats?.totalClients ?? 0} accent="#7c6bff" />
        <StatCard icon={TrendingUp} label="Активных" value={stats?.activeClients ?? 0} accent="#4ade80" sub="в работе" />
        <StatCard
          icon={Wallet}
          label="Доход за месяц"
          value={`${(stats?.monthlyRevenue ?? 0).toLocaleString("ru-RU")} ₽`}
          accent="#22d3ee"
        />
        <StatCard
          icon={Sparkles}
          label="Потенц. прибыль"
          value={`${(stats?.potentialRevenue ?? 0).toLocaleString("ru-RU")} ₽`}
          accent="#fb923c"
          sub="запланированные платежи"
        />
        <Link href="/reminders" className="block cursor-pointer hover:opacity-90 transition-opacity rounded-2xl">
          <StatCard icon={Bell} label="Напоминаний" value={stats?.pendingReminders ?? 0} accent="#fbbf24" sub="на сегодня" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upcoming reminders */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base" style={{ color: "#e2e8f0" }}>
              <Clock size={16} className="inline mr-2 text-violet-400" />
              Ближайшие задачи
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={{
                  background: showAll ? "rgba(124,107,255,0.2)" : "transparent",
                  color: showAll ? "#a78bfa" : "#64748b",
                  border: `1px solid ${showAll ? "rgba(124,107,255,0.4)" : "transparent"}`,
                }}
              >
                {showAll ? "Свернуть" : "Все"}
              </button>
              <Link href="/reminders">
                <span className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "#7c6bff" }}>
                  Раздел <ChevronRight size={12} />
                </span>
              </Link>
            </div>
          </div>
          {visibleTasks.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-sm"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#475569" }}
            >
              Нет активных задач на сегодня
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleTasks.map(({ task: r, label }, idx) => {
                const prevLabel = idx > 0 ? visibleTasks[idx - 1].label : null;
                const showDivider = !showAll && label !== "" && label !== prevLabel;
                return (
                  <div key={r.id}>
                    {showDivider && (
                      <div className="text-xs font-semibold px-1 pb-1" style={{ color: "#475569", marginTop: idx > 0 ? 8 : 0 }}>
                        {label === "today" ? "Сегодня" : "Завтра"}
                      </div>
                    )}
                    <ReminderRow r={r} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent clients */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base" style={{ color: "#e2e8f0" }}>Клиенты</h2>
            <Link href="/clients">
              <span className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "#7c6bff" }}>
                Все <ChevronRight size={12} />
              </span>
            </Link>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {recentClients.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "#475569" }}>
                Добавьте первого клиента
              </div>
            ) : (
              recentClients.map((c, i) => (
                <Link key={c.id} href={`/clients/${c.id}`}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                    style={{ borderBottom: i < recentClients.length - 1 ? "1px solid var(--color-border)" : "none" }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: c.avatarColor || "#7c6bff", color: "white" }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#e2e8f0" }}>{c.name}</div>
                      <div className="text-xs truncate" style={{ color: "#64748b" }}>{c.niche || "—"}</div>
                    </div>
                    <div
                      className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: c.status === "active" ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)",
                        color: c.status === "active" ? "#4ade80" : "#94a3b8",
                      }}
                    >
                      {c.status === "active" ? "Актив" : c.status === "paused" ? "Пауза" : "Завершён"}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
