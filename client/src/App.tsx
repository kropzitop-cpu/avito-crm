import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import AppSidebar from "@/components/AppSidebar";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Finance from "@/pages/Finance";
import Reminders from "@/pages/Reminders";
import Calendar from "@/pages/Calendar";
import YaDisk from "@/pages/YaDisk";
import Prompts from "@/pages/Prompts";
import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import Team from "@/pages/Team";
import Notes from "@/pages/Notes";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { hasAccess } from "@/lib/auth";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--color-bg-deep)" }}>
      <AppSidebar />
      {/* pt-[52px] pb-[60px] — mobile top header + bottom tabbar; md: no extra padding */}
      <main className="flex-1 overflow-auto pt-[52px] pb-[60px] md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, permissions, loading } = useAuth();
  const [location] = useHashLocation();

  // Страница принятия приглашения — доступна всегда
  if (location.startsWith("/invite/")) {
    return <AcceptInvite />;
  }

  // Пока грузится — пустой экран
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-deep)" }}>
        <div className="text-sm" style={{ color: "#475569" }}>Загрузка...</div>
      </div>
    );
  }

  // Не авторизован — страница входа
  if (!user) {
    return <Login />;
  }

  // Авторизован — основное приложение
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/finance">
          {hasAccess(permissions, user.role, "finance") || user.role === "admin"
            ? <Finance />
            : <AccessDenied section="Финансы" />}
        </Route>
        <Route path="/reminders" component={Reminders} />
        <Route path="/notes" component={Notes} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/yadisk">
          {hasAccess(permissions, user.role, "yadisk") || user.role === "admin"
            ? <YaDisk />
            : <AccessDenied section="Яндекс Диск" />}
        </Route>
        <Route path="/prompts">
          {hasAccess(permissions, user.role, "prompts") || user.role === "admin"
            ? <Prompts />
            : <AccessDenied section="Промты" />}
        </Route>
        <Route path="/team">
          {user.role === "admin" ? <Team /> : <AccessDenied section="Команда" />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AccessDenied({ section }: { section: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-3">
      <div className="text-4xl">🔒</div>
      <div className="text-lg font-semibold" style={{ color: "#e2e8f0" }}>Нет доступа</div>
      <div className="text-sm" style={{ color: "#475569" }}>Раздел «{section}» недоступен. Обратитесь к администратору.</div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useHashLocation}>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
