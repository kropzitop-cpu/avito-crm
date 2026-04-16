import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell, Plus, Check, Trash2, Clock, ChevronDown, ChevronUp,
  Calendar, MessageSquare, Edit2, AlertCircle, X, Send,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Reminder, Client } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  report: "Отчёт", payment: "Оплата", renewal: "Продление", task: "Задача", general: "Общее",
};
const TYPE_COLORS: Record<string, string> = {
  report: "#22d3ee", payment: "#4ade80", renewal: "#fbbf24", task: "#a78bfa", general: "#94a3b8",
};
const PRIORITY_COLOR: Record<string, string> = { high: "#f87171", medium: "#fbbf24", low: "#4ade80" };
const PRIORITY_LABELS: Record<string, string> = { high: "Высокий", medium: "Средний", low: "Низкий" };

type Period = "today" | "week" | "month" | "custom" | "all";

function periodLabel(p: Period) {
  return { today: "Сегодня", week: "Эта неделя", month: "Этот месяц", custom: "Свой период", all: "Все" }[p];
}

function getRange(period: Period, customFrom: string, customTo: string): { from: Date; to: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return { from: today, to: new Date(today.getTime() + 86400000 - 1) };
  if (period === "week") {
    const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59);
    return { from: mon, to: sun };
  }
  if (period === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }
  if (period === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") };
  }
  return null; // all
}

// ── Add/Edit Form ────────────────────────────────────────────────────────────
function ReminderForm({ clients, onClose, existing }: {
  clients: Client[];
  onClose: () => void;
  existing?: Reminder;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    dueDate: existing?.dueDate ? String(existing.dueDate).slice(0, 10) : "",
    type: existing?.type ?? "general",
    priority: existing?.priority ?? "medium",
    clientId: existing?.clientId ? String(existing.clientId) : "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d: any) => existing
      ? apiRequest("PATCH", `/api/reminders/${existing.id}`, d)
      : apiRequest("POST", "/api/reminders", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: existing ? "Задача обновлена" : "Задача создана" });
      onClose();
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Название *</label>
        <Input value={form.title} onChange={e => set("title", e.target.value)}
          placeholder="Отправить отчёт клиенту" className="bg-transparent border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата *</label>
          <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)}
            className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Клиент</label>
          <Select value={form.clientId || "none"} onValueChange={v => set("clientId", v === "none" ? "" : v)}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue placeholder="Не привязан" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без клиента</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Тип</label>
          <Select value={form.type} onValueChange={v => set("type", v)}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Приоритет</label>
          <Select value={form.priority} onValueChange={v => set("priority", v)}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">🔴 Высокий</SelectItem>
              <SelectItem value="medium">🟡 Средний</SelectItem>
              <SelectItem value="low">🟢 Низкий</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Описание</label>
        <Textarea value={form.description} onChange={e => set("description", e.target.value)}
          rows={3} className="bg-transparent border-border resize-none" placeholder="Подробности..." />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button
          onClick={() => mutation.mutate({
            ...form,
            clientId: form.clientId && form.clientId !== "none" ? Number(form.clientId) : null,
          })}
          disabled={!form.title || !form.dueDate || mutation.isPending}
          style={{ background: "var(--color-violet)", color: "white" }}
        >
          {mutation.isPending ? "Сохраняем..." : existing ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </div>
  );
}

