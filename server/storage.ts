import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import {
  clients, payments, materials, reminders, reports, documents, settings, paymentSchedules,
  prompts, promptModels, promptModelSteps, avitoConnections, avitoStats, notes, noteFolders,
  type Client, type InsertClient,
  type Payment, type InsertPayment,
  type Material, type InsertMaterial,
  type Reminder, type InsertReminder,
  type Report, type InsertReport,
  type Document, type InsertDocument,
  type PaymentSchedule, type InsertPaymentSchedule,
  type Prompt, type InsertPrompt,
  type PromptModel, type InsertPromptModel,
  type PromptModelStep, type InsertPromptModelStep,
  type AvitoConnection, type InsertAvitoConnection,
  type AvitoStat, type InsertAvitoStat,
  type Note, type InsertNote,
  type NoteFolder,
} from "@shared/schema";

// Use /data/crm.db on Railway (persistent volume), fallback to local crm.db
const DB_PATH = process.env.RAILWAY_ENVIRONMENT ? "/data/crm.db" : "crm.db";
const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    telegram TEXT,
    niche TEXT,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    monthly_fee REAL,
    start_date TEXT,
    next_payment_date TEXT,
    notes TEXT,
    avatar_color TEXT DEFAULT '#7c6bff',
    yadisk_token TEXT,
    yadisk_folder TEXT
  );
  CREATE TABLE IF NOT EXISTS payment_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    billing_scheme TEXT NOT NULL DEFAULT 'monthly',
    start_date TEXT NOT NULL,
    monthly_amount REAL NOT NULL,
    second_day_of_month INTEGER DEFAULT 15,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'income',
    description TEXT,
    is_paid INTEGER DEFAULT 0,
    is_planned INTEGER DEFAULT 1,
    schedule_id INTEGER,
    rescheduled_from TEXT,
    reminder_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    yadisk_path TEXT,
    public_url TEXT,
    folder_name TEXT,
    file_name TEXT,
    mime_type TEXT
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'contract',
    file_url TEXT,
    yadisk_path TEXT,
    public_url TEXT,
    file_type TEXT DEFAULT 'file',
    notes TEXT,
    date TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    is_done INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    recurrence TEXT DEFAULT 'none',
    recurrence_end TEXT,
    parent_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    calls INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    deals INTEGER DEFAULT 0,
    ad_spend REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Общее',
    tags TEXT DEFAULT '[]',
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prompt_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prompt_model_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES prompt_models(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    content TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS avito_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    avito_client_id TEXT NOT NULL,
    avito_client_secret TEXT NOT NULL,
    avito_user_id TEXT,
    access_token TEXT,
    token_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS note_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7c6bff',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Без названия',
    content TEXT DEFAULT '',
    color TEXT NOT NULL DEFAULT '#1e2235',
    tags TEXT DEFAULT '[]',
    is_pinned INTEGER DEFAULT 0,
    pos_x INTEGER DEFAULT 0,
    pos_y INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    folder_id INTEGER DEFAULT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS avito_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_title TEXT,
    item_url TEXT,
    item_status TEXT,
    date TEXT NOT NULL,
    uniq_views INTEGER DEFAULT 0,
    uniq_contacts INTEGER DEFAULT 0,
    uniq_favorites INTEGER DEFAULT 0,
    fetched_at TEXT NOT NULL
  );
