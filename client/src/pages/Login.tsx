import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, User, BarChart3 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ login: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Ошибка входа", variant: "destructive" });
        return;
      }
      login(data.token, data.user, data.permissions);
    } catch {
      toast({ title: "Ошибка соединения", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#0d0f1a" }}
    >
      <div className="w-full max-w-sm">
        {/* Логотип */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #7c6bff, #a78bfa)" }}
          >
            <BarChart3 size={28} style={{ color: "white" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e2e8f0" }}>АвитоCRM</h1>
          <p className="text-sm mt-1" style={{ color: "#475569" }}>для авитологов</p>
        </div>

        {/* Форма */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "#131520", border: "1px solid #252840" }}
        >
          <h2 className="text-base font-semibold mb-5" style={{ color: "#e2e8f0" }}>Вход в систему</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "#64748b" }}>Логин</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
                <Input
                  value={form.login}
                  onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                  placeholder="admin"
                  className="pl-9 bg-transparent border-border"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "#64748b" }}>Пароль</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="pl-9 bg-transparent border-border"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-1"
              style={{ background: "#7c6bff", color: "white" }}
            >
              {loading ? "Входим..." : "Войти"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
