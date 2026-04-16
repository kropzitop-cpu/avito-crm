import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./storage";
import { users, sessions, invites, permissions } from "../shared/schema";
import { eq, and } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────
export function randomToken(len = 48): string {
  return crypto.randomBytes(len).toString("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function expiresIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Password ──────────────────────────────────────────────────────────────────
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}
export function checkPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

// ── Session middleware ────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) return res.status(401).json({ error: "Не авторизован" });

  const session = db.select().from(sessions).where(eq(sessions.id, token)).get();
  if (!session) return res.status(401).json({ error: "Сессия не найдена" });
  if (new Date(session.expiresAt) < new Date()) {
    db.delete(sessions).where(eq(sessions.id, token)).run();
    return res.status(401).json({ error: "Сессия истекла" });
  }

  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user || !user.isActive) return res.status(401).json({ error: "Пользователь не найден" });

  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ error: "Только для администратора" });
    }
    next();
  });
}

// ── Get user permissions ──────────────────────────────────────────────────────
export function getUserPermissions(userId: number) {
  return db.select().from(permissions).where(eq(permissions.userId, userId)).all();
}

export function canAccess(userId: number, section: string, level: "view" | "edit" = "view"): boolean {
  const perm = db.select().from(permissions)
    .where(and(eq(permissions.userId, userId), eq(permissions.section, section)))
    .get();
  if (!perm || perm.level === "none") return false;
  if (level === "view") return perm.level === "view" || perm.level === "edit";
  return perm.level === "edit";
}

