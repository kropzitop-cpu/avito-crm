import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Copy,
  Trash2,
  Settings2,
  ShieldOff,
  ShieldCheck,
  Link2,
  CheckCheck,
} from "lucide-react";
import { queryClient, API_BASE } from "@/lib/queryClient";
import { getToken, SECTIONS } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: number;
  login: string;
  name: string;
  role: "admin" | "helper";
  isBlocked: boolean;
}

interface Invite {
  token: string;
  name: string;
  expiresAt: string;
  usedAt: string | null;
}

interface SectionPermission {
  section: string;
  level: "none" | "view" | "edit";
  scopeType: string | null;
  scopeIds: string; // JSON array
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "x-session-token": token } : {};
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

function inviteLink(token: string) {
  return `${window.location.origin}/#/invite/${token}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Permissions dialog ───────────────────────────────────────────────────────

interface PermissionsDialogProps {
  member: Member | null;
  onClose: () => void;
}

function PermissionsDialog({ member, onClose }: PermissionsDialogProps) {
  const { toast } = useToast();

  // Local state: map sectionId → {level, scopeType, scopeIds (raw string)}
  const [perms, setPerms] = useState<
    Record<string, { level: "none" | "view" | "edit"; scopeType: string; scopeIds: string }>
  >({});
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery<SectionPermission[]>({
    queryKey: [`/api/team/members/${member?.id}/permissions`],
    enabled: !!member,
    queryFn: async () => {
      const res = await apiFetch(`/api/team/members/${member!.id}/permissions`);
      const data: SectionPermission[] = await res.json();
      const map: Record<string, { level: "none" | "view" | "edit"; scopeType: string; scopeIds: string }> = {};
      for (const s of SECTIONS) {
        const p = data.find((x) => x.section === s.id);
        map[s.id] = {
          level: p?.level ?? "none",
          scopeType: p?.scopeType ?? "",
          scopeIds: (() => {
            try {
              return JSON.parse(p?.scopeIds || "[]").join(", ");
            } catch {
              return "";
            }
          })(),
        };
      }
      setPerms(map);
      setLoaded(true);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions = SECTIONS.map((s) => {
        const p = perms[s.id] ?? { level: "none", scopeType: "", scopeIds: "" };
        const rawIds = p.scopeIds
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        return {
          section: s.id,
          level: p.level,
          scopeType: p.level !== "none" && p.scopeType ? p.scopeType : null,
          scopeIds: JSON.stringify(rawIds),
        };
      });
      await apiFetch(`/api/team/members/${member!.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/team/members/${member?.id}/permissions`] });
      toast({ title: "Права сохранены" });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  function updatePerm(
    sectionId: string,
    field: "level" | "scopeType" | "scopeIds",
    value: string
  ) {
    setPerms((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] ?? { level: "none", scopeType: "", scopeIds: "" }),
        [field]: value,
      },
    }));
  }

  const hasScopeSelect = (sectionId: string) => {
    const lvl = perms[sectionId]?.level;
    return lvl && lvl !== "none" && ["clients", "materials", "prompts"].includes(sectionId);
  };

  const scopeOptions = (sectionId: string): { value: string; label: string }[] => {
    if (sectionId === "clients") {
      return [
        { value: "all", label: "Все клиенты" },
        { value: "clients_list", label: "Конкретные клиенты" },
      ];
    }
    return [
      { value: "all", label: "Всё" },
      { value: "folders", label: "Только папки" },
      { value: "files", label: "Конкретные файлы" },
    ];
  };

  const needsIdsField = (sectionId: string) => {
    const st = perms[sectionId]?.scopeType;
    return ["clients_list", "folders", "files"].includes(st ?? "");
  };

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#e2e8f0" }}>
            Права доступа —{" "}
            <span style={{ color: "#a78bfa" }}>{member?.name}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" style={{ maxHeight: "calc(85vh - 130px)" }}>
          {isLoading || !loaded ? (
            <div className="text-sm py-8 text-center" style={{ color: "#64748b" }}>
              Загрузка прав…
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              {SECTIONS.map((s) => {
                const p = perms[s.id] ?? { level: "none", scopeType: "", scopeIds: "" };
                return (
                  <div
                    key={s.id}
                    className="rounded-xl p-4"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <span className="text-sm font-medium" style={{ color: "#e2e8f0" }}>
                        {s.label}
                      </span>
                      <Select
                        value={p.level}
                        onValueChange={(v) => updatePerm(s.id, "level", v)}
                      >
                        <SelectTrigger
                          className="w-44 bg-transparent border-border text-sm"
                          style={{ height: 32 }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Нет доступа</SelectItem>
                          <SelectItem value="view">Просмотр</SelectItem>
                          <SelectItem value="edit">Редактирование</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {hasScopeSelect(s.id) && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "#64748b", minWidth: 80 }}>
                            Область:
                          </span>
                          <Select
                            value={p.scopeType || "all"}
                            onValueChange={(v) => updatePerm(s.id, "scopeType", v)}
                          >
                            <SelectTrigger
                              className="flex-1 bg-transparent border-border text-xs"
                              style={{ height: 30 }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {scopeOptions(s.id).map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {needsIdsField(s.id) && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs" style={{ color: "#64748b", minWidth: 80 }}>
                              Значения:
                            </span>
                            <Input
                              value={p.scopeIds}
                              onChange={(e) => updatePerm(s.id, "scopeIds", e.target.value)}
                              placeholder="через запятую"
                              className="flex-1 bg-transparent border-border text-xs"
                              style={{ height: 30 }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !loaded}
            style={{ background: "#7c6bff", color: "white" }}
          >
            {saveMutation.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Team() {
  const { toast } = useToast();
  useAuth(); // ensure context is present

  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Permissions dialog
  const [permsMember, setPermsMember] = useState<Member | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: members = [],
    isLoading: membersLoading,
  } = useQuery<Member[]>({
    queryKey: ["/api/team/members"],
    queryFn: async () => {
      const res = await apiFetch("/api/team/members");
      return res.json();
    },
  });

  const {
    data: invites = [],
    isLoading: invitesLoading,
  } = useQuery<Invite[]>({
    queryKey: ["/api/team/invites"],
    queryFn: async () => {
      const res = await apiFetch("/api/team/invites");
      return res.json();
    },
  });

  const activeInvites = invites.filter((i) => i.usedAt === null);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createInvite = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/invites"] });
      setCreatedToken(data.token);
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка создания ссылки", description: e.message, variant: "destructive" });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: async (token: string) => {
      await apiFetch(`/api/team/invite/${token}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/invites"] });
      toast({ title: "Приглашение удалено" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ id, isBlocked }: { id: number; isBlocked: boolean }) => {
      await apiFetch(`/api/team/members/${id}/${isBlocked ? "unblock" : "block"}`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      toast({ title: "Статус изменён" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/team/members/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      toast({ title: "Помощник удалён" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openInviteDialog() {
    setInviteName("");
    setCreatedToken(null);
    setCopied(false);
    setShowInviteDialog(true);
  }

  function closeInviteDialog() {
    setShowInviteDialog(false);
    setCreatedToken(null);
    setInviteName("");
    setCopied(false);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Ссылка скопирована" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  }

  async function copyInviteFromList(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(124,107,255,0.15)" }}
          >
            <Users size={18} style={{ color: "#a78bfa" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e2e8f0" }}>
            Команда
          </h1>
        </div>
        <Button
          onClick={openInviteDialog}
          className="gap-2"
          style={{ background: "#7c6bff", color: "white" }}
        >
          <Plus size={15} /> Пригласить помощника
        </Button>
      </div>

      {/* Members section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "#475569" }}>
          Помощники
        </h2>

        {membersLoading ? (
          <div className="text-sm" style={{ color: "#475569" }}>
            Загрузка…
          </div>
        ) : members.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#475569" }}
          >
            Пока нет помощников. Пригласите первого по ссылке.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl p-4 flex items-center justify-between gap-4"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                {/* Avatar + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: "rgba(124,107,255,0.2)", color: "#a78bfa" }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: "#e2e8f0" }}>
                      {m.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: "#64748b" }}>
                      @{m.login}
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full"
                    style={{
                      background: m.isBlocked
                        ? "rgba(248,113,113,0.15)"
                        : "rgba(74,222,128,0.15)",
                      color: m.isBlocked ? "#f87171" : "#4ade80",
                    }}
                  >
                    {m.isBlocked ? "Заблокирован" : "Активен"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    style={{ color: "#a78bfa" }}
                    onClick={() => setPermsMember(m)}
                  >
                    <Settings2 size={13} /> Права
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    style={{ color: m.isBlocked ? "#4ade80" : "#fbbf24" }}
                    onClick={() => toggleBlock.mutate({ id: m.id, isBlocked: m.isBlocked })}
                    disabled={toggleBlock.isPending}
                  >
                    {m.isBlocked ? (
                      <><ShieldCheck size={13} /> Разблокировать</>
                    ) : (
                      <><ShieldOff size={13} /> Заблокировать</>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    style={{ color: "#475569" }}
                    onClick={() => {
                      if (confirm(`Удалить помощника "${m.name}"?`)) {
                        deleteMember.mutate(m.id);
                      }
                    }}
                    disabled={deleteMember.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invites section */}
      <section>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "#475569" }}>
          Активные приглашения
        </h2>

        {invitesLoading ? (
          <div className="text-sm" style={{ color: "#475569" }}>
            Загрузка…
          </div>
        ) : activeInvites.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#475569" }}
          >
            Нет активных приглашений
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeInvites.map((inv) => (
              <div
                key={inv.token}
                className="rounded-2xl p-4 flex items-center justify-between gap-4"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(34,211,238,0.12)" }}
                  >
                    <Link2 size={14} style={{ color: "#22d3ee" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: "#e2e8f0" }}>
                      {inv.name}
                    </div>
                    <div className="text-xs" style={{ color: "#64748b" }}>
                      Истекает: {formatDate(inv.expiresAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    style={{ color: "#22d3ee" }}
                    onClick={() => copyInviteFromList(inv.token)}
                  >
                    <Copy size={13} /> Копировать
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    style={{ color: "#475569" }}
                    onClick={() => {
                      if (confirm("Удалить приглашение?")) {
                        deleteInvite.mutate(inv.token);
                      }
                    }}
                    disabled={deleteInvite.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Invite creation dialog ─────────────────────────────────────────── */}
      <Dialog open={showInviteDialog} onOpenChange={(v) => !v && closeInviteDialog()}>
        <DialogContent
          className="max-w-md"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#e2e8f0" }}>Пригласить помощника</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "#94a3b8" }}>
                Имя помощника
              </label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Например: Алексей"
                className="bg-transparent border-border"
                disabled={!!createdToken}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inviteName.trim() && !createdToken) {
                    createInvite.mutate(inviteName.trim());
                  }
                }}
              />
            </div>

            {!createdToken && (
              <Button
                onClick={() => createInvite.mutate(inviteName.trim())}
                disabled={!inviteName.trim() || createInvite.isPending}
                style={{ background: "#7c6bff", color: "white" }}
              >
                {createInvite.isPending ? "Создание…" : "Создать ссылку"}
              </Button>
            )}

            {createdToken && (
              <div className="flex flex-col gap-3">
                <div
                  className="rounded-xl p-3"
                  style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                >
                  <div className="text-xs mb-1.5 font-medium" style={{ color: "#64748b" }}>
                    Ссылка-приглашение
                  </div>
                  <div
                    className="text-xs break-all font-mono"
                    style={{ color: "#22d3ee" }}
                  >
                    {inviteLink(createdToken)}
                  </div>
                </div>

                <Button
                  className="gap-2"
                  style={{ background: copied ? "rgba(74,222,128,0.2)" : "rgba(34,211,238,0.15)", color: copied ? "#4ade80" : "#22d3ee", border: "none" }}
                  onClick={() => copyToClipboard(inviteLink(createdToken))}
                >
                  {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                  {copied ? "Скопировано!" : "Копировать ссылку"}
                </Button>

                <div className="flex justify-end">
                  <Button variant="ghost" onClick={closeInviteDialog}>
                    Закрыть
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Permissions dialog ─────────────────────────────────────────────── */}
      <PermissionsDialog
        member={permsMember}
        onClose={() => setPermsMember(null)}
      />
    </div>
  );
}
