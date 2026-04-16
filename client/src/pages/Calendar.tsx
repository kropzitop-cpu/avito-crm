import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Reminder, Client } from "@shared/schema";

const TYPE_COLORS: Record<string, string> = {
  report: "#22d3ee", payment: "#4ade80", renewal: "#fbbf24",
  task: "#a78bfa", general: "#94a3b8",
};
const TYPE_LABELS: Record<string, string> = {
  report: "Отчёт", payment: "Оплата", renewal: "Продление", task: "Задача", general: "Общее",
};
const PRIORITY_COLORS: Record<string, string> = { high: "#f87171", medium: "#fbbf24", low: "#4ade80" };

const DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun → convert to Mon-based
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function getWeekDays(year: number, month: number, weekIndex: number) {
  // returns array of {day, month, year} for a given ISO week
  const firstDay = new Date(year, month, 1);
  const firstMon = new Date(firstDay);
  const dow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  firstMon.setDate(firstDay.getDate() - dow + weekIndex * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(firstMon);
    d.setDate(firstMon.getDate() + i);
    return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
  });
}

export default function CalendarPage() {
  const today = new Date();
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [curWeek, setCurWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", dueDate: "", type: "task", priority: "medium", clientId: "", recurrence: "none", recurrenceEnd: "", description: "" });
  const { toast } = useToast();

  const { data: allReminders = [] } = useQuery<Reminder[]>({ queryKey: ["/api/reminders/all"], queryFn: () => apiRequest("GET", "/api/reminders/all").then(r => r.json()) });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const toggleDone = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => apiRequest("PATCH", `/api/reminders/${id}`, { isDone: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] }),
  });

  const addReminder = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/reminders", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Задача добавлена" });
      setShowAddDialog(false);
      setNewForm({ title: "", dueDate: "", type: "task", priority: "medium", clientId: "", recurrence: "none", recurrenceEnd: "", description: "" });
    },
  });

  const clientName = (id: number | null) => id ? (clients.find(c => c.id === id)?.name ?? "") : "";

  // Map reminders by date string
  const byDate: Record<string, Reminder[]> = {};
  for (const r of allReminders) {
    if (!byDate[r.dueDate]) byDate[r.dueDate] = [];
    byDate[r.dueDate].push(r);
  }

  const navPrev = () => {
    if (viewMode === "month") {
      if (curMonth === 0) { setCurMonth(11); setCurYear(y => y - 1); }
      else setCurMonth(m => m - 1);
    } else {
      if (curWeek === 0) {
        const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
        const prevYear = curMonth === 0 ? curYear - 1 : curYear;
        const weeks = Math.ceil((getDaysInMonth(prevYear, prevMonth) + getFirstDayOfMonth(prevYear, prevMonth)) / 7);
        setCurMonth(prevMonth); setCurYear(prevYear); setCurWeek(weeks - 1);
      } else setCurWeek(w => w - 1);
    }
  };
  const navNext = () => {
    if (viewMode === "month") {
      if (curMonth === 11) { setCurMonth(0); setCurYear(y => y + 1); }
      else setCurMonth(m => m + 1);
    } else {
      const totalWeeks = Math.ceil((getDaysInMonth(curYear, curMonth) + getFirstDayOfMonth(curYear, curMonth)) / 7);
      if (curWeek >= totalWeeks - 1) {
        const nextMonth = curMonth === 11 ? 0 : curMonth + 1;
        const nextYear = curMonth === 11 ? curYear + 1 : curYear;
        setCurMonth(nextMonth); setCurYear(nextYear); setCurWeek(0);
      } else setCurWeek(w => w + 1);
    }
  };

  const firstDay = getFirstDayOfMonth(curYear, curMonth);
  const daysInMonth = getDaysInMonth(curYear, curMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const dateKey = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const weekDays = viewMode === "week" ? getWeekDays(curYear, curMonth, curWeek) : [];

  // Selected day reminders
  const selectedReminders = selectedDay ? (byDate[selectedDay] || []) : [];

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-0.5" style={{ color: "#e2e8f0" }}>Календарь</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>{allReminders.filter(r => !r.isDone).length} активных задач</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            {(["month", "week"] as const).map(v => (
              <button key={v} onClick={() => { setViewMode(v); setCurWeek(0); }}
                className="px-3 py-1.5 text-sm transition-colors"
                style={{ background: viewMode === v ? "#7c6bff" : "transparent", color: viewMode === v ? "white" : "#64748b" }}>
                {v === "month" ? "Месяц" : "Неделя"}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowAddDialog(true)} style={{ background: "#7c6bff", color: "white" }} className="gap-2">
            <Plus size={15} /> Задача
          </Button>
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={navPrev} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ border: "1px solid var(--color-border)" }}>
          <ChevronLeft size={16} style={{ color: "#94a3b8" }} />
        </button>
        <span className="text-base font-semibold" style={{ color: "#e2e8f0" }}>
          {MONTHS_RU[curMonth]} {curYear}
          {viewMode === "week" && weekDays.length > 0 && ` · ${weekDays[0].day}–${weekDays[6].day}`}
        </span>
        <button onClick={navNext} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ border: "1px solid var(--color-border)" }}>
          <ChevronRight size={16} style={{ color: "#94a3b8" }} />
        </button>
        <button onClick={() => { setCurYear(today.getFullYear()); setCurMonth(today.getMonth()); setCurWeek(0); }}
          className="text-xs px-3 py-1 rounded-lg transition-colors" style={{ border: "1px solid var(--color-border)", color: "#7c6bff" }}>
          Сегодня
        </button>
      </div>

      <div className="flex gap-5">
        {/* Calendar grid */}
        <div className="flex-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_RU.map(d => (
              <div key={d} className="text-center text-xs font-medium py-1.5" style={{ color: "#64748b" }}>{d}</div>
            ))}
          </div>

          {viewMode === "month" ? (
            <div className="grid grid-cols-7 gap-px" style={{ background: "var(--color-border)" }}>
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dk = isCurrentMonth ? dateKey(curYear, curMonth, dayNum) : "";
                const dayEvents = dk ? (byDate[dk] || []) : [];
                const isToday = dk === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
                const isSelected = dk === selectedDay;
                return (
                  <div
                    key={idx}
                    onClick={() => isCurrentMonth && setSelectedDay(dk === selectedDay ? null : dk)}
                    className="min-h-20 p-1.5 cursor-pointer transition-colors"
                    style={{
                      background: isSelected ? "rgba(124,107,255,0.15)" : isToday ? "rgba(124,107,255,0.07)" : "var(--color-surface)",
                      opacity: isCurrentMonth ? 1 : 0.3,
                    }}
                  >
                    <div
                      className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1"
                      style={{
                        color: isToday ? "white" : "#94a3b8",
                        background: isToday ? "#7c6bff" : "transparent",
                      }}
                    >
                      {isCurrentMonth ? dayNum : ""}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map(r => (
                        <div
                          key={r.id}
                          className="text-xs px-1 py-0.5 rounded truncate"
                          style={{
                            background: `${TYPE_COLORS[r.type] || "#94a3b8"}20`,
                            color: TYPE_COLORS[r.type] || "#94a3b8",
                            textDecoration: r.isDone ? "line-through" : "none",
                            opacity: r.isDone ? 0.5 : 1,
                          }}
                        >
                          {r.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs" style={{ color: "#475569" }}>+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Week view
            <div className="grid grid-cols-7 gap-px" style={{ background: "var(--color-border)" }}>
              {weekDays.map(({ day, month, year }) => {
                const dk = dateKey(year, month, day);
                const dayEvents = byDate[dk] || [];
                const isToday = dk === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
                const isSelected = dk === selectedDay;
                return (
                  <div
                    key={dk}
                    onClick={() => setSelectedDay(dk === selectedDay ? null : dk)}
                    className="min-h-48 p-2 cursor-pointer transition-colors"
                    style={{
                      background: isSelected ? "rgba(124,107,255,0.15)" : isToday ? "rgba(124,107,255,0.07)" : "var(--color-surface)",
                    }}
                  >
                    <div className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2"
                      style={{ color: isToday ? "white" : "#94a3b8", background: isToday ? "#7c6bff" : "transparent" }}>
                      {day}
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayEvents.map(r => (
                        <div key={r.id} className="text-xs px-1.5 py-1 rounded"
                          style={{
                            background: `${TYPE_COLORS[r.type] || "#94a3b8"}20`,
                            color: TYPE_COLORS[r.type] || "#94a3b8",
                            textDecoration: r.isDone ? "line-through" : "none",
                            opacity: r.isDone ? 0.5 : 1,
                          }}>
                          {r.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side panel — selected day events */}
        <div className="w-72 shrink-0">
          <div className="rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            {selectedDay ? (
              <>
                <div className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: "#e2e8f0" }}>
                  <Clock size={14} style={{ color: "#7c6bff" }} />
                  {new Date(selectedDay + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </div>
                {selectedReminders.length === 0 ? (
                  <p className="text-xs" style={{ color: "#475569" }}>Нет задач на этот день</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedReminders.map(r => (
                      <div key={r.id} className="rounded-lg p-2.5" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleDone.mutate({ id: r.id, val: !r.isDone })}
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                            style={{ borderColor: r.isDone ? "#4ade80" : "#334155", background: r.isDone ? "#4ade8030" : "transparent" }}
                          >
                            {r.isDone && <div className="w-2 h-2 rounded-full bg-green-400" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium" style={{ color: r.isDone ? "#475569" : "#e2e8f0", textDecoration: r.isDone ? "line-through" : "none" }}>{r.title}</div>
                            {clientName(r.clientId ?? null) && (
                              <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{clientName(r.clientId ?? null)}</div>
                            )}
                            <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                              style={{ background: `${TYPE_COLORS[r.type]}20`, color: TYPE_COLORS[r.type] }}>
                              {TYPE_LABELS[r.type]}
                            </span>
                          </div>
                          <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: PRIORITY_COLORS[r.priority || "medium"] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="mt-3 w-full text-xs py-1.5 rounded-lg transition-colors hover:bg-violet-900/30"
                  style={{ border: "1px dashed rgba(124,107,255,0.4)", color: "#7c6bff" }}
                  onClick={() => { setNewForm(f => ({ ...f, dueDate: selectedDay })); setShowAddDialog(true); }}
                >
                  + Добавить задачу
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <CalendarDays size={32} className="mx-auto mb-2" style={{ color: "#334155" }} />
                <p className="text-xs" style={{ color: "#475569" }}>Выберите день для просмотра задач</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Reminder Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e2e8f0" }}>Новая задача</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Название *</label>
              <Input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} placeholder="Отправить отчёт" className="bg-transparent border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата *</label>
                <Input type="date" value={newForm.dueDate} onChange={e => setNewForm(f => ({ ...f, dueDate: e.target.value }))} className="bg-transparent border-border" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Клиент</label>
                <Select value={newForm.clientId} onValueChange={v => setNewForm(f => ({ ...f, clientId: v }))}>
                  <SelectTrigger className="bg-transparent border-border"><SelectValue placeholder="Без клиента" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без клиента</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Тип</label>
                <Select value={newForm.type} onValueChange={v => setNewForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="report">Отчёт</SelectItem>
                    <SelectItem value="payment">Оплата</SelectItem>
                    <SelectItem value="renewal">Продление</SelectItem>
                    <SelectItem value="task">Задача</SelectItem>
                    <SelectItem value="general">Общее</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Приоритет</label>
                <Select value={newForm.priority} onValueChange={v => setNewForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Высокий</SelectItem>
                    <SelectItem value="medium">Средний</SelectItem>
                    <SelectItem value="low">Низкий</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Повторение</label>
                <Select value={newForm.recurrence} onValueChange={v => setNewForm(f => ({ ...f, recurrence: v }))}>
                  <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без повторения</SelectItem>
                    <SelectItem value="daily">Ежедневно</SelectItem>
                    <SelectItem value="weekly">Еженедельно</SelectItem>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newForm.recurrence !== "none" && (
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>До даты</label>
                  <Input type="date" value={newForm.recurrenceEnd} onChange={e => setNewForm(f => ({ ...f, recurrenceEnd: e.target.value }))} className="bg-transparent border-border" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Описание</label>
              <Textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} rows={2} className="bg-transparent border-border resize-none" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Отмена</Button>
              <Button
                onClick={() => addReminder.mutate({
                  ...newForm,
                  clientId: newForm.clientId && newForm.clientId !== "none" ? Number(newForm.clientId) : null,
                  recurrenceEnd: newForm.recurrenceEnd || null,
                  isDone: false,
                  parentId: null,
                })}
                disabled={!newForm.title || !newForm.dueDate || addReminder.isPending}
                style={{ background: "#7c6bff", color: "white" }}
              >
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
