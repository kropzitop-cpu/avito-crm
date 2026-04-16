import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Clients ──────────────────────────────────────────────────────────────────
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  telegram: text("telegram"),
  niche: text("niche"),
  city: text("city"),
  status: text("status").notNull().default("active"),
  monthlyFee: real("monthly_fee"),
  startDate: text("start_date"),
  nextPaymentDate: text("next_payment_date"),
  notes: text("notes"),
  avatarColor: text("avatar_color").default("#7c6bff"),
  yadiskToken: text("yadisk_token"),
  yadiskFolder: text("yadisk_folder"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ── Payment Schedules (автосхемы оплат) ─────────────────────────────────────
// billingScheme:
//   monthly       — раз в месяц (в день startDate каждого месяца)
//   twice_monthly — 2 раза в месяц (startDate + secondDayOfMonth)
//   weekly        — еженедельно
//   split_first   — первые 2 платежа по 50% с интервалом secondDayOfMonth дней, затем ежемесячно
export const paymentSchedules = sqliteTable("payment_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  billingScheme: text("billing_scheme").notNull().default("monthly"),
  startDate: text("start_date").notNull(),
  monthlyAmount: real("monthly_amount").notNull(),
  secondDayOfMonth: integer("second_day_of_month").default(15),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules).omit({ id: true });
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;

// ── Payments ─────────────────────────────────────────────────────────────────
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  type: text("type").notNull().default("income"),
  description: text("description"),
  isPaid: integer("is_paid", { mode: "boolean" }).default(false),
  isPlanned: integer("is_planned", { mode: "boolean" }).default(true),
  scheduleId: integer("schedule_id"),
  rescheduledFrom: text("rescheduled_from"),
  reminderId: integer("reminder_id"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ── Materials (наработки) ─────────────────────────────────────────────────────
export const materials = sqliteTable("materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("text"),
  content: text("content"),
  tags: text("tags").default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
  yadiskPath: text("yadisk_path"),
  publicUrl: text("public_url"),
  folderName: text("folder_name"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// ── Documents (договоры, акты, чеки) ─────────────────────────────────────────
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  docType: text("doc_type").notNull().default("contract"),
  fileUrl: text("file_url"),
  yadiskPath: text("yadisk_path"),
  publicUrl: text("public_url"),
  fileType: text("file_type").default("file"),
  notes: text("notes"),
  date: text("date"),
  createdAt: text("created_at").notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ── Reminders ────────────────────────────────────────────────────────────────
export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  type: text("type").notNull().default("general"),
  isDone: integer("is_done", { mode: "boolean" }).default(false),
  priority: text("priority").default("medium"),
  recurrence: text("recurrence").default("none"),
  recurrenceEnd: text("recurrence_end"),
  parentId: integer("parent_id"),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  calls: integer("calls").default(0),
  messages: integer("messages").default(0),
  deals: integer("deals").default(0),
  adSpend: real("ad_spend").default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const insertReportSchema = createInsertSchema(reports).omit({ id: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

// ── Settings ─────────────────────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value"),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// ── Prompts (хранилище промтов) ───────────────────────────────────────────────
export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  category: text("category").notNull().default("Общее"),
  tags: text("tags").default("[]"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertPromptSchema = createInsertSchema(prompts).omit({ id: true });
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof prompts.$inferSelect;

// ── Prompt Models (рабочие модели) ────────────────────────────────────────────
export const promptModels = sqliteTable("prompt_models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const insertPromptModelSchema = createInsertSchema(promptModels).omit({ id: true });
export type InsertPromptModel = z.infer<typeof insertPromptModelSchema>;
export type PromptModel = typeof promptModels.$inferSelect;

// ── Prompt Model Steps (шаги модели) ──────────────────────────────────────────
export const promptModelSteps = sqliteTable("prompt_model_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: integer("model_id").notNull().references(() => promptModels.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull().default(0),
  name: text("name").notNull(),
  content: text("content").default(""),
});

export const insertPromptModelStepSchema = createInsertSchema(promptModelSteps).omit({ id: true });
export type InsertPromptModelStep = z.infer<typeof insertPromptModelStepSchema>;
export type PromptModelStep = typeof promptModelSteps.$inferSelect;

// ── Avito API connections (по клиенту) ────────────────────────────────────────
export const avitoConnections = sqliteTable("avito_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  avitoClientId: text("avito_client_id").notNull(),
  avitoClientSecret: text("avito_client_secret").notNull(),
  avitoUserId: text("avito_user_id"),       // числовой ID пользователя Авито
  accessToken: text("access_token"),
  tokenExpiresAt: text("token_expires_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertAvitoConnectionSchema = createInsertSchema(avitoConnections).omit({ id: true });
export type InsertAvitoConnection = z.infer<typeof insertAvitoConnectionSchema>;
export type AvitoConnection = typeof avitoConnections.$inferSelect;

// ── Avito Stats (собранная статистика по объявлениям) ─────────────────────────
export const avitoStats = sqliteTable("avito_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),        // ID объявления на Авито
  itemTitle: text("item_title"),
  itemUrl: text("item_url"),
  itemStatus: text("item_status"),
  date: text("date").notNull(),             // дата в формате YYYY-MM-DD
  uniqViews: integer("uniq_views").default(0),
  uniqContacts: integer("uniq_contacts").default(0),
  uniqFavorites: integer("uniq_favorites").default(0),
  fetchedAt: text("fetched_at").notNull(),
});

export const insertAvitoStatSchema = createInsertSchema(avitoStats).omit({ id: true });
export type InsertAvitoStat = z.infer<typeof insertAvitoStatSchema>;
export type AvitoStat = typeof avitoStats.$inferSelect;

// ── Users (авторизация) ───────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("helper"), // "admin" | "helper"
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});
export type User = typeof users.$inferSelect;

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // random token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Session = typeof sessions.$inferSelect;

// ── Invites (ссылки-приглашения) ──────────────────────────────────────────────
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  name: text("name").notNull(), // имя помощника (задаёт админ)
  usedAt: text("used_at"),      // null = ещё не принято
  userId: integer("user_id"),   // заполняется после принятия
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Invite = typeof invites.$inferSelect;

// ── Permissions (права доступа для помощника) ─────────────────────────────────
// section: "clients" | "finance" | "tasks" | "materials" | "prompts" | "yadisk" | "reminders" | "documents" | "team"
// level:   "none" | "view" | "edit"
// scopeType: null | "all" | "clients_list" | "folders" | "files"
// scopeIds: JSON array of ids/names when scopeType is "clients_list"/"folders"/"files"
export const permissions = sqliteTable("permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  level: text("level").notNull().default("none"), // none | view | edit
  scopeType: text("scope_type"),                  // all | clients_list | folders | files
  scopeIds: text("scope_ids").default("[]"),      // JSON
});
export type Permission = typeof permissions.$inferSelect;

// ── Notes (стикерная доска) ───────────────────────────────────────────────────
export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("Без названия"),
  content: text("content").default(""),
  color: text("color").notNull().default("#1e2235"),   // цвет стикера
  tags: text("tags").default("[]"),                     // JSON array of strings
  isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
  posX: integer("pos_x").default(0),
  posY: integer("pos_y").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
