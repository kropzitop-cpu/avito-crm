import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, DollarSign, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Payment, Client } from "@shared/schema";

export default function Finance() {
  const { toast } = useToast();
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientId: "", amount: "", date: new Date().toISOString().split("T")[0], type: "income", description: "" });

  const { data: payments = [] } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const addPayment = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/payments", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Платёж добавлен" });
      setShowAdd(false);
      setForm({ clientId: "", amount: "", date: new Date().toISOString().split("T")[0], type: "income", description: "" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/payments/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Платёж отмечен как полученный" });
    },
  });

  const filtered = payments.filter(p => {
    const matchMonth = p.date.startsWith(monthFilter);
    const matchType = typeFilter === "all" || p.type === typeFilter;
    return matchMonth && matchType;
  });

  const totalIncome = filtered.filter(p => p.type === "income" && p.isPaid).reduce((s, p) => s + p.amount, 0);
  const totalExpense = filtered.filter(p => p.type === "expense").reduce((s, p) => s + p.amount, 0);
  const profit = totalIncome - totalExpense;

  const clientName = (id: number) => clients.find(c => c.id === id)?.name ?? "Без клиента";

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e2e8f0" }}>Финансы</h1>
        <Button onClick={() => setShowAdd(true)} style={{ background: "var(--color-violet)", color: "white" }} className="gap-2">
          <Plus size={15} /> Добавить платёж
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: TrendingUp, label: "Доход", value: totalIncome, color: "#4ade80" },
          { icon: TrendingDown, label: "Расход", value: totalExpense, color: "#f87171" },
          { icon: DollarSign, label: "Прибыль", value: profit, color: profit >= 0 ? "#22d3ee" : "#f87171" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>{label}</div>
                <div className="text-xl font-bold" style={{ color }}>{value.toLocaleString("ru-RU")} ₽</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-40 bg-transparent border-border" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 bg-transparent border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="income">Доход</SelectItem>
            <SelectItem value="expense">Расход</SelectItem>
            <SelectItem value="refund">Возврат</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-xs font-medium" style={{ color: "#64748b", borderBottom: "1px solid var(--color-border)" }}>
          <span>Дата</span><span>Клиент</span><span>Описание</span><span>Тип</span><span className="text-right">Сумма</span>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "#475569" }}>Нет платежей за выбранный период</div>
        ) : (
          filtered.map((p, i) => (
            <div
              key={p.id}
              className="grid grid-cols-6 gap-2 px-4 py-3 items-center text-sm group hover:bg-white/3 transition-colors"
              style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--color-border)" : "none" }}
            >
              <span style={{ color: "#94a3b8" }}>{new Date(p.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              <span className="truncate" style={{ color: "#e2e8f0" }}>{clientName(p.clientId)}</span>
              <span className="truncate" style={{ color: "#64748b" }}>{p.description || "—"}</span>
              <span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: p.type === "income" ? "rgba(74,222,128,0.15)" : p.type === "expense" ? "rgba(248,113,113,0.15)" : "rgba(251,191,36,0.15)",
                    color: p.type === "income" ? "#4ade80" : p.type === "expense" ? "#f87171" : "#fbbf24",
                  }}
                >
                  {p.type === "income" ? "Доход" : p.type === "expense" ? "Расход" : "Возврат"}
                </span>
              </span>
              <div className="flex items-center justify-end gap-2">
                <span
                  className="font-semibold"
                  style={{ color: p.type === "income" ? "#4ade80" : p.type === "expense" ? "#f87171" : "#fbbf24" }}
                >
                  {p.type === "income" ? "+" : "–"}{p.amount.toLocaleString("ru-RU")} ₽
                </span>
                {!p.isPaid && p.type === "income" && (
                  <button
                    onClick={() => markPaid.mutate(p.id)}
                    title="Отметить как полученный"
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                    style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                  >
                    <CheckCircle2 size={12} /> Получено
                  </button>
                )}
                {p.isPaid && p.type === "income" && (
                  <span className="text-xs flex items-center gap-1" style={{ color: "#4ade80", opacity: 0.5 }}>
                    <CheckCircle2 size={11} /> Получено
                  </span>
                )}
                <button onClick={() => deletePayment.mutate(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={13} style={{ color: "#475569" }} className="hover:text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e2e8f0" }}>Новый платёж</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Клиент</label>
              <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                <SelectTrigger className="bg-transparent border-border"><SelectValue placeholder="Выбрать клиента" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Сумма ₽ *</label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="15000" className="bg-transparent border-border" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата</label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-transparent border-border" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Тип</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Доход</SelectItem>
                    <SelectItem value="expense">Расход</SelectItem>
                    <SelectItem value="refund">Возврат</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Описание</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Абонентка апрель" className="bg-transparent border-border" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Отмена</Button>
              <Button
                onClick={() => addPayment.mutate({ ...form, amount: Number(form.amount), clientId: Number(form.clientId) || undefined })}
                disabled={!form.amount || addPayment.isPending}
                style={{ background: "var(--color-violet)", color: "white" }}
              >
                Добавить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
