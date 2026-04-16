import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import multer from "multer";
import mammoth from "mammoth";
import path from "path";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".docx") cb(null, true);
    else cb(new Error("Только .docx файлы"));
  },
});

// Multer for document uploads (any file type)
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
import {
  insertClientSchema, insertPaymentSchema, insertMaterialSchema,
  insertReminderSchema, insertReportSchema, insertDocumentSchema,
  insertPaymentScheduleSchema, insertPromptSchema, insertPromptModelSchema, insertPromptModelStepSchema,
} from "@shared/schema";
import https from "https";
import http from "http";

// Helper: Yandex Disk API call
// Хелпер: парсить JSON-строку без ошибки
function tryParseJson(val: any) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

async function yadiskRequest(token: string, method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://cloud-api.yandex.net/v1/disk${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `OAuth ${token}`,
        "Content-Type": "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        // Пробрасываем ошибки Яндекс Диска как исключения
        const status = res.statusCode || 0;
        if (status >= 400) {
          const msg = parsed?.message || parsed?.description || parsed?.error || `HTTP ${status}`;
          const err: any = new Error(msg);
          err.statusCode = status;
          err.yadiskError = parsed;
          return reject(err);
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

export function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", (_req, res) => {
    res.json(storage.getDashboardStats());
  });

  // ── Clients ────────────────────────────────────────────────────────────────
  app.get("/api/clients", (_req, res) => res.json(storage.getClients()));

  app.get("/api/clients/:id", (req, res) => {
    const client = storage.getClient(Number(req.params.id));
    if (!client) return res.status(404).json({ error: "Клиент не найден" });
    res.json(client);
  });

  app.post("/api/clients", (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const client = storage.createClient(parsed.data);

    // Auto-create payment reminder if nextPaymentDate is set
    if (parsed.data.nextPaymentDate) {
      try {
        storage.createReminder({
          clientId: client.id,
          title: `Оплата — ${client.name}`,
          description: `Ближайший платёж от ${client.name}`,
          dueDate: parsed.data.nextPaymentDate,
          type: "payment",
          priority: "high",
          isDone: false,
          recurrence: "monthly",
          recurrenceEnd: null,
          parentId: null,
        });
      } catch (_) {}
    }
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", (req, res) => {
    const id = Number(req.params.id);
    const updated = storage.updateClient(id, req.body);
    if (!updated) return res.status(404).json({ error: "Клиент не найден" });

    // If nextPaymentDate changed, create/update reminder
    if (req.body.nextPaymentDate) {
      try {
        storage.createReminder({
          clientId: id,
          title: `Оплата — ${updated.name}`,
          description: `Ближайший платёж от ${updated.name}`,
          dueDate: req.body.nextPaymentDate,
          type: "payment",
          priority: "high",
          isDone: false,
          recurrence: "monthly",
          recurrenceEnd: null,
          parentId: null,
        });
      } catch (_) {}
    }
    res.json(updated);
  });

  app.delete("/api/clients/:id", (req, res) => {
    storage.deleteClient(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Payment Schedules ──────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/schedules", (req, res) => {
    res.json(storage.getPaymentSchedules(Number(req.params.clientId)));
  });

  app.post("/api/payment-schedules", (req, res) => {
    const now = new Date().toISOString();
    const parsed = insertPaymentScheduleSchema.safeParse({ ...req.body, createdAt: now });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(storage.createPaymentSchedule(parsed.data));
  });

  app.delete("/api/payment-schedules/:id", (req, res) => {
    storage.deactivateSchedule(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Payments ───────────────────────────────────────────────────────────────
  app.get("/api/payments", (req, res) => {
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    res.json(storage.getPayments(clientId));
  });

  app.post("/api/payments", (req, res) => {
    const parsed = insertPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(storage.createPayment(parsed.data));
  });

  app.patch("/api/payments/:id", (req, res) => {
    const updated = storage.updatePayment(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Платёж не найден" });
    res.json(updated);
  });

  // Mark payment as paid — clears isPlanned, sets isPaid, marks reminder done
  app.patch("/api/payments/:id/pay", (req, res) => {
    const id = Number(req.params.id);
    const payment = storage.getPayments().find(p => p.id === id);
    if (!payment) return res.status(404).json({ error: "Платёж не найден" });
    const updated = storage.updatePayment(id, { isPaid: true, isPlanned: false });
    // Mark linked reminder as done
    if (payment.reminderId) {
      try { storage.updateReminder(payment.reminderId, { isDone: true }); } catch (_) {}
    }
    res.json(updated);
  });

  // Reschedule payment — new date, swap reminder
  app.patch("/api/payments/:id/reschedule", (req, res) => {
    const id = Number(req.params.id);
    const { newDate } = req.body;
    if (!newDate) return res.status(400).json({ error: "newDate обязателен" });

    const payment = storage.getPayments().find(p => p.id === id);
    if (!payment) return res.status(404).json({ error: "Платёж не найден" });

    // Store original date if not already rescheduled
    const rescheduledFrom = payment.rescheduledFrom || payment.date;

    // Delete old reminder
    if (payment.reminderId) {
      try { storage.deleteReminder(payment.reminderId); } catch (_) {}
    }

    // Create new reminder
    let newReminderId: number | null = null;
    try {
      const client = storage.getClient(payment.clientId);
      const rem = storage.createReminder({
        clientId: payment.clientId,
        title: `Оплата ${payment.amount.toLocaleString("ru-RU")} ₽${client ? ` — ${client.name}` : ""}`,
        description: payment.description || "Перенесённый платёж",
        dueDate: newDate,
        type: "payment",
        priority: "high",
        isDone: false,
        recurrence: "none",
        recurrenceEnd: null,
        parentId: null,
      });
      newReminderId = rem.id;
    } catch (_) {}

    const updated = storage.updatePayment(id, {
      date: newDate,
      rescheduledFrom,
      reminderId: newReminderId ?? undefined,
    });
    res.json(updated);
  });

  app.delete("/api/payments/:id", (req, res) => {
    storage.deletePayment(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Materials ──────────────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/materials", (req, res) => {
    const category = req.query.category as string | undefined;
    res.json(storage.getMaterials(Number(req.params.clientId), category));
  });

  app.post("/api/materials", (req, res) => {
    const now = new Date().toISOString();
    // Allow large base64 payloads for file uploads
    const parsed = insertMaterialSchema.safeParse({ ...req.body, createdAt: now, updatedAt: now });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(storage.createMaterial(parsed.data));
  });

  // Get all unique folder names for a client
  app.get("/api/clients/:clientId/folders", (req, res) => {
    const mats = storage.getMaterials(Number(req.params.clientId));
    const folders = Array.from(new Set(mats.map(m => (m as any).folderName).filter(Boolean))) as string[];
    res.json(folders);
  });

  app.patch("/api/materials/:id", (req, res) => {
    const updated = storage.updateMaterial(Number(req.params.id), { ...req.body, updatedAt: new Date().toISOString() });
    if (!updated) return res.status(404).json({ error: "Материал не найден" });
    res.json(updated);
  });

  app.delete("/api/materials/:id", (req, res) => {
    storage.deleteMaterial(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Documents ──────────────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/documents", (req, res) => {
    res.json(storage.getDocuments(Number(req.params.clientId)));
  });

  // Upload document file → save to /data/uploads/ and return URL
  app.post("/api/documents/upload", uploadDoc.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
    const fs = await import("fs");
    const uploadsDir = process.env.RAILWAY_ENVIRONMENT ? "/data/uploads" : "./uploads";
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = Date.now() + "_" + req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${uploadsDir}/${safeName}`;
    fs.writeFileSync(filePath, req.file.buffer);
    const fileUrl = `/uploads/${safeName}`;
    res.json({ fileUrl, originalName: req.file.originalname, size: req.file.size });
  });

  app.post("/api/documents", (req, res) => {
    const now = new Date().toISOString();
    const parsed = insertDocumentSchema.safeParse({ ...req.body, createdAt: now });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(storage.createDocument(parsed.data));
  });

  app.patch("/api/documents/:id", (req, res) => {
    const updated = storage.updateDocument(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Документ не найден" });
    res.json(updated);
  });

  app.delete("/api/documents/:id", (req, res) => {
    storage.deleteDocument(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Reminders ──────────────────────────────────────────────────────────────
  app.get("/api/reminders", (req, res) => {
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const done = req.query.done !== undefined ? req.query.done === "true" : undefined;
    res.json(storage.getReminders(clientId, done));
  });

  app.get("/api/reminders/all", (_req, res) => {
    res.json(storage.getAllReminders());
  });

  app.post("/api/reminders", (req, res) => {
    const parsed = insertReminderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(storage.createReminder(parsed.data));
  });

  app.patch("/api/reminders/:id", (req, res) => {
    const updated = storage.updateReminder(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Напоминание не найдено" });
    res.json(updated);
  });

  app.delete("/api/reminders/:id", (req, res) => {
    storage.deleteReminder(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Reports ────────────────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/reports", (req, res) => {
    res.json(storage.getReports(Number(req.params.clientId)));
  });

  app.post("/api/reports", (req, res) => {
    const now = new Date().toISOString();
    const parsed = insertReportSchema.safeParse({ ...req.body, createdAt: now });
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(storage.createReport(parsed.data));
  });

  app.patch("/api/reports/:id", (req, res) => {
    const updated = storage.updateReport(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Отчёт не найден" });
    res.json(updated);
  });

  app.delete("/api/reports/:id", (req, res) => {
    storage.deleteReport(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  app.get("/api/settings/:key", (req, res) => {
    const value = storage.getSetting(req.params.key);
    res.json({ key: req.params.key, value });
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: "key required" });
    storage.setSetting(key, value);
    res.json({ ok: true });
  });

  // ── Prompts ───────────────────────────────────────────────────────────────

  // POST /api/prompts/parse-docx — распознать текст из .docx файла
  app.post("/api/prompts/parse-docx", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Файл не передан" });

      // Извлекаем чистый текст через mammoth
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const fullText = result.value.trim();

      // Заголовок: первая непустая строка документа, или имя файла без расширения
      const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
      const suggestedTitle = lines.length > 0
        ? lines[0].slice(0, 120)  // первая строка — предлагаемая название
        : path.basename(req.file.originalname, ".docx");

      // Тело промта: весь текст или со второй строки (если первая похожа на заголовок)
      const isFirstLineTitle = lines.length > 1 && lines[0].length < 120 && !lines[0].endsWith(".");
      const suggestedContent = isFirstLineTitle
        ? lines.slice(1).join("\n")
        : fullText;

      res.json({
        title: suggestedTitle,
        content: suggestedContent,
        filename: req.file.originalname,
        chars: fullText.length,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/prompts", (req, res) => {
    try {
      const rows = storage.getPrompts();
      // tags хранится как JSON-строка, парсим обратно в аррай для фронтенда
      res.json(rows.map(r => ({ ...r, tags: tryParseJson(r.tags) })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompts", (req, res) => {
    try {
      const now = new Date().toISOString();
      const body = { ...req.body };
      // tags должен храниться как JSON-строка в SQLite
      if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);
      const prompt = storage.createPrompt({ ...body, createdAt: now, updatedAt: now });
      // Парсим tags обратно в аррай для ответа
      res.json({ ...prompt, tags: tryParseJson(prompt.tags) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/prompts/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = { ...req.body };
      if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);
      const prompt = storage.updatePrompt(id, { ...body, updatedAt: new Date().toISOString() });
      if (!prompt) return res.status(404).json({ error: "Not found" });
      res.json({ ...prompt, tags: tryParseJson(prompt.tags) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/prompts/:id", (req, res) => {
    try {
      storage.deletePrompt(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Prompt Models
  app.get("/api/prompt-models", (req, res) => {
    try { res.json(storage.getPromptModels()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-models", (req, res) => {
    try {
      const now = new Date().toISOString();
      const model = storage.createPromptModel({ ...req.body, createdAt: now });
      res.json(model);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/prompt-models/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const model = storage.updatePromptModel(id, req.body);
      if (!model) return res.status(404).json({ error: "Not found" });
      res.json(model);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/prompt-models/:id", (req, res) => {
    try {
      storage.deletePromptModel(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Prompt Model Steps
  app.get("/api/prompt-models/:id/steps", (req, res) => {
    try {
      const steps = storage.getPromptModelSteps(parseInt(req.params.id));
      res.json(steps);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-model-steps", (req, res) => {
    try {
      const step = storage.createPromptModelStep(req.body);
      res.json(step);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/prompt-model-steps/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const step = storage.updatePromptModelStep(id, req.body);
      if (!step) return res.status(404).json({ error: "Not found" });
      res.json(step);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/prompt-model-steps/:id", (req, res) => {
    try {
      storage.deletePromptModelStep(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Yandex Disk ───────────────────────────────────────────────────────────
  app.get("/api/yadisk/info", async (req, res) => {
    const token = storage.getSetting("yadisk_token");
    if (!token) return res.status(400).json({ error: "Токен не настроен" });
    try {
      const data = await yadiskRequest(token, "GET", "/");
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/yadisk/files", async (req, res) => {
    const token = storage.getSetting("yadisk_token");
    if (!token) return res.status(400).json({ error: "Токен не настроен" });
    const folder = (req.query.folder as string) || "/АвитоCRM";
    try {
      const data = await yadiskRequest(token, "GET", `/resources?path=${encodeURIComponent(folder)}&limit=100`);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/yadisk/mkdir", async (req, res) => {
    const token = storage.getSetting("yadisk_token");
    if (!token) return res.status(400).json({ error: "Токен не настроен" });
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: "Не указан путь" });
    try {
      const data = await yadiskRequest(token, "PUT", `/resources?path=${encodeURIComponent(path)}`);
      res.json(data);
    } catch (e: any) {
      const status = e.statusCode || 500;
      // 409 = папка уже существует, не ошибка
      if (status === 409) return res.json({ already_exists: true });
      // 401 = неверный токен
      if (status === 401) return res.status(401).json({ error: "Неверный токен. Обновите OAuth-токен Яндекс Диска." });
      res.status(status > 499 ? 500 : status).json({ error: e.message });
    }
  });

  app.post("/api/yadisk/publish", async (req, res) => {
    const token = storage.getSetting("yadisk_token");
    if (!token) return res.status(400).json({ error: "Токен не настроен" });
    const { path } = req.body;
    try {
      await yadiskRequest(token, "PUT", `/resources/publish?path=${encodeURIComponent(path)}`);
      const info = await yadiskRequest(token, "GET", `/resources?path=${encodeURIComponent(path)}&fields=public_url`);
      res.json({ publicUrl: info.public_url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/yadisk/upload-url", async (req, res) => {
    const token = storage.getSetting("yadisk_token");
    if (!token) return res.status(400).json({ error: "Токен не настроен" });
    const { path } = req.query as { path: string };
    try {
      const data = await yadiskRequest(token, "GET", `/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Avito API ───────────────────────────────────────────────────────────────

  // Helper: получить / обновить access_token через client_credentials
  async function getAvitoToken(clientId: string, clientSecret: string): Promise<{ token: string; expiresAt: string }> {
    const resp = await fetch("https://api.avito.ru/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Авито OAuth ошибка ${resp.status}: ${txt}`);
    }
    const data = await resp.json();
    const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
    return { token: data.access_token, expiresAt };
  }

  // Helper: вернуть валидный токен (cамообновляется если истёк)
  async function ensureAvitoToken(crmClientId: number): Promise<{ token: string; avitoUserId: string }> {
    const conn = storage.getAvitoConnection(crmClientId);
    if (!conn) throw new Error("Подключение API Авито не настроено");
    const now = new Date().toISOString();
    if (conn.accessToken && conn.tokenExpiresAt && conn.tokenExpiresAt > now) {
      return { token: conn.accessToken, avitoUserId: conn.avitoUserId! };
    }
    // Обновляем
    const { token, expiresAt } = await getAvitoToken(conn.avitoClientId, conn.avitoClientSecret);
    storage.upsertAvitoConnection(crmClientId, { accessToken: token, tokenExpiresAt: expiresAt });
    return { token, avitoUserId: conn.avitoUserId! };
  }

  // GET /api/avito/:clientId/connection — получить подключение (без секрета)
  app.get("/api/avito/:clientId/connection", (req, res) => {
    const conn = storage.getAvitoConnection(parseInt(req.params.clientId));
    if (!conn) return res.json(null);
    const { avitoClientSecret, accessToken, ...safe } = conn;
    res.json({ ...safe, hasSecret: !!avitoClientSecret });
  });

  // POST /api/avito/:clientId/connection — сохранить ключи
  app.post("/api/avito/:clientId/connection", async (req, res) => {
    const crmClientId = parseInt(req.params.clientId);
    const { avitoClientId, avitoClientSecret, avitoUserId } = req.body;
    if (!avitoClientId || !avitoClientSecret) {
      return res.status(400).json({ error: "client_id и client_secret обязательны" });
    }
    try {
      // Проверяем ключи сразу
      const { token, expiresAt } = await getAvitoToken(avitoClientId, avitoClientSecret);
      const conn = storage.upsertAvitoConnection(crmClientId, {
        avitoClientId,
        avitoClientSecret,
        avitoUserId: avitoUserId || null,
        accessToken: token,
        tokenExpiresAt: expiresAt,
      });
      const { avitoClientSecret: _, accessToken: __, ...safe } = conn;
      res.json({ ...safe, hasSecret: true, tokenOk: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/avito/:clientId/connection
  app.delete("/api/avito/:clientId/connection", (req, res) => {
    storage.deleteAvitoConnection(parseInt(req.params.clientId));
    storage.clearAvitoStats(parseInt(req.params.clientId));
    res.json({ ok: true });
  });

  // GET /api/avito/:clientId/stats — получить сохранённую статистику
  app.get("/api/avito/:clientId/stats", (req, res) => {
    try {
      const stats = storage.getAvitoStats(parseInt(req.params.clientId));
      res.json(stats);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/avito/:clientId/fetch-stats — запросить статистику с Авито
  app.post("/api/avito/:clientId/fetch-stats", async (req, res) => {
    const crmClientId = parseInt(req.params.clientId);
    try {
      const { token, avitoUserId } = await ensureAvitoToken(crmClientId);
      if (!avitoUserId) return res.status(400).json({ error: "Не указан user_id аккаунта Авито" });

      // Параметры дат (по умолчанию — последние 30 дней)
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - (req.body.days || 30));
      const fmt = (d: Date) => d.toISOString().split("T")[0];

      // Шаг 1: получить список объявлений
      const itemsResp = await fetch(
        `https://api.avito.ru/core/v1/items?per_page=100&page=1&status=active,blocked,expired,removed`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!itemsResp.ok) throw new Error(`Ошибка получения объявлений: ${itemsResp.status}`);
      const itemsData = await itemsResp.json();
      const items: any[] = itemsData.resources || [];

      if (items.length === 0) {
        return res.json({ fetched: 0, message: "Объявления не найдены" });
      }

      // Шаг 2: запросить статистику по батчам (макс 200 ID)
      const batchSize = 200;
      const fetchedAt = new Date().toISOString();
      const statsToSave: any[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const statsResp = await fetch(
          `https://api.avito.ru/stats/v1/accounts/${avitoUserId}/items`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              itemIds: batch.map((it: any) => it.id),
              dateFrom: fmt(dateFrom),
              dateTo: fmt(dateTo),
              periodGrouping: "day",
              fields: ["uniqViews", "uniqContacts", "uniqFavorites"],
            }),
          }
        );
        if (!statsResp.ok) {
          const errTxt = await statsResp.text();
          throw new Error(`Ошибка статистики: ${statsResp.status} ${errTxt}`);
        }
        const statsData = await statsResp.json();
        const statItems: any[] = statsData.result?.items || [];

        for (const statItem of statItems) {
          const meta = items.find((it: any) => it.id === statItem.itemId);
          for (const dayStats of (statItem.stats || [])) {
            statsToSave.push({
              clientId: crmClientId,
              itemId: String(statItem.itemId),
              itemTitle: meta?.title || null,
              itemUrl: meta?.url || null,
              itemStatus: meta?.status || null,
              date: dayStats.date,
              uniqViews: dayStats.uniqViews || 0,
              uniqContacts: dayStats.uniqContacts || 0,
              uniqFavorites: dayStats.uniqFavorites || 0,
              fetchedAt,
            });
          }
        }
      }

      storage.upsertAvitoStats(statsToSave);
      res.json({ fetched: statsToSave.length, items: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/avito/:clientId/items — уникальные объявления из сохранённой статистики
  app.get("/api/avito/:clientId/items", (req, res) => {
    const stats = storage.getAvitoStats(parseInt(req.params.clientId));
    const itemMap = new Map<string, any>();
    for (const s of stats) {
      if (!itemMap.has(s.itemId)) {
        itemMap.set(s.itemId, { itemId: s.itemId, itemTitle: s.itemTitle, itemUrl: s.itemUrl, itemStatus: s.itemStatus });
      }
    }
    res.json(Array.from(itemMap.values()));
  });

  // ── Notes API ─────────────────────────────────────────────────────────────
  app.get("/api/notes", (_req, res) => {
    res.json(storage.getNotes());
  });

  app.post("/api/notes", (req, res) => {
    const { title = "Без названия", content = "", color = "#1e2235", tags = "[]", isPinned = false, posX = 0, posY = 0 } = req.body;
    const note = storage.createNote({ title, content, color, tags: typeof tags === "string" ? tags : JSON.stringify(tags), isPinned, posX, posY });
    res.json(note);
  });

  app.patch("/api/notes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const data = { ...req.body };
    if (Array.isArray(data.tags)) data.tags = JSON.stringify(data.tags);
    const note = storage.updateNote(id, data);
    if (!note) return res.status(404).json({ error: "Not found" });
    res.json(note);
  });

  app.delete("/api/notes/:id", (req, res) => {
    storage.deleteNote(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Note Folders API ──────────────────────────────────────────────────────
  app.get("/api/note-folders", (_req, res) => {
    res.json(storage.getNoteFolders());
  });

  app.post("/api/note-folders", (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    res.json(storage.createNoteFolder({ name, color }));
  });

  app.patch("/api/note-folders/:id", (req, res) => {
    const folder = storage.updateNoteFolder(parseInt(req.params.id), req.body);
    res.json(folder);
  });

  app.delete("/api/note-folders/:id", (req, res) => {
    storage.deleteNoteFolder(parseInt(req.params.id));
    res.json({ ok: true });
  });
}