// ── Auth routes ───────────────────────────────────────────────────────────────
export function registerAuthRoutes(app: any) {

  // POST /api/auth/login
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: "Введите логин и пароль" });

    const user = db.select().from(users).where(eq(users.login, login)).get();
    if (!user || !checkPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }
    if (!user.isActive) return res.status(403).json({ error: "Аккаунт заблокирован" });

    const token = randomToken();
    db.insert(sessions).values({
      id: token,
      userId: user.id,
      expiresAt: expiresIso(30),
      createdAt: nowIso(),
    }).run();

    const perms = getUserPermissions(user.id);
    res.json({ token, user: { id: user.id, login: user.login, name: user.name, role: user.role }, permissions: perms });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", requireAuth, (req: Request, res: Response) => {
    const token = req.headers["x-session-token"] as string;
    db.delete(sessions).where(eq(sessions.id, token)).run();
    res.json({ ok: true });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    const perms = getUserPermissions(user.id);
    res.json({ user: { id: user.id, login: user.login, name: user.name, role: user.role }, permissions: perms });
  });

  // ── Invite: создать (только админ) ────────────────────────────────────────
  // POST /api/team/invite
  app.post("/api/team/invite", requireAdmin, (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Укажите имя помощника" });
    const token = randomToken(32);
    db.insert(invites).values({
      token,
      name,
      expiresAt: expiresIso(7),
      createdAt: nowIso(),
    }).run();
    res.json({ token, inviteUrl: `/invite/${token}` });
  });

  // GET /api/team/invites — список приглашений
  app.get("/api/team/invites", requireAdmin, (_req: Request, res: Response) => {
    const all = db.select().from(invites).all();
    res.json(all);
  });

  // DELETE /api/team/invite/:token
  app.delete("/api/team/invite/:token", requireAdmin, (req: Request, res: Response) => {
    db.delete(invites).where(eq(invites.token, req.params.token)).run();
    res.json({ ok: true });
  });

  // ── Accept invite (помощник принимает приглашение) ────────────────────────
  // GET /api/invite/:token — проверить токен
  app.get("/api/invite/:token", (req: Request, res: Response) => {
    const invite = db.select().from(invites).where(eq(invites.token, req.params.token)).get();
    if (!invite) return res.status(404).json({ error: "Приглашение не найдено" });
    if (invite.usedAt) return res.status(410).json({ error: "Приглашение уже использовано" });
    if (new Date(invite.expiresAt) < new Date()) return res.status(410).json({ error: "Приглашение истекло" });
    res.json({ name: invite.name, token: invite.token });
  });

  // POST /api/invite/:token/accept
  app.post("/api/invite/:token/accept", (req: Request, res: Response) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: "Укажите логин и пароль" });

    const invite = db.select().from(invites).where(eq(invites.token, req.params.token)).get();
    if (!invite) return res.status(404).json({ error: "Приглашение не найдено" });
    if (invite.usedAt) return res.status(410).json({ error: "Уже использовано" });
    if (new Date(invite.expiresAt) < new Date()) return res.status(410).json({ error: "Истекло" });

    // Проверяем уникальность логина
    const existing = db.select().from(users).where(eq(users.login, login)).get();
    if (existing) return res.status(409).json({ error: "Логин уже занят" });

    // Создаём пользователя
    const result = db.insert(users).values({
      login,
      passwordHash: hashPassword(password),
      name: invite.name,
      role: "helper",
      isActive: true,
      createdAt: nowIso(),
    }).run();
    const userId = Number(result.lastInsertRowid);

    // Помечаем приглашение использованным
    db.update(invites).set({ usedAt: nowIso(), userId }).where(eq(invites.token, req.params.token)).run();

    // Создаём сессию
    const sessionToken = randomToken();
    db.insert(sessions).values({
      id: sessionToken,
      userId,
      expiresAt: expiresIso(30),
      createdAt: nowIso(),
    }).run();

    const perms = getUserPermissions(userId);
    res.json({ token: sessionToken, user: { id: userId, login, name: invite.name, role: "helper" }, permissions: perms });
  });

  // ── Team management ───────────────────────────────────────────────────────
  // GET /api/team/members
  app.get("/api/team/members", requireAdmin, (_req: Request, res: Response) => {
    const members = db.select().from(users).all().filter(u => u.role === "helper");
    const permsAll = db.select().from(permissions).all();
    res.json(members.map(m => ({
      ...m,
      passwordHash: undefined,
      permissions: permsAll.filter(p => p.userId === m.id),
    })));
  });

  // PATCH /api/team/members/:id — изменить активность
  app.patch("/api/team/members/:id", requireAdmin, (req: Request, res: Response) => {
    const { isActive, name } = req.body;
    const updates: any = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (name) updates.name = name;
    db.update(users).set(updates).where(eq(users.id, Number(req.params.id))).run();
    res.json({ ok: true });
  });

  // DELETE /api/team/members/:id
  app.delete("/api/team/members/:id", requireAdmin, (req: Request, res: Response) => {
    db.delete(users).where(eq(users.id, Number(req.params.id))).run();
    res.json({ ok: true });
  });

  // ── Permissions ───────────────────────────────────────────────────────────
  // GET /api/team/members/:id/permissions
  app.get("/api/team/members/:id/permissions", requireAdmin, (req: Request, res: Response) => {
    const perms = db.select().from(permissions).where(eq(permissions.userId, Number(req.params.id))).all();
    res.json(perms);
  });

  // PUT /api/team/members/:id/permissions — полная перезапись прав
  app.put("/api/team/members/:id/permissions", requireAdmin, (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    const { permissions: permsData } = req.body as { permissions: Array<{
      section: string; level: string; scopeType?: string; scopeIds?: string;
    }> };

    // Удаляем старые
    db.delete(permissions).where(eq(permissions.userId, userId)).run();

    // Вставляем новые
    for (const p of permsData) {
      db.insert(permissions).values({
        userId,
        section: p.section,
        level: p.level,
        scopeType: p.scopeType ?? null,
        scopeIds: p.scopeIds ?? "[]",
      }).run();
    }

    res.json({ ok: true });
  });
}

// ── Создать первого админа если нет ──────────────────────────────────────────
export function ensureAdminExists() {
  const existing = db.select().from(users).where(eq(users.role, "admin")).get();
  if (!existing) {
    db.insert(users).values({
      login: "admin",
      passwordHash: hashPassword("admin123"),
      name: "Администратор",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
    }).run();
    console.log("✅ Создан администратор: login=admin, password=admin123 (смените пароль!)");
  }
}
