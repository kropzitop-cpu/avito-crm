import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, BarChart3, CheckCircle2, XCircle } from "lucide-react";

export default function AcceptInvite() {
  const { login } = useAuth();
  const { toast } = useToast();

  // Получаем токен из hash роутинга: /#/invite/TOKEN
  const token = window.location.hash.replace("#/invite/", "").split("?")[0];

  const [inviteInfo, setInviteInfo] = useState<{ name: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [form, setForm] = useState({ login: "", password: "", password2: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setInviteError("Токен не найден"); return; }
    fetch(`${API_BASE}/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setInviteError(data.error);
        else setInviteInfo({ name: data.name });
      })
      .catch(() => setInviteError("Ошибка соединения"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password2) {
      toast({ title: "Пароли не совпадают", variant: "destructive" }); return;
    }
    if (form.password.length < 6) {
      toast({ title: "Пароль минимум 6 символов", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: form.login, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error, variant: "destructive" }); return; }
      login(data.token, data.user, data.permissions);
      window.location.hash = "#/";
    } catch {
      toast({ title: "Ошибка соединения", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-bg-deep)" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #7c6bff, #a78bfa)" }}
          >
            <BarChart3 size={28} style={{ color: "white" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e2e8f0" }}>ВоблаCRM</h1>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          {inviteError ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle size={40} style={{ color: "#f87171" }} />
              <p className="text-sm text-center" style={{ color: "#f87171" }}>{inviteError}</p>
            </div>
          ) : !inviteInfo ? (
            <div className="text-center py-6 text-sm" style={{ color: "#475569" }}>Проверяем приглашение...</div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: "rgba(124,107,255,0.1)", border: "1px solid rgba(124,107,255,0.2)" }}>
                <CheckCircle2 size={18} style={{ color: "#a78bfa" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "#e2e8f0" }}>Приглашение для: {inviteInfo.name}</div>
                  <div className="text-xs" style={{ color: "#64748b" }}>Создайте логин и пароль для входа</div>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "#64748b" }}>Придумайте логин</label>
                  <Input
                    value={form.login}
                    onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                    placeholder="helper1"
                    className="bg-transparent border-border"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "#64748b" }}>Пароль</label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="bg-transparent border-border" required />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "#64748b" }}>Повторите пароль</label>
                  <Input type="password" value={form.password2} onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} placeholder="••••••••" className="bg-transparent border-border" required />
                </div>
                <Button type="submit" disabled={loading} className="w-full mt-1" style={{ background: "var(--color-violet)", color: "white" }}>
                  <UserPlus size={15} className="mr-2" />
                  {loading ? "Создаём аккаунт..." : "Войти в систему"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
