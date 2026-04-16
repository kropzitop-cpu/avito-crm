// Хелперы авторизации: хранение токена, заголовки запросов

const TOKEN_KEY = "crm_session_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const SECTIONS = [
  { id: "clients",   label: "Клиенты" },
  { id: "tasks",     label: "Задачи" },
  { id: "finance",   label: "Финансы" },
  { id: "materials", label: "Наработки" },
  { id: "prompts",   label: "Промты" },
  { id: "yadisk",    label: "Яндекс Диск" },
  { id: "reminders", label: "Напоминания" },
  { id: "documents", label: "Документы" },
] as const;

export type SectionId = typeof SECTIONS[number]["id"];

export interface UserInfo {
  id: number;
  login: string;
  name: string;
  role: "admin" | "helper";
}

export interface PermissionRecord {
  id: number;
  userId: number;
  section: string;
  level: "none" | "view" | "edit";
  scopeType: string | null;
  scopeIds: string; // JSON
}

export interface AuthState {
  user: UserInfo | null;
  permissions: PermissionRecord[];
  loading: boolean;
}

// Проверить есть ли доступ к разделу
export function hasAccess(
  permissions: PermissionRecord[],
  role: "admin" | "helper" | undefined,
  section: SectionId,
  level: "view" | "edit" = "view"
): boolean {
  if (role === "admin") return true;
  const perm = permissions.find(p => p.section === section);
  if (!perm || perm.level === "none") return false;
  if (level === "view") return perm.level === "view" || perm.level === "edit";
  return perm.level === "edit";
}

// Получить scope для раздела (папки/файлы/клиенты)
export function getScope(
  permissions: PermissionRecord[],
  section: SectionId
): { type: string | null; ids: any[] } {
  const perm = permissions.find(p => p.section === section);
  if (!perm) return { type: null, ids: [] };
  try {
    return { type: perm.scopeType, ids: JSON.parse(perm.scopeIds || "[]") };
  } catch {
    return { type: perm.scopeType, ids: [] };
  }
}
