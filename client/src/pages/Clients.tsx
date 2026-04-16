import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Phone, MapPin, DollarSign, Users } from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Client, InsertClient } from "@shared/schema";

const STATUS_OPTS = [
  { value: "active", label: "Активный" },
  { value: "paused", label: "На паузе" },
  { value: "finished", label: "Завершён" },
];

const AVATAR_COLORS = ["#7c6bff", "#22d3ee", "#fb923c", "#4ade80", "#f472b6", "#fbbf24", "#a78bfa", "#38bdf8"];

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: "rgba(74,222,128,0.15)", color: "#4ade80", label: "Активный" },
  paused:   { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24", label: "Пауза" },
  finished: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", label: "Завершён" },
};

function ClientForm({ onClose, existing }: { onClose: () => void; existing?: Client }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertClient>>({
    name: existing?.name ?? "",
    phone: existing?.phone ?? "",
    telegram: existing?.telegram ?? "",
    email: existing?.email ?? "",
    niche: existing?.niche ?? "",
    city: existing?.city ?? "",
    status: existing?.status ?? "active",
    monthlyFee: existing?.monthlyFee ?? undefined,
    startDate: existing?.startDate ?? new Date().toISOString().split("T")[0],
    notes: existing?.notes ?? "",
    avatarColor: existing?.avatarColor ?? "#7c6bff",
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<InsertClient>) =>
      existing
        ? apiRequest("PATCH", `/api/clients/${existing.id}`, data)
        : apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: existing ? "Клиент обновлён" : "Клиент добавлен" });
      onClose();
    },
  });

  const set = (k: keyof InsertClient, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar color picker */}
      <div>
        <label className="text-xs font-medium mb-2 block" style={{ color: "#94a3b8" }}>Цвет аватара</label>
        <div className="flex gap-2">
          {AVATAR_COLORS.map(c => (
            <button
              key={c}
              onClick={() => set("avatarColor", c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: form.avatarColor === c ? "white" : "transparent",
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Имя / Компания *</label>
          <Input
            value={form.name ?? ""}
            onChange={e => set("name", e.target.value)}
            placeholder="ООО Чистота"
            data-testid="input-client-name"
            className="bg-transparent border-border"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Телефон</label>
          <Input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} placeholder="+7 999 123-45-67" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Telegram</label>
          <Input value={form.telegram ?? ""} onChange={e => set("telegram", e.target.value)} placeholder="@username" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Email</label>
          <Input value={form.email ?? ""} onChange={e => set("email", e.target.value)} placeholder="client@mail.ru" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Ниша</label>
          <Input
            value={form.niche ?? ""}
            onChange={e => set("niche", e.target.value)}
            placeholder="Клининг, авто, ремонт..."
            className="bg-transparent border-border"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Город</label>
          <Input value={form.city ?? ""} onChange={e => set("city", e.target.value)} placeholder="Москва" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Статус</label>
          <Select value={form.status ?? "active"} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Абонентка, ₽/мес</label>
          <Input
            type="number"
            value={form.monthlyFee ?? ""}
            onChange={e => set("monthlyFee", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="15000"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата начала</label>
          <Input type="date" value={form.startDate ?? ""} onChange={e => set("startDate", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Заметки</label>
        <Textarea
          value={form.notes ?? ""}
          onChange={e => set("notes", e.target.value)}
          placeholder="Общие заметки о клиенте..."
          rows={3}
          className="bg-transparent border-border resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Отмена</Button>
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.name}
          data-testid="button-save-client"
          style={{ background: "var(--color-violet)", color: "white" }}
        >
          {mutation.isPending ? "Сохраняем..." : existing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </div>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const { data: clients = [], isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-0.5" style={{ color: "#e2e8f0" }}>Клиенты</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>{clients.length} клиентов в базе</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          data-testid="button-add-client"
          style={{ background: "var(--color-violet)", color: "white" }}
          className="gap-2"
        >
          <Plus size={16} /> Добавить клиента
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, городу..."
            className="pl-9 bg-transparent border-border"
            data-testid="input-search-clients"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-transparent border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Users size={40} className="mx-auto mb-3" style={{ color: "#334155" }} />
          <p className="text-sm" style={{ color: "#475569" }}>
            {search ? "Клиенты не найдены" : "Добавьте первого клиента"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const st = statusColors[c.status] || statusColors.active;
            return (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <div className="client-card p-5" data-testid={`card-client-${c.id}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                      style={{ background: c.avatarColor || "#7c6bff", color: "white" }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: "#e2e8f0" }}>{c.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                        {c.niche || "Ниша не указана"}
                      </div>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full shrink-0 font-medium"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {c.city && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#64748b" }}>
                        <MapPin size={12} /> {c.city}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#64748b" }}>
                        <Phone size={12} /> {c.phone}
                      </div>
                    )}
                    {c.monthlyFee && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#22d3ee" }}>
                        <DollarSign size={12} /> {c.monthlyFee.toLocaleString("ru-RU")} ₽/мес
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e2e8f0" }}>Новый клиент</DialogTitle>
          </DialogHeader>
          <ClientForm onClose={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