// ── Task Detail Panel ────────────────────────────────────────────────────────
function TaskPanel({ r, clients, onClose }: { r: Reminder; clients: Client[]; onClose: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  // Comments stored in description as appended lines (simple approach without separate table)
  const descLines = (r.description || "").split("\n---\n");
  const baseDesc = descLines[0] || "";
  const comments = descLines.slice(1).filter(Boolean);

  const toggle = useMutation({
    mutationFn: (val: boolean) => apiRequest("PATCH", `/api/reminders/${r.id}`, { isDone: val }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/reminders/${r.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onClose();
    },
  });

  const addComment = useMutation({
    mutationFn: () => {
      const newDesc = [r.description || "", `---\n${new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: ${comment}`]
        .filter(Boolean).join("\n");
      return apiRequest("PATCH", `/api/reminders/${r.id}`, { description: newDesc });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setComment("");
      toast({ title: "Комментарий добавлен" });
    },
  });

  const isOverdue = !r.isDone && new Date(r.dueDate) < new Date();
  const cName = clients.find(c => c.id === r.clientId)?.name;

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>Редактировать задачу</span>
          <button onClick={() => setEditing(false)}><X size={16} style={{ color: "#64748b" }} /></button>
        </div>
        <ReminderForm clients={clients} onClose={() => { setEditing(false); }} existing={r} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${TYPE_COLORS[r.type]}20`, color: TYPE_COLORS[r.type] }}>
              {TYPE_LABELS[r.type]}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: `${PRIORITY_COLOR[r.priority || "medium"]}20`, color: PRIORITY_COLOR[r.priority || "medium"] }}>
              {PRIORITY_LABELS[r.priority || "medium"]}
            </span>
            {r.isDone && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#4ade8020", color: "#4ade80" }}>
                ✓ Выполнено
              </span>
            )}
            {isOverdue && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f8717120", color: "#f87171" }}>
                Просрочено
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold" style={{ color: "#e2e8f0" }}>{r.title}</h3>
          {cName && <p className="text-xs mt-1" style={{ color: "#64748b" }}>Клиент: {cName}</p>}
        </div>
        <button onClick={() => setEditing(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
          <Edit2 size={14} style={{ color: "#64748b" }} />
        </button>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
        style={{ background: isOverdue ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${isOverdue ? "rgba(248,113,113,0.2)" : "var(--color-border)"}` }}>
        <Clock size={14} style={{ color: isOverdue ? "#f87171" : "#64748b" }} />
        <span style={{ color: isOverdue ? "#f87171" : "#94a3b8" }}>
          {new Date(r.dueDate).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {/* Base description */}
      {baseDesc && (
        <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--color-border)", color: "#94a3b8" }}>
          {baseDesc}
        </div>
      )}

      {/* Comments */}
      {comments.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold" style={{ color: "#475569" }}>КОММЕНТАРИИ</div>
          {comments.map((c, i) => {
            const [meta, ...rest] = c.split(": ");
            return (
              <div key={i} className="rounded-lg p-3" style={{ background: "rgba(124,107,255,0.06)", border: "1px solid rgba(124,107,255,0.15)" }}>
                <div className="text-xs mb-1" style={{ color: "#7c6bff" }}>{meta}</div>
                <div className="text-sm" style={{ color: "#cbd5e1" }}>{rest.join(": ")}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment */}
      <div className="flex gap-2 mt-1">
        <Input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Добавить комментарий..."
          className="bg-transparent border-border text-sm flex-1"
          onKeyDown={e => { if (e.key === "Enter" && comment.trim()) addComment.mutate(); }}
        />
        <button
          onClick={() => { if (comment.trim()) addComment.mutate(); }}
          disabled={!comment.trim() || addComment.isPending}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: "rgba(124,107,255,0.2)", color: "#a78bfa" }}
        >
          <Send size={14} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t" style={{ borderColor: "var(--color-border)" }}>
        <Button
          onClick={() => toggle.mutate(!r.isDone)}
          disabled={toggle.isPending}
          className="flex-1 gap-2"
          style={{ background: r.isDone ? "rgba(255,255,255,0.06)" : "rgba(74,222,128,0.15)", color: r.isDone ? "#64748b" : "#4ade80", border: `1px solid ${r.isDone ? "var(--color-border)" : "rgba(74,222,128,0.3)"}` }}
          variant="ghost"
        >
          <Check size={14} /> {r.isDone ? "Снять отметку" : "Отметить выполненным"}
        </Button>
        <button
          onClick={() => del.mutate()}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <Trash2 size={14} style={{ color: "#64748b" }} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Reminders() {
  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showFuture, setShowFuture] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Reminder | null>(null);

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({ queryKey: ["/api/reminders"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const toggle = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => apiRequest("PATCH", `/api/reminders/${id}`, { isDone: val }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const range = useMemo(() => getRange(period, customFrom, customTo), [period, customFrom, customTo]);

  // Filter by period
  const inRange = (r: Reminder) => {
    if (!range) return true;
    const d = new Date(r.dueDate);
    return d >= range.from && d <= range.to;
  };

  const active = reminders.filter(r => !r.isDone && (filterType === "all" || r.type === filterType));
  const done = reminders.filter(r => r.isDone && (filterType === "all" || r.type === filterType));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = active.filter(r => new Date(r.dueDate) < today);
  const inPeriod = active.filter(r => inRange(r) && new Date(r.dueDate) >= today);
  const future = active.filter(r => !inRange(r) && new Date(r.dueDate) >= today);

  const clientName = (id: number | null | undefined) => id ? (clients.find(c => c.id === id)?.name ?? "") : "";

  // Stats for today
  const todayCount = active.filter(r => {
    const d = new Date(r.dueDate); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;

  const ReminderTile = ({ r }: { r: Reminder }) => {
    const isOverdue = !r.isDone && new Date(r.dueDate) < today;
    const isSelected = selected?.id === r.id;
    const cName = clientName(r.clientId ?? null);
    const descLines = (r.description || "").split("\n---\n");
    const commentCount = descLines.slice(1).filter(Boolean).length;

    return (
      <div
        onClick={() => setSelected(isSelected ? null : r)}
        className="rounded-xl p-4 cursor-pointer transition-all"
        style={{
          background: isSelected ? "rgba(124,107,255,0.1)" : "var(--color-surface)",
          border: `1px solid ${isSelected ? "rgba(124,107,255,0.4)" : isOverdue ? "rgba(248,113,113,0.25)" : "var(--color-border)"}`,
          boxShadow: isSelected ? "0 0 0 1px rgba(124,107,255,0.2)" : "none",
          opacity: r.isDone ? 0.55 : 1,
        }}
        data-testid={`card-reminder-${r.id}`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: PRIORITY_COLOR[r.priority || "medium"] }} />
            <span className="text-sm font-semibold leading-tight" style={{ color: r.isDone ? "#475569" : "#e2e8f0", textDecoration: r.isDone ? "line-through" : "none" }}>
              {r.title}
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); toggle.mutate({ id: r.id, val: !r.isDone }); }}
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mt-0.5"
            style={{ borderColor: r.isDone ? "#4ade80" : "#334155", background: r.isDone ? "#4ade8033" : "transparent" }}
          >
            {r.isDone && <Check size={10} style={{ color: "#4ade80" }} />}
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[r.type]}15`, color: TYPE_COLORS[r.type] }}>
            {TYPE_LABELS[r.type]}
          </span>
          {cName && <span className="text-xs" style={{ color: "#475569" }}>{cName}</span>}
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs" style={{ color: "#7c6bff" }}>
              <MessageSquare size={10} /> {commentCount}
            </span>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center gap-1 mt-2">
          <Clock size={10} style={{ color: isOverdue ? "#f87171" : "#475569" }} />
          <span className="text-xs" style={{ color: isOverdue ? "#f87171" : "#475569" }}>
            {new Date(r.dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            {isOverdue && " · Просрочено"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-0.5" style={{ color: "#e2e8f0" }}>Задачи</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            {todayCount > 0 ? `${todayCount} на сегодня` : "Нет задач на сегодня"} · {overdue.length > 0 ? `${overdue.length} просрочено` : "без просрочек"}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} style={{ background: "var(--color-violet)", color: "white" }} className="gap-2">
          <Plus size={15} /> Новая задача
        </Button>
      </div>

      {/* Period filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {(["today", "week", "month", "all", "custom"] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: period === p ? "rgba(124,107,255,0.2)" : "transparent",
              border: `1px solid ${period === p ? "rgba(124,107,255,0.4)" : "var(--color-border)"}`,
              color: period === p ? "#a78bfa" : "#64748b",
            }}>
            {periodLabel(p)}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-transparent border-border text-xs h-7 w-32" />
            <span style={{ color: "#475569" }}>—</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-transparent border-border text-xs h-7 w-32" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Type filter */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32 bg-transparent border-border text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Done toggle */}
          <button onClick={() => setShowDone(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: showDone ? "rgba(74,222,128,0.15)" : "transparent",
              border: `1px solid ${showDone ? "rgba(74,222,128,0.3)" : "var(--color-border)"}`,
              color: showDone ? "#4ade80" : "#64748b",
            }}>
            {showDone ? "✓ Выполненные" : "Выполненные"}
          </button>
        </div>
      </div>

      {/* Main layout: tiles + detail panel */}
      <div className="flex gap-5">
        {/* Left: tiles */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--color-surface)" }} />
              ))}
            </div>
          ) : !showDone ? (
            <div className="flex flex-col gap-5">
              {/* Overdue */}
              {overdue.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={14} style={{ color: "#f87171" }} />
                    <span className="text-xs font-semibold" style={{ color: "#f87171" }}>ПРОСРОЧЕНО ({overdue.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {overdue.map(r => <ReminderTile key={r.id} r={r} />)}
                  </div>
                </div>
              )}

              {/* In period */}
              {inPeriod.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} style={{ color: "#a78bfa" }} />
                    <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
                      {periodLabel(period).toUpperCase()} ({inPeriod.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inPeriod.map(r => <ReminderTile key={r.id} r={r} />)}
                  </div>
                </div>
              )}

              {inPeriod.length === 0 && overdue.length === 0 && (
                <div className="text-center py-12 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <Bell size={36} className="mx-auto mb-3" style={{ color: "#334155" }} />
                  <p className="text-sm" style={{ color: "#475569" }}>Нет задач за выбранный период</p>
                </div>
              )}

              {/* Future (collapsed) */}
              {future.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowFuture(v => !v)}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors w-full"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--color-border)", color: "#475569" }}
                  >
                    {showFuture ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Будущие задачи ({future.length})
                    <span className="ml-auto" style={{ color: "#334155" }}>{showFuture ? "Скрыть" : "Показать"}</span>
                  </button>
                  {showFuture && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                      {future.map(r => <ReminderTile key={r.id} r={r} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Done tasks
            <div>
              {done.length === 0 ? (
                <div className="text-center py-12 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <p className="text-sm" style={{ color: "#475569" }}>Нет выполненных задач</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {done.map(r => <ReminderTile key={r.id} r={r} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="w-80 shrink-0">
            <div className="rounded-xl p-4 sticky top-6" style={{ background: "var(--color-surface)", border: "1px solid rgba(124,107,255,0.3)" }}>
              <TaskPanel r={selected} clients={clients} onClose={() => setSelected(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e2e8f0" }}>Новая задача</DialogTitle>
          </DialogHeader>
          <ReminderForm clients={clients} onClose={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