`);

// Migrations — safe try/catch
const migrations = [
  "ALTER TABLE clients ADD COLUMN next_payment_date TEXT",
  "ALTER TABLE clients ADD COLUMN yadisk_token TEXT",
  "ALTER TABLE clients ADD COLUMN yadisk_folder TEXT",
  "ALTER TABLE payments ADD COLUMN is_planned INTEGER DEFAULT 1",
  "ALTER TABLE payments ADD COLUMN schedule_id INTEGER",
  "ALTER TABLE payments ADD COLUMN rescheduled_from TEXT",
  "ALTER TABLE payments ADD COLUMN reminder_id INTEGER",
  "ALTER TABLE materials ADD COLUMN category TEXT NOT NULL DEFAULT 'text'",
  "ALTER TABLE materials ADD COLUMN yadisk_path TEXT",
  "ALTER TABLE materials ADD COLUMN public_url TEXT",
  "ALTER TABLE materials ADD COLUMN folder_name TEXT",
  "ALTER TABLE materials ADD COLUMN file_name TEXT",
  "ALTER TABLE materials ADD COLUMN mime_type TEXT",
  "ALTER TABLE reminders ADD COLUMN recurrence TEXT DEFAULT 'none'",
  "ALTER TABLE reminders ADD COLUMN recurrence_end TEXT",
  "ALTER TABLE reminders ADD COLUMN parent_id INTEGER",
  "ALTER TABLE notes ADD COLUMN folder_id INTEGER DEFAULT NULL",
  // Fix is_paid default to 0 for new rows via migration is not possible in SQLite,
  // but new rows created via app will use correct defaults
];
for (const sql of migrations) {
  try { sqlite.exec(sql); } catch (_) {}
}

// ── Payment schedule date generation ─────────────────────────────────────────
// Generates up to 12 months ahead of payment dates
function generateScheduleDates(schedule: PaymentSchedule): Array<{ date: string; amount: number; description: string }> {
  const start = new Date(schedule.startDate);
  const monthlyAmt = schedule.monthlyAmount;
  const scheme = schedule.billingScheme;
  const horizon = new Date(start);
  horizon.setFullYear(horizon.getFullYear() + 1); // 1 year ahead

  const results: Array<{ date: string; amount: number; description: string }> = [];
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (scheme === "monthly") {
    let cur = new Date(start);
    while (cur <= horizon) {
      results.push({ date: fmt(cur), amount: monthlyAmt, description: "Ежемесячная оплата" });
      cur = new Date(cur);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (scheme === "twice_monthly") {
    const day2 = schedule.secondDayOfMonth ?? 15;
    let cur = new Date(start);
    // First date in start month
    while (cur <= horizon) {
      results.push({ date: fmt(cur), amount: monthlyAmt / 2, description: "Оплата (1/2 месяца)" });
      // Second date in same month
      const d2 = new Date(cur.getFullYear(), cur.getMonth(), day2);
      if (d2 > cur && d2 <= horizon) {
        results.push({ date: fmt(d2), amount: monthlyAmt / 2, description: "Оплата (2/2 месяца)" });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
    }
  } else if (scheme === "weekly") {
    let cur = new Date(start);
    while (cur <= horizon) {
      results.push({ date: fmt(cur), amount: monthlyAmt / 4, description: "Еженедельная оплата" });
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
    }
  } else if (scheme === "split_first") {
    // First 2 payments: 50% each, separated by secondDayOfMonth days
    const halfAmt = monthlyAmt / 2;
    const gap = schedule.secondDayOfMonth ?? 15;
    const p1 = new Date(start);
    const p2 = new Date(start);
    p2.setDate(p2.getDate() + gap);
    results.push({ date: fmt(p1), amount: halfAmt, description: "Первый платёж 50%" });
    if (p2 <= horizon) {
      results.push({ date: fmt(p2), amount: halfAmt, description: "Второй платёж 50%" });
    }
    // Then monthly from next month
    let cur = new Date(start);
    cur.setMonth(cur.getMonth() + 1);
    while (cur <= horizon) {
      results.push({ date: fmt(cur), amount: monthlyAmt, description: "Ежемесячная оплата" });
      cur = new Date(cur);
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Storage interface ─────────────────────────────────────────────────────────
export interface IStorage {
  getClients(): Client[];
  getClient(id: number): Client | undefined;
  createClient(data: InsertClient): Client;
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined;
  deleteClient(id: number): void;

  getPayments(clientId?: number): Payment[];
  createPayment(data: InsertPayment): Payment;
  updatePayment(id: number, data: Partial<InsertPayment>): Payment | undefined;
  deletePayment(id: number): void;

  getPaymentSchedules(clientId: number): PaymentSchedule[];
  createPaymentSchedule(data: InsertPaymentSchedule): PaymentSchedule;
  deactivateSchedule(id: number): void;
  regenerateSchedulePayments(scheduleId: number): void;
  deactivateClientSchedules(clientId: number): void;

  getMaterials(clientId: number, category?: string): Material[];
  createMaterial(data: InsertMaterial): Material;
  updateMaterial(id: number, data: Partial<InsertMaterial>): Material | undefined;
  deleteMaterial(id: number): void;

  getDocuments(clientId: number): Document[];
  createDocument(data: InsertDocument): Document;
  updateDocument(id: number, data: Partial<InsertDocument>): Document | undefined;
  deleteDocument(id: number): void;

  getReminders(clientId?: number, done?: boolean): Reminder[];
  getAllReminders(): Reminder[];
  createReminder(data: InsertReminder): Reminder;
  updateReminder(id: number, data: Partial<InsertReminder>): Reminder | undefined;
  deleteReminder(id: number): void;

  getReports(clientId: number): Report[];
  createReport(data: InsertReport): Report;
  updateReport(id: number, data: Partial<InsertReport>): Report | undefined;
  deleteReport(id: number): void;

  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;

  getPrompts(): Prompt[];
  createPrompt(data: InsertPrompt): Prompt;
  updatePrompt(id: number, data: Partial<InsertPrompt>): Prompt | undefined;
  deletePrompt(id: number): void;

  getPromptModels(): PromptModel[];
  createPromptModel(data: InsertPromptModel): PromptModel;
  updatePromptModel(id: number, data: Partial<InsertPromptModel>): PromptModel | undefined;
  deletePromptModel(id: number): void;

  getPromptModelSteps(modelId: number): PromptModelStep[];
  createPromptModelStep(data: InsertPromptModelStep): PromptModelStep;
  updatePromptModelStep(id: number, data: Partial<InsertPromptModelStep>): PromptModelStep | undefined;
  deletePromptModelStep(id: number): void;

  // ── Avito API ────────────────────────────────────────────────────────────
  getAvitoConnection(clientId: number): AvitoConnection | undefined;
  upsertAvitoConnection(clientId: number, data: Partial<InsertAvitoConnection>): AvitoConnection;
  deleteAvitoConnection(clientId: number): void;
  getAvitoStats(clientId: number): AvitoStat[];
  upsertAvitoStats(rows: InsertAvitoStat[]): void;
  clearAvitoStats(clientId: number): void;

  getDashboardStats(): {
    totalClients: number; activeClients: number;
    monthlyRevenue: number; pendingReminders: number; potentialRevenue: number;
  };
}

export const storage: IStorage = {
  // ── Clients ────────────────────────────────────────────────────────────────
  getClients() { return db.select().from(clients).orderBy(desc(clients.id)).all(); },
  getClient(id) { return db.select().from(clients).where(eq(clients.id, id)).get(); },
  createClient(data) { return db.insert(clients).values(data).returning().get(); },
  updateClient(id, data) {
    const updated = db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
    // When client goes inactive — deactivate all schedules and cancel future payments
    if (data.status && data.status !== "active" && updated) {
      storage.deactivateClientSchedules(id);
    }
    return updated;
  },
  deleteClient(id) { db.delete(clients).where(eq(clients.id, id)).run(); },

  // ── Payment Schedules ──────────────────────────────────────────────────────
  getPaymentSchedules(clientId) {
    return db.select().from(paymentSchedules)
      .where(eq(paymentSchedules.clientId, clientId))
      .orderBy(desc(paymentSchedules.createdAt)).all();
  },

  createPaymentSchedule(data) {
    const schedule = db.insert(paymentSchedules).values(data).returning().get();
    // Generate planned payments + calendar reminders
    storage.regenerateSchedulePayments(schedule.id);
    return schedule;
  },

  deactivateSchedule(id) {
    db.update(paymentSchedules).set({ isActive: false }).where(eq(paymentSchedules.id, id)).run();
    // Remove all unpaid planned payments from this schedule
    const today = new Date().toISOString().split("T")[0];
    const futurePlanned = db.select().from(payments)
      .where(and(eq(payments.scheduleId, id), eq(payments.isPaid, false), eq(payments.isPlanned, true)))
      .all();
    for (const p of futurePlanned) {
      if (p.date >= today) {
        // Also delete linked reminder
        if (p.reminderId) {
          try { db.delete(reminders).where(eq(reminders.id, p.reminderId)).run(); } catch (_) {}
        }
        db.delete(payments).where(eq(payments.id, p.id)).run();
      }
    }
  },

  deactivateClientSchedules(clientId) {
    const schedules = db.select().from(paymentSchedules)
      .where(and(eq(paymentSchedules.clientId, clientId), eq(paymentSchedules.isActive, true))).all();
    for (const s of schedules) {
      storage.deactivateSchedule(s.id);
    }
  },

  regenerateSchedulePayments(scheduleId) {
    const schedule = db.select().from(paymentSchedules).where(eq(paymentSchedules.id, scheduleId)).get();
    if (!schedule || !schedule.isActive) return;

    const client = db.select().from(clients).where(eq(clients.id, schedule.clientId)).get();
    if (!client || client.status !== "active") return;

    const today = new Date().toISOString().split("T")[0];

    // Remove all future unpaid planned payments for this schedule
    const existing = db.select().from(payments)
      .where(and(eq(payments.scheduleId, scheduleId), eq(payments.isPaid, false))).all();
    for (const p of existing) {
      if (p.date >= today) {
        if (p.reminderId) {
          try { db.delete(reminders).where(eq(reminders.id, p.reminderId)).run(); } catch (_) {}
        }
        db.delete(payments).where(eq(payments.id, p.id)).run();
      }
    }

    // Generate fresh dates
    const dates = generateScheduleDates(schedule);

    for (const { date, amount, description } of dates) {
      if (date < today) continue; // skip past dates

      // Create calendar reminder
      let reminderId: number | null = null;
      try {
        const rem = db.insert(reminders).values({
          clientId: schedule.clientId,
          title: `Оплата ${amount.toLocaleString("ru-RU")} ₽ — ${client.name}`,
          description,
          dueDate: date,
          type: "payment",
          priority: "high",
          isDone: false,
          recurrence: "none",
          recurrenceEnd: null,
          parentId: null,
        }).returning().get();
        reminderId = rem.id;
      } catch (_) {}

      // Create planned payment
      db.insert(payments).values({
        clientId: schedule.clientId,
        amount,
        date,
        type: "income",
        description,
        isPaid: false,
        isPlanned: true,
        scheduleId,
        reminderId,
      }).run();
    }
  },

  // ── Payments ───────────────────────────────────────────────────────────────
  getPayments(clientId) {
    if (clientId) {
      return db.select().from(payments).where(eq(payments.clientId, clientId)).orderBy(payments.date).all();
    }
    return db.select().from(payments).orderBy(desc(payments.date)).all();
  },
  createPayment(data) { return db.insert(payments).values(data).returning().get(); },
  updatePayment(id, data) {
    return db.update(payments).set(data).where(eq(payments.id, id)).returning().get();
  },
  deletePayment(id) {
    const p = db.select().from(payments).where(eq(payments.id, id)).get();
    if (p?.reminderId) {
      try { db.delete(reminders).where(eq(reminders.id, p.reminderId)).run(); } catch (_) {}
    }
    db.delete(payments).where(eq(payments.id, id)).run();
  },

  // ── Materials ──────────────────────────────────────────────────────────────
  getMaterials(clientId, category) {
    if (category && category !== "all") {
      return db.select().from(materials)
        .where(and(eq(materials.clientId, clientId), eq(materials.category, category)))
        .orderBy(desc(materials.isPinned), desc(materials.updatedAt)).all();
    }
    return db.select().from(materials).where(eq(materials.clientId, clientId))
      .orderBy(desc(materials.isPinned), desc(materials.updatedAt)).all();
  },
  createMaterial(data) { return db.insert(materials).values(data).returning().get(); },
  updateMaterial(id, data) {
    return db.update(materials).set(data).where(eq(materials.id, id)).returning().get();
  },
  deleteMaterial(id) { db.delete(materials).where(eq(materials.id, id)).run(); },

  // ── Documents ──────────────────────────────────────────────────────────────
  getDocuments(clientId) {
    return db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt)).all();
  },
  createDocument(data) { return db.insert(documents).values(data).returning().get(); },
  updateDocument(id, data) { return db.update(documents).set(data).where(eq(documents.id, id)).returning().get(); },
  deleteDocument(id) { db.delete(documents).where(eq(documents.id, id)).run(); },

  // ── Reminders ──────────────────────────────────────────────────────────────
  getAllReminders() { return db.select().from(reminders).orderBy(reminders.dueDate).all(); },
  getReminders(clientId, done) {
    const conds: any[] = [];
    if (clientId !== undefined) conds.push(eq(reminders.clientId, clientId));
    if (done !== undefined) conds.push(eq(reminders.isDone, done));
    if (conds.length > 0) return db.select().from(reminders).where(and(...conds)).orderBy(reminders.dueDate).all();
    return db.select().from(reminders).orderBy(reminders.dueDate).all();
  },
  createReminder(data) {
    const created = db.insert(reminders).values(data).returning().get();
    if (data.recurrence && data.recurrence !== "none" && data.dueDate) {
      const base = new Date(data.dueDate);
      const end = data.recurrenceEnd ? new Date(data.recurrenceEnd) : new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
      let cur = new Date(base);
      let count = 0;
      while (count < 60) {
        if (data.recurrence === "daily") cur.setDate(cur.getDate() + 1);
        else if (data.recurrence === "weekly") cur.setDate(cur.getDate() + 7);
        else if (data.recurrence === "monthly") cur.setMonth(cur.getMonth() + 1);
        if (cur > end) break;
        try {
          db.insert(reminders).values({
            ...data, dueDate: cur.toISOString().split("T")[0],
            parentId: created.id, recurrence: "none",
          }).run();
        } catch (_) {}
        count++;
      }
    }
    return created;
  },
  updateReminder(id, data) { return db.update(reminders).set(data).where(eq(reminders.id, id)).returning().get(); },
  deleteReminder(id) {
    try { db.delete(reminders).where(eq((reminders as any).parentId, id)).run(); } catch (_) {}
    db.delete(reminders).where(eq(reminders.id, id)).run();
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  getReports(clientId) {
    return db.select().from(reports).where(eq(reports.clientId, clientId)).orderBy(desc(reports.period)).all();
  },
  createReport(data) { return db.insert(reports).values(data).returning().get(); },
  updateReport(id, data) { return db.update(reports).set(data).where(eq(reports.id, id)).returning().get(); },
  deleteReport(id) { db.delete(reports).where(eq(reports.id, id)).run(); },

  // ── Settings ───────────────────────────────────────────────────────────────
  getSetting(key) {
    return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
  },
  setSetting(key, value) {
    const ex = db.select().from(settings).where(eq(settings.key, key)).get();
    if (ex) db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    else db.insert(settings).values({ key, value }).run();
  },

  // ── Prompts ───────────────────────────────────────────────────────────────
  getPrompts() { return db.select().from(prompts).orderBy(desc(prompts.updatedAt)).all(); },
  createPrompt(data) { return db.insert(prompts).values(data).returning().get(); },
  updatePrompt(id, data) { return db.update(prompts).set(data).where(eq(prompts.id, id)).returning().get(); },
  deletePrompt(id) { db.delete(prompts).where(eq(prompts.id, id)).run(); },

  getPromptModels() { return db.select().from(promptModels).orderBy(desc(promptModels.createdAt)).all(); },
  createPromptModel(data) { return db.insert(promptModels).values(data).returning().get(); },
  updatePromptModel(id, data) { return db.update(promptModels).set(data).where(eq(promptModels.id, id)).returning().get(); },
  deletePromptModel(id) { db.delete(promptModels).where(eq(promptModels.id, id)).run(); },

  getPromptModelSteps(modelId) {
    return db.select().from(promptModelSteps).where(eq(promptModelSteps.modelId, modelId)).orderBy(promptModelSteps.stepNumber).all();
  },
  createPromptModelStep(data) { return db.insert(promptModelSteps).values(data).returning().get(); },
  updatePromptModelStep(id, data) { return db.update(promptModelSteps).set(data).where(eq(promptModelSteps.id, id)).returning().get(); },
  deletePromptModelStep(id) { db.delete(promptModelSteps).where(eq(promptModelSteps.id, id)).run(); },

  // ── Avito API ────────────────────────────────────────────────────────────
  getAvitoConnection(clientId) {
    return db.select().from(avitoConnections).where(eq(avitoConnections.clientId, clientId)).get();
  },
  upsertAvitoConnection(clientId, data) {
    const existing = db.select().from(avitoConnections).where(eq(avitoConnections.clientId, clientId)).get();
    const now = new Date().toISOString();
    if (existing) {
      return db.update(avitoConnections).set({ ...data, updatedAt: now }).where(eq(avitoConnections.clientId, clientId)).returning().get()!;
    } else {
      return db.insert(avitoConnections).values({ clientId, createdAt: now, updatedAt: now, ...data } as any).returning().get()!;
    }
  },
  deleteAvitoConnection(clientId) {
    db.delete(avitoConnections).where(eq(avitoConnections.clientId, clientId)).run();
  },
  getAvitoStats(clientId) {
    return db.select().from(avitoStats)
      .where(eq(avitoStats.clientId, clientId))
      .orderBy(desc(avitoStats.date))
      .all();
  },
  upsertAvitoStats(rows) {
    for (const row of rows) {
      const existing = db.select().from(avitoStats)
        .where(and(eq(avitoStats.clientId, row.clientId), eq(avitoStats.itemId, row.itemId), eq(avitoStats.date, row.date)))
        .get();
      if (existing) {
        db.update(avitoStats).set(row).where(eq(avitoStats.id, existing.id)).run();
      } else {
        db.insert(avitoStats).values(row).run();
      }
    }
  },
  clearAvitoStats(clientId) {
    db.delete(avitoStats).where(eq(avitoStats.clientId, clientId)).run();
  },

  // ── Notes ────────────────────────────────────────────────────────────────
  getNotes() {
    return db.select().from(notes).orderBy(desc(notes.isPinned), desc(notes.updatedAt)).all();
  },
  getNote(id: number) {
    return db.select().from(notes).where(eq(notes.id, id)).get();
  },
  createNote(data: any) {
    const now = new Date().toISOString();
    return db.insert(notes).values({ ...data, createdAt: now, updatedAt: now }).returning().get()!;
  },
  updateNote(id: number, data: any) {
    const now = new Date().toISOString();
    return db.update(notes).set({ ...data, updatedAt: now }).where(eq(notes.id, id)).returning().get();
  },
  deleteNote(id: number) {
    db.delete(notes).where(eq(notes.id, id)).run();
  },

  // ── Note Folders ──────────────────────────────────────────────────────────────────────
  getNoteFolders() {
    return db.select().from(noteFolders).orderBy(noteFolders.name).all();
  },
  createNoteFolder(data: { name: string; color?: string }) {
    const now = new Date().toISOString();
    return db.insert(noteFolders).values({ name: data.name, color: data.color || '#7c6bff', createdAt: now }).returning().get()!;
  },
  updateNoteFolder(id: number, data: { name?: string; color?: string }) {
    return db.update(noteFolders).set(data).where(eq(noteFolders.id, id)).returning().get();
  },
  deleteNoteFolder(id: number) {
    // Убираем folderId у заметок этой папки
    db.update(notes).set({ folderId: null } as any).where(eq((notes as any).folderId, id)).run();
    db.delete(noteFolders).where(eq(noteFolders.id, id)).run();
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  getDashboardStats() {
    const allClients = db.select().from(clients).all();
    const activeClients = allClients.filter(c => c.status === "active").length;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
    const allPayments = db.select().from(payments).all();
    const monthlyRevenue = allPayments
      .filter(p => p.date >= monthStart && p.date <= monthEnd && p.type === "income" && p.isPaid)
      .reduce((s, p) => s + p.amount, 0);
    const potentialRevenue = allPayments
      .filter(p => p.date >= monthStart && p.date <= monthEnd && p.type === "income" && (!p.isPaid || p.isPlanned))
      .reduce((s, p) => s + p.amount, 0);
    const today = now.toISOString().slice(0, 10);
    const pendingReminders = db.select().from(reminders).where(eq(reminders.isDone, false)).all()
      .filter(r => (r.dueDate ?? (r as any).due_date) <= today).length;
    return { totalClients: allClients.length, activeClients, monthlyRevenue, pendingReminders, potentialRevenue };
  },
};
