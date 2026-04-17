import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Plus, Pin, Trash2, Edit2, FileText, Image, Link2, Video,
  Phone, MessageCircle, Mail, MapPin, Bell, Camera, Wand2,
  FolderOpen, Receipt, Calendar, RotateCcw, ExternalLink, Copy,
  Upload, FolderPlus, Folder, X, Eye, Grid2X2, List,
  CheckCircle2, CalendarClock, Settings2, Zap, ChevronRight,
  BarChart2, RefreshCw, TrendingUp, TrendingDown, Heart, MousePointer, Wifi, WifiOff, ChevronDown, ChevronUp,
} from "lucide-react";
import { queryClient, apiRequest, API_BASE } from "@/lib/queryClient";
import { getToken } from "@/lib/auth";

function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { "x-session-token": token } : {};
}
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client, Material, Payment, Report, Reminder, PaymentSchedule, InsertMaterial, InsertPayment, InsertReport, InsertReminder } from "@shared/schema";

// ── Inline editable title ────────────────────────────────────────────────────
function InlineTitle({ value, onSave, className, style }: { value: string; onSave: (v: string) => void; className?: string; style?: React.CSSProperties }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(value); } }}
        autoFocus
        className={className}
        style={{ ...style, background: "rgba(124,107,255,0.1)", border: "1px solid rgba(124,107,255,0.5)", borderRadius: 6, padding: "0 4px", outline: "none", width: "100%" }}
      />
    );
  }
  return (
    <span
      className={className}
      style={{ ...style, cursor: "text" }}
      title="Клик чтобы изменить"
      onClick={e => { e.stopPropagation(); setEditing(true); setDraft(value); }}
    >
      {value}
    </span>
  );
}

// ── Category icons + colors ─────────────────────────────────────────────────
const CATEGORIES = [
  { value: "all",      label: "Все",          icon: null,    color: "#94a3b8" },
  { value: "photo",    label: "Фото товара",  icon: Camera,  color: "#fb923c" },
  { value: "creative", label: "Креативы",     icon: Wand2,   color: "#a78bfa" },
  { value: "video",    label: "Видео",        icon: Video,   color: "#f472b6" },
  { value: "text",     label: "Тексты",       icon: FileText, color: "#7c6bff" },
  { value: "link",     label: "Ссылки",       icon: Link2,   color: "#22d3ee" },
];

const catColor: Record<string, string> = {
  photo: "#fb923c", creative: "#a78bfa", video: "#f472b6",
  text: "#7c6bff", link: "#22d3ee", file: "#fbbf24",
};

function catIcon(cat: string) {
  if (cat === "photo")    return <Camera size={14} />;
  if (cat === "creative") return <Wand2 size={14} />;
  if (cat === "video")    return <Video size={14} />;
  if (cat === "link")     return <Link2 size={14} />;
  return <FileText size={14} />;
}

// ── DOC TYPES ───────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: "contract", label: "Договор" },
  { value: "act",      label: "Акт" },
  { value: "receipt",  label: "Чек" },
  { value: "other",    label: "Другое" },
];

const docTypeColor: Record<string, string> = {
  contract: "#7c6bff", act: "#22d3ee", receipt: "#4ade80", other: "#94a3b8",
};

// ── Helpers for file preview ──────────────────────────────────────────────────
function isImage(mime?: string | null, content?: string | null): boolean {
  if (mime && mime.startsWith("image/")) return true;
  if (content && content.startsWith("data:image/")) return true;
  return false;
}
function isVideoFile(mime?: string | null): boolean {
  return !!(mime && mime.startsWith("video/"));
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFiles, category, folderName }: { onFiles: (files: ProcessedFile[]) => void; category: string; folderName?: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  interface ProcessedFile { title: string; category: string; content: string; mimeType: string; fileName: string; folderName?: string; }

  const processFile = async (file: File): Promise<ProcessedFile> => {
    const mime = file.type;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let cat = category;
    if (mime.startsWith("image/")) cat = cat === "all" ? "photo" : cat;
    else if (mime.startsWith("video/")) cat = "video";
    else if (ext === "txt" || ext === "docx" || mime.includes("text")) cat = cat === "all" ? "text" : cat;

    // video — upload to disk via /api/documents/upload, store URL in content
    if (mime.startsWith("video/")) {
      return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append("file", file);
        const token = getToken();
        fetch(`${API_BASE}/api/documents/upload`, {
          method: "POST",
          headers: token ? { "x-session-token": token } : {},
          body: fd,
        })
          .then(r => r.json())
          .then(data => {
            if (!data.fileUrl) throw new Error("no fileUrl");
            resolve({
              title: file.name.replace(/\.[^.]+$/, ""),
              category: "video",
              content: data.fileUrl,
              mimeType: mime,
              fileName: file.name,
              folderName,
            });
          })
          .catch(reject);
      });
    }

    // .docx — parse via server
    if (ext === "docx") {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const token = getToken();
        const res = await fetch(`${API_BASE}/api/prompts/parse-docx`, {
          method: "POST",
          headers: token ? { "x-session-token": token } : {},
          body: fd,
        });
        const data = await res.json();
        return {
          title: data.title || file.name.replace(/\.[^.]+$/, ""),
          category: cat === "all" ? "text" : cat,
          content: data.content || data.text || "",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileName: file.name,
          folderName,
        };
      } catch {
        // fallback
      }
    }

    // .txt — read as plain text
    if (ext === "txt" || mime === "text/plain") {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          title: file.name.replace(/\.[^.]+$/, ""),
          category: cat === "all" ? "text" : cat,
          content: e.target?.result as string,
          mimeType: "text/plain",
          fileName: file.name,
          folderName,
        });
        reader.readAsText(file, "utf-8");
      });
    }

    // default: base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        title: file.name.replace(/\.[^.]+$/, ""),
        category: cat === "all" ? "photo" : cat,
        content: e.target?.result as string,
        mimeType: mime,
        fileName: file.name,
        folderName,
      });
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const processed = await Promise.all(files.map(processFile));
    onFiles(processed);
  }, [category, folderName]);

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const processed = await Promise.all(files.map(processFile));
    onFiles(processed);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 py-6"
      style={{
        border: `2px dashed ${isDragging ? "#7c6bff" : "rgba(124,107,255,0.25)"}`,
        background: isDragging ? "rgba(124,107,255,0.1)" : "rgba(124,107,255,0.03)",
      }}
    >
      <Upload size={24} style={{ color: isDragging ? "#a78bfa" : "#475569" }} />
      <div className="text-xs text-center" style={{ color: "#64748b" }}>
        Перетащите файлы сюда или нажмите для выбора
        <br />
        <span style={{ color: "#334155" }}>Изображения, видео, документы</span>
      </div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleInput}
        accept="image/*,video/*,application/pdf,.doc,.docx,.txt" />
    </div>
  );
}

interface ProcessedFile { title: string; category: string; content: string; mimeType: string; fileName: string; folderName?: string; }

// ── Material Form ─────────────────────────────────────────────────────────────
function MaterialForm({ clientId, onClose, existing, folders, defaultCategory, defaultFolder }: {
  clientId: number; onClose: () => void; existing?: Material;
  folders: string[]; defaultCategory?: string; defaultFolder?: string;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    category: (existing as any)?.category ?? existing?.type ?? defaultCategory ?? "text",
    content: existing?.content ?? "",
    tags: existing?.tags ?? "[]",
    folderName: (existing as any)?.folderName ?? defaultFolder ?? "",
    newFolder: "",
  });
  const tagsArr: string[] = (() => { try { return JSON.parse(form.tags); } catch { return []; } })();
  const [tagInput, setTagInput] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const allFolders = form.newFolder
    ? [...folders, form.newFolder]
    : folders;

  const mutation = useMutation({
    mutationFn: (d: any) =>
      existing
        ? apiRequest("PATCH", `/api/materials/${existing.id}`, d)
        : apiRequest("POST", "/api/materials", { ...d, clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "folders"] });
      toast({ title: existing ? "Наработка обновлена" : "Наработка добавлена" });
      onClose();
    },
  });

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm(f => ({ ...f, tags: JSON.stringify([...tagsArr, tagInput.trim()]) }));
    setTagInput("");
  };
  const removeTag = (tag: string) => setForm(f => ({ ...f, tags: JSON.stringify(tagsArr.filter(t => t !== tag)) }));

  const finalFolder = form.newFolder || form.folderName || null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Название {form.category === "link" ? "(необяз.)" : "*"}</label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={form.category === "link" ? "Название ссылки..." : "Продающий заголовок"} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Категория</label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Текст</SelectItem>
              <SelectItem value="photo">Фото товара</SelectItem>
              <SelectItem value="creative">Креатив</SelectItem>
              <SelectItem value="video">Видео (URL)</SelectItem>
              <SelectItem value="link">Ссылка</SelectItem>
              <SelectItem value="file">Файл</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Folder */}
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Папка (необяз.)</label>
        {!showNewFolder ? (
          <div className="flex gap-2">
            <Select value={form.folderName || "none"} onValueChange={v => setForm(f => ({ ...f, folderName: v === "none" ? "" : v }))}>
              <SelectTrigger className="bg-transparent border-border flex-1"><SelectValue placeholder="Без папки" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без папки</SelectItem>
                {folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowNewFolder(true)} className="gap-1.5 border-border shrink-0">
              <FolderPlus size={13} /> Новая
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={form.newFolder}
              onChange={e => setForm(f => ({ ...f, newFolder: e.target.value }))}
              placeholder="Название папки..."
              className="bg-transparent border-border"
              autoFocus
            />
            <Button variant="outline" size="sm" onClick={() => { setShowNewFolder(false); setForm(f => ({ ...f, newFolder: "" })); }} className="border-border">
              <X size={13} />
            </Button>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>
          {form.category === "link" ? "URL ссылки *" : "Содержимое"}
        </label>
        {form.category === "link" ? (
          <Input
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="https://..."
            className="bg-transparent border-border"
          />
        ) : (
          <Textarea
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={form.category === "text" ? "Текст объявления, скрипт, описание..." : "URL или описание..."}
            rows={4}
            className="bg-transparent border-border resize-none"
          />
        )}
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Теги</label>
        <div className="flex gap-2 mb-2">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTag()}
            placeholder="Добавить тег..."
            className="bg-transparent border-border"
          />
          <Button variant="outline" onClick={addTag} size="sm">+</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tagsArr.map(tag => (
            <span key={tag} onClick={() => removeTag(tag)}
              className="text-xs px-2.5 py-0.5 rounded-full cursor-pointer"
              style={{ background: "rgba(124,107,255,0.15)", color: "#a78bfa", border: "1px solid rgba(124,107,255,0.3)" }}>
              {tag} ×
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button
          onClick={() => {
            const autoTitle = (!form.title && form.category === "link" && form.content)
              ? (() => { try { return new URL(form.content.startsWith("http") ? form.content : `https://${form.content}`).hostname.replace("www.", ""); } catch { return form.content.substring(0, 40); } })()
              : form.title;
            mutation.mutate({ ...form, title: autoTitle, folderName: finalFolder });
          }}
          disabled={mutation.isPending || (!form.title && form.category !== "link") || (form.category === "link" && !form.content)}
          style={{ background: "var(--color-violet)", color: "white" }}
        >
          {existing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </div>
  );
}

// ── Document Form ─────────────────────────────────────────────────────────────
interface DocumentItem {
  id: number;
  clientId: number;
  title: string;
  docType: string;
  fileUrl?: string;
  yadiskPath?: string;
  publicUrl?: string;
  fileType?: string;
  notes?: string;
  date?: string;
  createdAt?: string;
}

function DocumentForm({ clientId, onClose, prefillFile }: { clientId: number; onClose: () => void; prefillFile?: File }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: prefillFile ? prefillFile.name.replace(/\.[^.]+$/, "") : "",
    docType: "contract",
    fileUrl: "",
    fileType: "file",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-upload prefilled file on mount
  useEffect(() => {
    if (prefillFile) uploadFile(prefillFile);
  }, []);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: "POST",
        headers: getAuthHeader(),
        body: fd,
      });
      const data = await res.json();
      if (data.fileUrl) {
        setUploadedFile({ name: file.name, url: data.fileUrl });
        setForm(f => ({
          ...f,
          fileUrl: data.fileUrl,
          title: f.title || file.name.replace(/\.[^.]+$/, ""),
          fileType: file.type.startsWith("image/") ? "image" : "file",
        }));
      }
    } catch {
      toast({ title: "Ошибка загрузки файла", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/documents", { ...d, clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      toast({ title: "Документ добавлен" });
      onClose();
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {/* File drop zone */}
      <div
        className="rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? "#7c6bff" : "#252840",
          background: dragOver ? "#7c6bff15" : "#131520",
          color: "#64748b",
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) uploadFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        />
        {uploading ? (
          <p className="text-sm">Загружаем файл...</p>
        ) : uploadedFile ? (
          <p className="text-sm" style={{ color: "#4ade80" }}>✓ {uploadedFile.name}</p>
        ) : (
          <>
            <Upload size={22} className="mx-auto mb-2" style={{ color: "#475569" }} />
            <p className="text-sm">Перетащите файл или нажмите для выбора</p>
            <p className="text-xs mt-1">PDF, Word, изображения до 20 МБ</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Название *</label>
          <Input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Договор №123"
            className="bg-transparent border-border"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Тип документа</label>
          <Select value={form.docType} onValueChange={v => setForm(f => ({ ...f, docType: v }))}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата</label>
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-transparent border-border" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Заметки</label>
        <Textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2}
          placeholder="Доп. информация..."
          className="bg-transparent border-border resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.title || uploading}
          style={{ background: "#22d3ee", color: "#0f172a" }}
        >
          {mutation.isPending ? "Сохраняем..." : "Добавить"}
        </Button>
      </div>
    </div>
  );
}

// ── Report Form ────────────────────────────────────────────────────────────────
function ReportForm({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    impressions: 0, clicks: 0, calls: 0, messages: 0, deals: 0, adSpend: 0, notes: "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const mutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/reports", { ...d, clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "reports"] });
      toast({ title: "Отчёт добавлен" });
      onClose();
    },
  });
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Период</label>
        <Input type="month" value={form.period} onChange={e => set("period", e.target.value)} className="bg-transparent border-border" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["impressions", "Показы"], ["clicks", "Клики"], ["calls", "Звонки"],
          ["messages", "Сообщения"], ["deals", "Сделки"], ["adSpend", "Расход ₽"],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>{label}</label>
            <Input
              type="number"
              value={(form as any)[k]}
              onChange={e => set(k, Number(e.target.value))}
              className="bg-transparent border-border"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Заметки</label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className="bg-transparent border-border resize-none" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} style={{ background: "#22d3ee", color: "#0f172a" }}>
          Сохранить отчёт
        </Button>
      </div>
    </div>
  );
}

// ── Reminder Form with recurrence ────────────────────────────────────────────
function ReminderForm({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", description: "", dueDate: "", type: "general", priority: "medium",
    recurrence: "none", recurrenceEnd: "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/reminders", { ...d, clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Задача создана" + (form.recurrence !== "none" ? " (с повторением)" : "") });
      onClose();
    },
  });

  const recurrenceLabels: Record<string, string> = {
    none: "Без повторения",
    daily: "Ежедневно",
    weekly: "Еженедельно",
    monthly: "Ежемесячно",
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Название *</label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Отправить отчёт" className="bg-transparent border-border" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата начала</label>
          <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Тип</label>
          <Select value={form.type} onValueChange={v => set("type", v)}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="report">Отчёт</SelectItem>
              <SelectItem value="payment">Оплата</SelectItem>
              <SelectItem value="renewal">Продление</SelectItem>
              <SelectItem value="task">Задача</SelectItem>
              <SelectItem value="general">Общее</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Приоритет</label>
          <Select value={form.priority} onValueChange={v => set("priority", v)}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">Высокий</SelectItem>
              <SelectItem value="medium">Средний</SelectItem>
              <SelectItem value="low">Низкий</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recurrence */}
      <div
        className="rounded-xl p-3 flex flex-col gap-3"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <RotateCcw size={13} style={{ color: "#7c6bff" }} />
          <span className="text-xs font-semibold" style={{ color: "#e2e8f0" }}>Повторение</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(recurrenceLabels).map(([val, label]) => (
            <button
              key={val}
              onClick={() => set("recurrence", val)}
              className="text-xs px-2 py-1.5 rounded-lg transition-all text-center"
              style={{
                background: form.recurrence === val ? "rgba(124,107,255,0.2)" : "transparent",
                border: `1px solid ${form.recurrence === val ? "rgba(124,107,255,0.5)" : "var(--color-border)"}`,
                color: form.recurrence === val ? "#a78bfa" : "#64748b",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {form.recurrence !== "none" && (
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата окончания (необяз.)</label>
            <Input type="date" value={form.recurrenceEnd} onChange={e => set("recurrenceEnd", e.target.value)} className="bg-transparent border-border" />
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Описание</label>
        <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="bg-transparent border-border resize-none" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.title || !form.dueDate}
          style={{ background: "#fbbf24", color: "#0f172a" }}
        >
          Создать
        </Button>
      </div>
    </div>
  );
}

// ── Client Edit Form ──────────────────────────────────────────────────────────
// ── TaskSubTabs: подвкладки внутри раздела «Задачи» ─────────────────────────
type SubTab = "technical" | "financial" | "all";

function TaskSubTabs({
  reminders,
  onAdd,
  onSelect,
}: {
  reminders: any[];
  onAdd: () => void;
  onSelect: (r: any) => void;
}) {
  const [sub, setSub] = useState<SubTab>("technical");

  const financial = reminders.filter(r => r.type === "payment");
  const technical = reminders.filter(r => r.type !== "payment");
  const all = [...reminders];

  const tabs: { id: SubTab; label: string; items: any[]; color: string; activeColor: string }[] = [
    { id: "technical", label: "Технические", items: technical, color: "rgba(124,107,255,0.15)", activeColor: "#a78bfa" },
    { id: "financial", label: "Финансовые",  items: financial, color: "rgba(251,191,36,0.15)",  activeColor: "#fbbf24" },
    { id: "all",       label: "Все",          items: all,       color: "rgba(34,211,238,0.1)",   activeColor: "#22d3ee" },
  ];

  const currentTab = tabs.find(t => t.id === sub)!;
  const visibleItems = [...currentTab.items].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const recurrenceLabel: Record<string, string> = { daily: "Ежедн.", weekly: "Еженед.", monthly: "Ежемес." };
  const priorityColor: Record<string, string> = { high: "#f87171", medium: "#fbbf24", low: "#4ade80" };
  const typeLabel: Record<string, string> = { report: "Отчёт", payment: "Оплата", renewal: "Продление", task: "Задача", general: "Общее", call: "Звонок" };

  return (
    <div>
      {/* Шапка подвкладок + кнопка добавить */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: sub === t.id ? t.color : "transparent",
                color: sub === t.id ? t.activeColor : "#64748b",
                border: sub === t.id ? `1px solid ${t.activeColor}40` : "1px solid transparent",
              }}
            >
              {t.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: sub === t.id ? `${t.activeColor}25` : "rgba(100,116,139,0.15)",
                  color: sub === t.id ? t.activeColor : "#475569",
                }}
              >
                {t.items.length}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={onAdd} style={{ background: "#fbbf24", color: "#0f172a" }} className="gap-2">
          <Bell size={15} /> Добавить задачу
        </Button>
      </div>

      {/* Пояснительная строчка для Финансовых */}
      {sub === "financial" && (
        <div
          className="rounded-xl px-4 py-2.5 mb-3 text-xs flex items-center gap-2"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#94a3b8" }}
        >
          <span style={{ color: "#fbbf24" }}>ℹ️</span>
          Запланированные и выполненные задачи типа «Оплата»
        </div>
      )}

      {/* Список задач */}
      <div className="flex flex-col gap-2">
        {visibleItems.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#475569" }}
          >
            <Bell size={36} className="mx-auto mb-3" style={{ color: "#334155" }} />
            {sub === "technical" && "Технических задач пока нет"}
            {sub === "financial" && "Финансовых задач пока нет — выберите тип «Оплата» при создании"}
            {sub === "all" && "Добавьте задачи и напоминания по этому клиенту"}
          </div>
        ) : (
          visibleItems.map(r => {
            const todayStr = new Date().toISOString().split("T")[0];
            const isOverdue = r.dueDate < todayStr && !r.isDone;
            const isFinancial = r.type === "payment";
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:border-violet-500/40"
                style={{
                  background: "var(--color-surface)",
                  border: `1px solid ${isOverdue && !r.isDone ? "rgba(248,113,113,0.3)" : isFinancial ? "rgba(251,191,36,0.15)" : "var(--color-border)"}`,
                  opacity: r.isDone ? 0.55 : 1,
                }}
                onClick={() => onSelect(r)}
                data-testid={`card-reminder-${r.id}`}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: priorityColor[r.priority || "medium"] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div
                      className="text-sm font-medium"
                      style={{ color: r.isDone ? "#475569" : "#e2e8f0", textDecoration: r.isDone ? "line-through" : "none" }}
                    >
                      {r.title}
                    </div>
                    {/* Бедж типа — только во вкладке «Все» */}
                    {sub === "all" && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                        style={{
                          background: isFinancial ? "rgba(251,191,36,0.12)" : "rgba(124,107,255,0.12)",
                          color: isFinancial ? "#fbbf24" : "#a78bfa",
                        }}
                      >
                        {typeLabel[r.type] || r.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "#64748b" }}>
                    <span>{new Date(r.dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                    {r.recurrence && r.recurrence !== "none" && (
                      <span className="flex items-center gap-1" style={{ color: "#7c6bff" }}>
                        <RotateCcw size={10} />
                        {recurrenceLabel[r.recurrence] || r.recurrence}
                      </span>
                    )}
                    {isOverdue && !r.isDone && <span style={{ color: "#f87171" }}>просрочено</span>}
                    {r.isDone && <span style={{ color: "#4ade80" }}>выполнено</span>}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "#334155" }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ClientEditForm({ client, onClose }: { client: Client; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: client.name,
    phone: client.phone ?? "",
    telegram: client.telegram ?? "",
    email: client.email ?? "",
    niche: client.niche ?? "",
    city: client.city ?? "",
    status: client.status,
    monthlyFee: client.monthlyFee ?? "",
    startDate: client.startDate ?? "",
    nextPaymentDate: (client as any).nextPaymentDate ?? "",
    notes: client.notes ?? "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d: any) => apiRequest("PATCH", `/api/clients/${client.id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Клиент обновлён" });
      onClose();
    },
  });

  const STATUS_OPTS = [
    { value: "active", label: "Активный" },
    { value: "paused", label: "На паузе" },
    { value: "finished", label: "Завершён" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Имя / Компания</label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Телефон</label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Telegram</label>
          <Input value={form.telegram} onChange={e => set("telegram", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Email</label>
          <Input value={form.email} onChange={e => set("email", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Ниша</label>
          <Input value={form.niche} onChange={e => set("niche", e.target.value)} placeholder="Клининг, авто, ремонт..." className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Город</label>
          <Input value={form.city} onChange={e => set("city", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Статус</label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Абонентка ₽/мес</label>
          <Input
            type="number"
            value={form.monthlyFee}
            onChange={e => set("monthlyFee", e.target.value ? Number(e.target.value) : "")}
            className="bg-transparent border-border"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата начала</label>
          <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className="bg-transparent border-border" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>
            <Calendar size={11} className="inline mr-1" />
            Дата ближ. платежа
          </label>
          <Input type="date" value={form.nextPaymentDate} onChange={e => set("nextPaymentDate", e.target.value)} className="bg-transparent border-border" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Заметки</label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className="bg-transparent border-border resize-none" />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} style={{ background: "var(--color-violet)", color: "white" }}>
          {mutation.isPending ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [matDialog, setMatDialog] = useState<"new" | Material | null>(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [reminderDialog, setReminderDialog] = useState(false);
  const [docDialog, setDocDialog] = useState(false);
  const [activeClientTab, setActiveClientTab] = useState("reminders");
  const [docDropFile, setDocDropFile] = useState<File | undefined>(undefined);
  const [docZoneDrag, setDocZoneDrag] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [reschedulePayment, setReschedulePayment] = useState<Payment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [matCategory, setMatCategory] = useState("all");
  const [matFolder, setMatFolder] = useState<string | null>(null); // null = all folders
  const [newFolderInput, setNewFolderInput] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [matViewMode, setMatViewMode] = useState<"grid" | "list">("grid");
  const [previewMat, setPreviewMat] = useState<Material | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Avito API state
  const [avitoApiForm, setAvitoApiForm] = useState(false);
  const [avitoFormData, setAvitoFormData] = useState({ avitoClientId: "", avitoClientSecret: "", avitoUserId: "" });
  const [avitoFetching, setAvitoFetching] = useState(false);
  const [avitoFetchDays, setAvitoFetchDays] = useState(30);
  const [avitoSelectedItem, setAvitoSelectedItem] = useState<string | null>(null);
  const [avitoSortBy, setAvitoSortBy] = useState<"views" | "contacts" | "favorites">("views");
  const [avitoDateFrom, setAvitoDateFrom] = useState("");
  const [avitoDateTo, setAvitoDateTo] = useState("");

  // Payment schedule form state
  const [schedForm, setSchedForm] = useState({
    billingScheme: "monthly",
    startDate: new Date().toISOString().split("T")[0],
    monthlyAmount: "",
    secondDayOfMonth: 15,
  });

  const { data: client, isLoading } = useQuery<Client>({ queryKey: ["/api/clients", clientId] });
  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/clients", clientId, "materials"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/materials`).then(r => r.json()),
  });
  // Создать папку (пустой material-placeholder)
  const createFolder = useMutation({
    mutationFn: (folderName: string) =>
      apiRequest("POST", "/api/materials", {
        clientId,
        title: folderName,
        category: "folder",
        content: "",
        tags: "[]",
        folderName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: (_, folderName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] });
      setShowNewFolderInput(false);
      setNewFolderInput("");
      setMatFolder(folderName);
    },
  });

  // Переместить материал в папку
  const moveToFolder = useMutation({
    mutationFn: ({ id, folderName }: { id: number; folderName: string | null }) =>
      apiRequest("PATCH", `/api/materials/${id}`, { folderName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "folders"] });
    },
  });

  const { data: folders = [] } = useQuery<string[]>({
    queryKey: ["/api/clients", clientId, "folders"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/folders`).then(r => r.json()),
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments", clientId],
    queryFn: () => apiRequest("GET", `/api/payments?clientId=${clientId}`).then(r => r.json()),
  });
  const { data: schedules = [] } = useQuery<PaymentSchedule[]>({
    queryKey: ["/api/clients", clientId, "schedules"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/schedules`).then(r => r.json()),
  });
  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ["/api/clients", clientId, "reports"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/reports`).then(r => r.json()),
  });
  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: ["/api/clients", clientId, "documents"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/documents`).then(r => r.json()),
  });
  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });
  const clientReminders = reminders.filter(r => r.clientId === clientId);
  const activeSchedule = schedules.find(s => s.isActive);

  // Avito queries
  const { data: avitoConnection, refetch: refetchAvitoConn } = useQuery<any>({
    queryKey: [`/api/avito/${clientId}/connection`],
  });
  const { data: avitoStats = [], refetch: refetchAvitoStats } = useQuery<any[]>({
    queryKey: [`/api/avito/${clientId}/stats`],
  });

  const deleteMaterial = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/materials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] }),
  });

  const pinMaterial = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => apiRequest("PATCH", `/api/materials/${id}`, { isPinned: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] }),
  });

  const renameMaterial = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => apiRequest("PATCH", `/api/materials/${id}`, { title, updatedAt: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] }),
  });

  const uploadFiles = async (files: ProcessedFile[]) => {
    setUploadingFiles(true);
    const now = new Date().toISOString();
    try {
      for (const f of files) {
        await apiRequest("POST", "/api/materials", {
          clientId,
          title: f.title,
          category: f.category,
          content: f.content,
          mimeType: f.mimeType,
          fileName: f.fileName,
          folderName: f.folderName || matFolder || null,
          tags: "[]",
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "folders"] });
      toast({ title: `${files.length === 1 ? "Файл загружен" : `${files.length} файлов загружено`}` });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploadingFiles(false);
    }
  };

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/payments/${id}/pay`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Оплата подтверждена" });
    },
  });

  const reschedulePaymentMutation = useMutation({
    mutationFn: ({ id, newDate }: { id: number; newDate: string }) =>
      apiRequest("PATCH", `/api/payments/${id}/reschedule`, { newDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setReschedulePayment(null);
      setRescheduleDate("");
      toast({ title: "Срок перенесён, напоминание обновлено" });
    },
  });

  const createSchedule = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment-schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setScheduleDialog(false);
      toast({ title: "Схема оплаты запущена" });
    },
  });

  const deactivateSchedule = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payment-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Схема деактивирована", description: "Будущие плановые платежи удалены" });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] }),
  });

  const doneReminder = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/reminders/${id}`, { isDone: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reminders"] }),
  });

  const [payForm, setPayForm] = useState({
    amount: "", date: new Date().toISOString().split("T")[0], type: "income", description: "",
  });
  const addPayment = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payments", { ...payForm, amount: Number(payForm.amount), clientId, isPaid: true, isPlanned: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setPayForm({ amount: "", date: new Date().toISOString().split("T")[0], type: "income", description: "" });
      toast({ title: "Платёж добавлен" });
    },
  });

  if (isLoading) return <div className="p-6" style={{ color: "#64748b" }}>Загрузка...</div>;
  if (!client) return <div className="p-6" style={{ color: "#94a3b8" }}>Клиент не найден</div>;

  const totalIncome = payments.filter(p => p.type === "income" && p.isPaid).reduce((s, p) => s + p.amount, 0);
  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    active:   { bg: "rgba(74,222,128,0.15)",  color: "#4ade80", label: "Активный" },
    paused:   { bg: "rgba(251,191,36,0.15)",   color: "#fbbf24", label: "Пауза" },
    finished: { bg: "rgba(148,163,184,0.15)",  color: "#94a3b8", label: "Завершён" },
  };
  const st = statusColors[client.status] || statusColors.active;
  const nextPaymentDate = (client as any).nextPaymentDate;

  // Filter materials by category AND folder
  const filteredMaterials = materials
    .filter(m => matCategory === "all" || ((m as any).category || m.type) === matCategory)
    .filter(m => matFolder === null || (m as any).folderName === matFolder)
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  return (
    <div className="p-6 max-w-6xl">
      {/* Back + Header */}
      <button onClick={() => navigate("/clients")} className="flex items-center gap-2 text-sm mb-5 transition-colors hover:text-violet-400" style={{ color: "#64748b" }}>
        <ArrowLeft size={16} /> Все клиенты
      </button>

      {/* Client card */}
      <div
        className="rounded-2xl p-6 mb-6 flex flex-wrap gap-6 items-start"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ background: client.avatarColor || "#7c6bff", color: "white" }}
        >
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>{client.name}</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            {client.niche && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(124,107,255,0.12)", color: "#a78bfa" }}>
                {client.niche}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "#64748b" }}>
            {client.city && <span className="flex items-center gap-1"><MapPin size={12} />{client.city}</span>}
            {client.phone && <span className="flex items-center gap-1"><Phone size={12} />{client.phone}</span>}
            {client.telegram && <span className="flex items-center gap-1"><MessageCircle size={12} />{client.telegram}</span>}
            {client.email && <span className="flex items-center gap-1"><Mail size={12} />{client.email}</span>}
          </div>
          {client.notes && <p className="text-sm mt-2" style={{ color: "#94a3b8" }}>{client.notes}</p>}
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialog(true)}
            className="gap-1.5 border-border text-xs"
          >
            <Edit2 size={12} /> Редактировать
          </Button>
          {client.monthlyFee && (
            <div className="font-bold text-lg" style={{ color: "#22d3ee" }}>
              {client.monthlyFee.toLocaleString("ru-RU")} ₽/мес
            </div>
          )}
          {nextPaymentDate && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#fb923c" }}>
              <Calendar size={12} />
              Платёж: {new Date(nextPaymentDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </div>
          )}
          <div className="text-sm" style={{ color: "#64748b" }}>
            Получено: <span style={{ color: "#4ade80" }}>{totalIncome.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeClientTab} onValueChange={setActiveClientTab}>
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { value: "reminders", label: "Задачи", count: clientReminders.length, icon: CheckCircle2, color: "#a78bfa", bg: "rgba(124,107,255,0.12)" },
            { value: "materials", label: "Наработки", count: materials.length, icon: FolderOpen, color: "#22d3ee", bg: "rgba(34,211,238,0.1)" },
            { value: "payments", label: "Финансы", count: payments.length, icon: TrendingUp, color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
            { value: "reports", label: "Отчёты", count: reports.length, icon: BarChart2, color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
            { value: "documents", label: "Документы", count: documents.length, icon: FileText, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
          ] as const).map(tab => {
            const Icon = tab.icon;
            const isActive = activeClientTab === tab.value;
            return (
              <button
                key={tab.value}
                data-testid={`tab-${tab.value}`}
                onClick={() => setActiveClientTab(tab.value as any)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all flex-1 min-w-[120px]"
                style={{
                  background: isActive ? tab.bg : "var(--color-surface)",
                  border: `1px solid ${isActive ? tab.color + "50" : "var(--color-border)"}`,
                  boxShadow: isActive ? `0 0 12px ${tab.color}20` : "none",
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: isActive ? tab.color + "25" : "rgba(255,255,255,0.04)" }}>
                  <Icon size={18} style={{ color: isActive ? tab.color : "#475569" }} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold" style={{ color: isActive ? tab.color : "#94a3b8" }}>{tab.label}</div>
                  <div className="text-lg font-bold leading-tight" style={{ color: isActive ? "#e2e8f0" : "#64748b" }}>{tab.count}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── MATERIALS ── */}
        <TabsContent value="materials">
          {/* Row 1: category filters + view toggle + add button */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex gap-1.5 flex-wrap items-center">
              {/* When a folder is selected — show folder name as breadcrumb + category tabs */}
              {matFolder !== null && (
                <div className="flex items-center gap-2 mr-1">
                  <button
                    onClick={() => setMatFolder(null)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ color: "#64748b", border: "1px solid var(--color-border)" }}
                  >
                    <FolderOpen size={11} /> Все
                  </button>
                  <span style={{ color: "#334155" }}>/</span>
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                    <Folder size={11} /> {matFolder}
                  </span>
                  <span style={{ color: "#334155" }}>·</span>
                </div>
              )}
              {CATEGORIES.map(cat => {
                const folderMats = matFolder !== null
                  ? materials.filter(m => (m as any).folderName === matFolder)
                  : materials;
                const count = cat.value === "all"
                  ? folderMats.length
                  : folderMats.filter(m => ((m as any).category || m.type) === cat.value).length;
                return (
                  <button key={cat.value} onClick={() => setMatCategory(cat.value)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: matCategory === cat.value ? `${cat.color}20` : "transparent",
                      border: `1px solid ${matCategory === cat.value ? `${cat.color}50` : "var(--color-border)"}`,
                      color: matCategory === cat.value ? cat.color : "#64748b",
                    }}>
                    {cat.icon && <cat.icon size={11} />}
                    {cat.label}
                    {count > 0 && (
                      <span className="text-xs px-1.5 rounded-full font-medium"
                        style={{ background: `${cat.color}20`, color: cat.color, fontSize: "10px" }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              {/* Grid/List toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                <button onClick={() => setMatViewMode("grid")}
                  className="px-2.5 py-1.5 transition-colors"
                  style={{ background: matViewMode === "grid" ? "rgba(124,107,255,0.2)" : "transparent", color: matViewMode === "grid" ? "#a78bfa" : "#475569" }}>
                  <Grid2X2 size={13} />
                </button>
                <button onClick={() => setMatViewMode("list")}
                  className="px-2.5 py-1.5 transition-colors"
                  style={{ background: matViewMode === "list" ? "rgba(124,107,255,0.2)" : "transparent", color: matViewMode === "list" ? "#a78bfa" : "#475569" }}>
                  <List size={13} />
                </button>
              </div>
              <Button onClick={() => setMatDialog("new")} style={{ background: "var(--color-violet)", color: "white" }} className="gap-1.5" size="sm">
                <Plus size={14} /> Добавить
              </Button>
            </div>
          </div>

          {/* Row 2: Folders sidebar + main content */}
          <div className="flex gap-4">
            {/* Folder sidebar */}
            <div className="w-44 shrink-0 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold" style={{ color: "#475569" }}>ПАПКИ</span>
                <button
                  onClick={() => setShowNewFolderInput(v => !v)}
                  title="Создать папку"
                  className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-white/10"
                  style={{ color: "#7c6bff" }}
                >
                  <FolderPlus size={13} />
                </button>
              </div>
              {/* Инлайн создание папки */}
              {showNewFolderInput && (
                <div className="flex gap-1 mb-1">
                  <input
                    autoFocus
                    value={newFolderInput}
                    onChange={e => setNewFolderInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newFolderInput.trim()) createFolder.mutate(newFolderInput.trim());
                      if (e.key === "Escape") { setShowNewFolderInput(false); setNewFolderInput(""); }
                    }}
                    placeholder="Название..."
                    className="flex-1 text-xs px-2 py-1 rounded-lg outline-none"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
                  />
                  <button
                    onClick={() => { if (newFolderInput.trim()) createFolder.mutate(newFolderInput.trim()); }}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ background: "rgba(124,107,255,0.2)", color: "#a78bfa" }}
                  >
                    ✓
                  </button>
                </div>
              )}
              <button
                onClick={() => { setMatFolder(null); setMatCategory("all"); }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const id = Number(e.dataTransfer.getData("materialId"));
                  if (id) moveToFolder.mutate({ id, folderName: null });
                  setDragOverFolder(undefined as any);
                }}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors text-left w-full"
                style={{
                  background: matFolder === null ? "rgba(124,107,255,0.15)" : "transparent",
                  color: matFolder === null ? "#a78bfa" : "#64748b",
                  border: `1px solid ${matFolder === null ? "rgba(124,107,255,0.3)" : "transparent"}`,
                }}>
                <FolderOpen size={13} /> Все ({materials.length})
              </button>
              {folders.map(folder => {
                const cnt = materials.filter(m => (m as any).folderName === folder).length;
                const isDragTarget = dragOverFolder === folder;
                return (
                  <button key={folder} onClick={() => { setMatFolder(folder); setMatCategory("all"); }}
                    onDragOver={e => { e.preventDefault(); setDragOverFolder(folder); }}
                    onDragLeave={() => setDragOverFolder(null)}
                    onDrop={e => {
                      e.preventDefault();
                      const id = Number(e.dataTransfer.getData("materialId"));
                      if (id) moveToFolder.mutate({ id, folderName: folder });
                      setDragOverFolder(null);
                    }}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all text-left w-full"
                    style={{
                      background: isDragTarget ? "rgba(34,211,238,0.2)" : matFolder === folder ? "rgba(251,191,36,0.15)" : "transparent",
                      color: isDragTarget ? "#22d3ee" : matFolder === folder ? "#fbbf24" : "#64748b",
                      border: `1px solid ${isDragTarget ? "rgba(34,211,238,0.5)" : matFolder === folder ? "rgba(251,191,36,0.3)" : "transparent"}`,
                      transform: isDragTarget ? "scale(1.02)" : "scale(1)",
                    }}>
                    <Folder size={13} /> <span className="truncate flex-1">{folder}</span>
                    <span className="text-xs" style={{ color: "#475569" }}>{cnt}</span>
                  </button>
                );
              })}
            </div>

            {/* Main area */}
            <div className="flex-1 min-w-0">
              {/* Drop zone */}
              <div className="mb-3">
                {uploadingFiles ? (
                  <div className="rounded-xl py-4 text-center text-xs" style={{ border: "2px dashed rgba(124,107,255,0.25)", background: "rgba(124,107,255,0.05)", color: "#7c6bff" }}>
                    Загрузка...
                  </div>
                ) : (
                  <DropZone onFiles={uploadFiles} category={matCategory} folderName={matFolder ?? undefined} />
                )}
              </div>

              {/* Material grid/list */}
              {filteredMaterials.length === 0 ? (
                <div className="rounded-xl p-10 text-center text-sm"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#475569" }}>
                  {matCategory === "all" ? "Перетащите файлы или нажмите «Добавить»" : "Нет материалов"}
                </div>
              ) : matViewMode === "grid" ? (
                // GRID VIEW — images as thumbnails, others as cards
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredMaterials.map(m => {
                    const tags: string[] = (() => { try { return JSON.parse(m.tags || "[]"); } catch { return []; } })();
                    const cat = (m as any).category || m.type || "text";
                    const mime = (m as any).mimeType;
                    const imgSrc = isImage(mime, m.content) ? m.content : null;
                    return (
                      <div key={m.id}
                        className="rounded-xl overflow-hidden group relative"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", cursor: "grab" }}
                        data-testid={`card-material-${m.id}`}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData("materialId", String(m.id));
                          e.dataTransfer.effectAllowed = "move";
                        }}>
                        {/* Image thumbnail */}
                        {imgSrc ? (
                          <div className="relative aspect-square overflow-hidden bg-black/20">
                            <img src={imgSrc} alt={m.title}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button onClick={() => setPreviewMat(m)}
                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40">
                                <Eye size={14} style={{ color: "white" }} />
                              </button>
                              <button onClick={() => setMatDialog(m)}
                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40">
                                <Edit2 size={14} style={{ color: "white" }} />
                              </button>
                              <button onClick={() => deleteMaterial.mutate(m.id)}
                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-red-500/60">
                                <Trash2 size={14} style={{ color: "white" }} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Non-image: text preview or icon card
                          <div
                            className="aspect-square flex flex-col overflow-hidden cursor-pointer"
                            style={{ background: `${catColor[cat] || "#7c6bff"}08` }}
                            onClick={() => setPreviewMat(m)}
                          >
                            {(cat === "text" || (m as any).mimeType === "text/plain" || (m as any).mimeType?.includes("word")) && m.content && !m.content.startsWith("data:") ? (
                              // Text preview
                              <div className="flex-1 p-3 overflow-hidden relative">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <FileText size={12} style={{ color: catColor[cat] || "#7c6bff" }} />
                                  <span className="text-xs font-medium" style={{ color: catColor[cat] || "#7c6bff" }}>
                                    {(m as any).mimeType?.includes("word") ? "Word" : "TXT"}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: "#94a3b8", fontSize: "11px" }}>
                                  {m.content.slice(0, 300)}
                                </p>
                                {/* fade bottom */}
                                <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                                  style={{ background: `linear-gradient(transparent, ${catColor[cat] || "#7c6bff"}15)` }} />
                              </div>
                            ) : cat === "link" && m.content ? (
                              <a
                                href={m.content.startsWith("http") ? m.content : `https://${m.content}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex-1 flex flex-col items-start justify-between p-3 gap-2 hover:opacity-80 transition-opacity"
                                title={m.content}
                              >
                                {/* favicon + domain */}
                                <div className="flex items-center gap-2 w-full">
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(m.content.startsWith("http") ? m.content : `https://${m.content}`).hostname; } catch { return m.content; } })()}&sz=32`}
                                    alt=""
                                    className="w-5 h-5 rounded shrink-0"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                  <span className="text-xs truncate font-medium" style={{ color: "#22d3ee" }}>
                                    {(() => { try { return new URL(m.content.startsWith("http") ? m.content : `https://${m.content}`).hostname.replace("www.",""); } catch { return m.content.substring(0,30); } })()}
                                  </span>
                                </div>
                                {/* URL preview */}
                                <span className="text-xs w-full truncate" style={{ color: "#475569" }}>{m.content.substring(0, 60)}</span>
                                {/* click hint */}
                                <div className="flex items-center gap-1 text-xs" style={{ color: "#22d3ee" }}>
                                  <ExternalLink size={10} /> Открыть
                                </div>
                              </a>
                            ) : (cat === "video" && m.content && (m.content.startsWith("/uploads/") || m.content.startsWith("http"))) ? (
                              // Video thumbnail card
                              <div className="relative aspect-square overflow-hidden bg-black/40 flex items-center justify-center">
                                <video
                                  src={m.content.startsWith("/uploads/") ? `${API_BASE}${m.content}` : m.content}
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                  muted
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <Video size={18} style={{ color: "white" }} />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 flex items-center justify-center">
                                <span style={{ color: catColor[cat] || "#7c6bff", transform: "scale(2)" }}>{catIcon(cat)}</span>
                              </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); setMatDialog(m); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ background: "var(--color-surface-2)" }}>
                                <Edit2 size={11} style={{ color: "#94a3b8" }} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteMaterial.mutate(m.id); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/20"
                                style={{ background: "var(--color-surface-2)" }}>
                                <Trash2 size={11} style={{ color: "#94a3b8" }} />
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Card footer */}
                        <div className="px-2.5 py-2">
                          <InlineTitle
                            value={m.title}
                            onSave={title => renameMaterial.mutate({ id: m.id, title })}
                            className="text-xs font-medium block truncate"
                            style={{ color: "#e2e8f0" }}
                          />
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs" style={{ color: catColor[cat] || "#7c6bff" }}>
                              {CATEGORIES.find(c => c.value === cat)?.label || cat}
                            </span>
                            {(m as any).folderName && (
                              <span className="text-xs flex items-center gap-0.5" style={{ color: "#475569" }}>
                                <Folder size={9} /> {(m as any).folderName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // LIST VIEW
                <div className="flex flex-col gap-2">
                  {filteredMaterials.map(m => {
                    const tags: string[] = (() => { try { return JSON.parse(m.tags || "[]"); } catch { return []; } })();
                    const cat = (m as any).category || m.type || "text";
                    const mime = (m as any).mimeType;
                    const imgSrc = isImage(mime, m.content) ? m.content : null;
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", cursor: "grab" }}
                        data-testid={`card-material-${m.id}`}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData("materialId", String(m.id));
                          e.dataTransfer.effectAllowed = "move";
                        }}>
                        {imgSrc ? (
                          <img src={imgSrc} alt={m.title}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 cursor-pointer"
                            onClick={() => setPreviewMat(m)} />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${catColor[cat] || "#7c6bff"}15` }}>
                            <span style={{ color: catColor[cat] || "#7c6bff" }}>{catIcon(cat)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <InlineTitle
                            value={m.title}
                            onSave={title => renameMaterial.mutate({ id: m.id, title })}
                            className="font-medium text-sm block truncate"
                            style={{ color: "#e2e8f0" }}
                          />
                          <div className="flex items-center gap-2 text-xs" style={{ color: "#64748b" }}>
                            <span style={{ color: catColor[cat] || "#7c6bff" }}>{CATEGORIES.find(c => c.value === cat)?.label || cat}</span>
                            {(m as any).folderName && <span className="flex items-center gap-0.5"><Folder size={9} />{(m as any).folderName}</span>}
                          </div>
                          {m.content && !imgSrc && (
                            cat === "link" ? (
                              <a
                                href={m.content.startsWith("http") ? m.content : `https://${m.content}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-xs truncate mt-0.5 block hover:underline"
                                style={{ color: "#22d3ee" }}
                                title={m.content}
                              >{m.content.substring(0, 80)}</a>
                            ) : (
                              <p className="text-xs truncate mt-0.5" style={{ color: "#475569" }}>{m.content.substring(0, 80)}</p>
                            )
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.map(tag => (
                                <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: "rgba(124,107,255,0.1)", color: "#7c6bff" }}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => pinMaterial.mutate({ id: m.id, val: !m.isPinned })}>
                            <Pin size={13} style={{ color: m.isPinned ? "#fbbf24" : "#334155" }} />
                          </button>
                          <button onClick={() => setMatDialog(m)}>
                            <Edit2 size={13} style={{ color: "#334155" }} className="hover:text-violet-400" />
                          </button>
                          <button onClick={() => deleteMaterial.mutate(m.id)}>
                            <Trash2 size={13} style={{ color: "#334155" }} className="hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Material form dialog */}
          <Dialog open={!!matDialog} onOpenChange={v => !v && setMatDialog(null)}>
            <DialogContent className="max-w-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <DialogHeader>
                <DialogTitle style={{ color: "#e2e8f0" }}>{matDialog === "new" ? "Новая наработка" : "Редактировать"}</DialogTitle>
              </DialogHeader>
              {matDialog !== null && (
                <MaterialForm
                  clientId={clientId}
                  onClose={() => setMatDialog(null)}
                  existing={matDialog !== "new" ? matDialog : undefined}
                  folders={folders}
                  defaultCategory={matCategory !== "all" ? matCategory : undefined}
                  defaultFolder={matFolder ?? undefined}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Preview dialog */}
          <Dialog open={!!previewMat} onOpenChange={v => !v && setPreviewMat(null)}>
            <DialogContent className="max-w-3xl" style={{ background: "#0d0f1a", border: "1px solid var(--color-border)" }}>
              {previewMat && (() => {
                const pCat = (previewMat as any).category || previewMat.type;
                const pMime = (previewMat as any).mimeType || "";
                const isText = (pCat === "text" || pMime === "text/plain" || pMime.includes("word")) && previewMat.content && !previewMat.content.startsWith("data:");
                const isImg = isImage(pMime, previewMat.content);
                const isVid = pCat === "video" && previewMat.content && (previewMat.content.startsWith("/uploads/") || previewMat.content.startsWith("http"));
                const videoSrc = isVid ? (previewMat.content!.startsWith("/uploads/") ? `${API_BASE}${previewMat.content}` : previewMat.content!) : "";
                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{previewMat.title}</div>
                      {isText && (
                        <button
                          onClick={() => {
                            const blob = new Blob([previewMat.content || ""], { type: "text/plain" });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = previewMat.title + ".txt";
                            a.click();
                          }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(124,107,255,0.15)", color: "#a78bfa", border: "1px solid rgba(124,107,255,0.3)" }}
                        >
                          <ExternalLink size={11} /> Скачать TXT
                        </button>
                      )}
                      {isVid && (
                        <a
                          href={videoSrc}
                          download
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(244,114,182,0.15)", color: "#f472b6", border: "1px solid rgba(244,114,182,0.3)" }}
                        >
                          <ExternalLink size={11} /> Скачать
                        </a>
                      )}
                    </div>
                    {isImg ? (
                      <img src={previewMat.content!} alt={previewMat.title} className="rounded-xl max-h-[70vh] object-contain w-full" />
                    ) : isVid ? (
                      <video
                        src={videoSrc}
                        controls
                        className="rounded-xl w-full max-h-[70vh]"
                        style={{ background: "#000" }}
                      />
                    ) : isText ? (
                      <div className="rounded-xl p-5 overflow-y-auto max-h-[65vh]"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#cbd5e1" }}>
                          {previewMat.content}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl p-8 text-center" style={{ background: "var(--color-surface)" }}>
                        <p className="text-sm" style={{ color: "#94a3b8" }}>Превью недоступен для этого типа файла</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── PAYMENTS (Finance) ── */}
        <TabsContent value="payments">
          {/* Schedule banner */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Zap size={16} style={{ color: "#7c6bff" }} />
                <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>Схема автооплат</span>
                {activeSchedule ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>Активна</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(148,163,184,0.1)", color: "#64748b" }}>Не настроена</span>
                )}
              </div>
              {activeSchedule ? (
                <div className="flex items-center gap-3">
                  <div className="text-xs" style={{ color: "#64748b" }}>
                    <span style={{ color: "#94a3b8" }}>
                      {{
                        monthly: "Ежемесячно",
                        twice_monthly: "2 раза в месяц",
                        weekly: "Еженедельно",
                        split_first: "50/50 → ежемесячно",
                      }[activeSchedule.billingScheme] || activeSchedule.billingScheme}
                    </span>
                    {" · "}
                    <span style={{ color: "#22d3ee" }}>{activeSchedule.monthlyAmount.toLocaleString("ru-RU")} ₽/мес</span>
                    {" · с "}
                    {new Date(activeSchedule.startDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
                    onClick={() => deactivateSchedule.mutate(activeSchedule.id)}
                    disabled={deactivateSchedule.isPending}
                  >
                    Деактивировать
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setScheduleDialog(true)}
                  style={{ background: "rgba(124,107,255,0.2)", color: "#a78bfa", border: "1px solid rgba(124,107,255,0.4)" }}
                  className="gap-1.5 h-8 text-xs"
                  data-testid="button-setup-schedule"
                >
                  <Settings2 size={13} /> Настроить схему оплаты
                </Button>
              )}
            </div>
          </div>

          {/* Manual payment form */}
          <div className="rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex-1 min-w-28">
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Сумма ₽</label>
              <Input
                type="number"
                value={payForm.amount}
                onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="15000"
                className="bg-transparent border-border"
                data-testid="input-payment-amount"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Дата</label>
              <Input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} className="bg-transparent border-border" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Тип</label>
              <Select value={payForm.type} onValueChange={v => setPayForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="bg-transparent border-border w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                  <SelectItem value="refund">Возврат</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-28">
              <label className="text-xs font-medium mb-1 block" style={{ color: "#94a3b8" }}>Описание</label>
              <Input value={payForm.description} onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))} placeholder="Абонентка апрель" className="bg-transparent border-border" />
            </div>
            <Button onClick={() => addPayment.mutate()} disabled={!payForm.amount || addPayment.isPending} style={{ background: "#4ade80", color: "#0f172a" }} data-testid="button-add-payment">
              <Plus size={15} /> Добавить
            </Button>
          </div>

          {/* Payment list */}
          <div className="flex flex-col gap-2">
            {payments.length === 0 && (
              <div className="text-center text-sm py-10" style={{ color: "#475569" }}>Нет платежей</div>
            )}
            {[...payments].sort((a, b) => a.date.localeCompare(b.date)).map(p => {
              const today = new Date().toISOString().split("T")[0];
              const isOverdue = p.isPlanned && !p.isPaid && p.date < today;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--color-surface)", border: `1px solid ${isOverdue ? "rgba(248,113,113,0.3)" : "var(--color-border)"}` }} data-testid={`card-payment-${p.id}`}>
                  {/* Amount */}
                  <div
                    className="font-bold text-base shrink-0 min-w-[90px]"
                    style={{ color: p.isPaid ? "#4ade80" : p.type === "expense" ? "#f87171" : isOverdue ? "#f87171" : "#fbbf24" }}
                  >
                    {p.type === "income" ? "+" : "–"}{p.amount.toLocaleString("ru-RU")} ₽
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: "#94a3b8" }}>{p.description || (p.type === "income" ? "Доход" : "Расход")}</div>
                    <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: "#475569" }}>
                      <span>{new Date(p.date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {p.rescheduledFrom && (
                        <span style={{ color: "#64748b" }}>• исх. {new Date(p.rescheduledFrom + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                      )}
                      {p.isPlanned && !p.isPaid && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isOverdue ? "rgba(248,113,113,0.15)" : "rgba(251,146,60,0.15)", color: isOverdue ? "#f87171" : "#fb923c" }}>
                          {isOverdue ? "Просрочен" : "Запланирован"}
                        </span>
                      )}
                      {p.isPaid && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>Оплачен</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Mark paid — only for unpaid planned payments */}
                    {p.isPlanned && !p.isPaid && (
                      <button
                        onClick={() => markPaid.mutate(p.id)}
                        disabled={markPaid.isPending}
                        title="Отметить оплаченным"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-green-400/20"
                        style={{ border: "1px solid rgba(74,222,128,0.3)" }}
                        data-testid={`button-pay-${p.id}`}
                      >
                        <CheckCircle2 size={15} style={{ color: "#4ade80" }} />
                      </button>
                    )}
                    {/* Reschedule — only for unpaid planned */}
                    {p.isPlanned && !p.isPaid && (
                      <button
                        onClick={() => { setReschedulePayment(p); setRescheduleDate(p.date); }}
                        title="Перенести срок"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-400/20"
                        style={{ border: "1px solid rgba(34,211,238,0.3)" }}
                        data-testid={`button-reschedule-${p.id}`}
                      >
                        <CalendarClock size={14} style={{ color: "#22d3ee" }} />
                      </button>
                    )}
                    <button onClick={() => deletePayment.mutate(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-400/20" data-testid={`button-delete-payment-${p.id}`}>
                      <Trash2 size={13} style={{ color: "#334155" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Setup schedule dialog */}
          <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
            <DialogContent className="max-w-md" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <DialogHeader><DialogTitle style={{ color: "#e2e8f0" }}>Настроить схему оплаты</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4 pt-1">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#94a3b8" }}>Схема оплаты</label>
                  <Select value={schedForm.billingScheme} onValueChange={v => setSchedForm(f => ({ ...f, billingScheme: v }))}>
                    <SelectTrigger className="bg-transparent border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Ежемесячно — один платёж в месяц</SelectItem>
                      <SelectItem value="twice_monthly">2 раза в месяц — по 50%</SelectItem>
                      <SelectItem value="split_first">Первые 2 по 50%, затем ежемесячно</SelectItem>
                      <SelectItem value="weekly">Еженедельно — по 25%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#94a3b8" }}>Дата начала цикла</label>
                  <Input type="date" value={schedForm.startDate} onChange={e => setSchedForm(f => ({ ...f, startDate: e.target.value }))} className="bg-transparent border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#94a3b8" }}>Сумма в месяц (АБОНЕНТКА) ₽</label>
                  <Input
                    type="number"
                    value={schedForm.monthlyAmount}
                    onChange={e => setSchedForm(f => ({ ...f, monthlyAmount: e.target.value }))}
                    placeholder={client?.monthlyFee ? String(client.monthlyFee) : "15000"}
                    className="bg-transparent border-border"
                  />
                </div>
                {(schedForm.billingScheme === "twice_monthly" || schedForm.billingScheme === "split_first") && (
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "#94a3b8" }}>
                      {schedForm.billingScheme === "split_first" ? "Интервал между первыми двумя платежами (дней)" : "День второго платёжа в месяце"}
                    </label>
                    <Input
                      type="number"
                      value={schedForm.secondDayOfMonth}
                      onChange={e => setSchedForm(f => ({ ...f, secondDayOfMonth: Number(e.target.value) }))}
                      min={1} max={31}
                      className="bg-transparent border-border"
                    />
                  </div>
                )}
                <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(124,107,255,0.08)", color: "#7c6bff", border: "1px solid rgba(124,107,255,0.2)" }}>
                  Система автоматически создаст плановые платежи и напоминания в календаре на 1 год вперёд. При смене статуса клиента на «не актив» — будущие платежи удаляются.
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setScheduleDialog(false)}>Отмена</Button>
                  <Button
                    onClick={() => createSchedule.mutate({
                      clientId,
                      billingScheme: schedForm.billingScheme,
                      startDate: schedForm.startDate,
                      monthlyAmount: Number(schedForm.monthlyAmount) || client?.monthlyFee || 0,
                      secondDayOfMonth: schedForm.secondDayOfMonth,
                      isActive: true,
                    })}
                    disabled={createSchedule.isPending || !schedForm.startDate}
                    style={{ background: "var(--color-violet)", color: "white" }}
                  >
                    {createSchedule.isPending ? "Запускаем..." : "Запустить схему"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Reschedule dialog */}
          <Dialog open={!!reschedulePayment} onOpenChange={v => !v && setReschedulePayment(null)}>
            <DialogContent className="max-w-sm" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <DialogHeader><DialogTitle style={{ color: "#e2e8f0" }}>Перенести срок оплаты</DialogTitle></DialogHeader>
              {reschedulePayment && (
                <div className="flex flex-col gap-4 pt-1">
                  <div className="text-sm" style={{ color: "#94a3b8" }}>
                    Платёж {reschedulePayment.amount.toLocaleString("ru-RU")} ₽
                    {reschedulePayment.description ? ` — ${reschedulePayment.description}` : ""}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "#94a3b8" }}>Новая дата оплаты</label>
                    <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="bg-transparent border-border" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setReschedulePayment(null)}>Отмена</Button>
                    <Button
                      onClick={() => reschedulePaymentMutation.mutate({ id: reschedulePayment.id, newDate: rescheduleDate })}
                      disabled={reschedulePaymentMutation.isPending || !rescheduleDate}
                      style={{ background: "#22d3ee", color: "#0f172a" }}
                    >
                      {reschedulePaymentMutation.isPending ? "Переносим..." : "Перенести"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── REPORTS ── */}
        <TabsContent value="reports">
          {/* ── Блок подключения API Авито ── */}
          <div className="mb-5 rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} style={{ color: "#7c6bff" }} />
                <span className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>API Авито — статистика</span>
              </div>
              <div className="flex items-center gap-2">
                {avitoConnection ? (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "#4ade80" }}>
                    <Wifi size={12} /> Подключено
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "#64748b" }}>
                    <WifiOff size={12} /> Не подключено
                  </span>
                )}
                <button
                  onClick={() => setAvitoApiForm(!avitoApiForm)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(124,107,255,0.15)", color: "#a78bfa" }}
                >
                  {avitoApiForm ? "Свернуть" : (avitoConnection ? "Настройки" : "Подключить")}
                </button>
              </div>
            </div>

            {/* Форма подключения */}
            {avitoApiForm && (
              <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                <div className="text-xs mb-2" style={{ color: "#64748b" }}>
                  Ключи находятся в разделе <a href="https://www.avito.ru/professionals/api" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#22d3ee" }}>avito.ru/professionals/api</a>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    value={avitoFormData.avitoClientId}
                    onChange={e => setAvitoFormData(p => ({ ...p, avitoClientId: e.target.value }))}
                    placeholder="Client ID"
                    className="text-sm"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
                  />
                  <Input
                    value={avitoFormData.avitoClientSecret}
                    onChange={e => setAvitoFormData(p => ({ ...p, avitoClientSecret: e.target.value }))}
                    placeholder="Client Secret"
                    type="password"
                    className="text-sm"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
                  />
                  <Input
                    value={avitoFormData.avitoUserId}
                    onChange={e => setAvitoFormData(p => ({ ...p, avitoUserId: e.target.value }))}
                    placeholder="User ID (числовой ID профиля Авито)"
                    className="text-sm"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await apiRequest("POST", `/api/avito/${clientId}/connection`, avitoFormData);
                        const data = await res.json();
                        if (data.error) { toast({ title: "Ошибка", description: data.error, variant: "destructive" }); return; }
                        toast({ title: "Подключение успешно проверено" });
                        refetchAvitoConn();
                        setAvitoApiForm(false);
                      } catch(e: any) { toast({ title: "Ошибка", description: e.message, variant: "destructive" }); }
                    }}
                    style={{ background: "#7c6bff", color: "white" }}
                  >
                    Сохранить и проверить
                  </Button>
                  {avitoConnection && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await apiRequest("DELETE", `/api/avito/${clientId}/connection`);
                        refetchAvitoConn(); refetchAvitoStats();
                        setAvitoApiForm(false);
                        toast({ title: "Подключение удалено" });
                      }}
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 size={13} className="mr-1" /> Отключить
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Кнопка сбора */}
            {avitoConnection && !avitoApiForm && (
              <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                <select
                  value={avitoFetchDays}
                  onChange={e => setAvitoFetchDays(Number(e.target.value))}
                  className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#94a3b8" }}
                >
                  <option value={7}>Последние 7 дней</option>
                  <option value={30}>Последние 30 дней</option>
                  <option value={90}>Последние 90 дней</option>
                  <option value={180}>Последние 180 дней</option>
                </select>
                <Button
                  size="sm"
                  disabled={avitoFetching}
                  onClick={async () => {
                    setAvitoFetching(true);
                    try {
                      const res = await apiRequest("POST", `/api/avito/${clientId}/fetch-stats`, { days: avitoFetchDays });
                      const data = await res.json();
                      if (data.error) { toast({ title: "Ошибка", description: data.error, variant: "destructive" }); }
                      else {
                        toast({ title: `Статистика обновлена`, description: `${data.items} объявлений, ${data.fetched} записей` });
                        refetchAvitoStats();
                      }
                    } catch(e: any) { toast({ title: "Ошибка", description: e.message, variant: "destructive" }); }
                    setAvitoFetching(false);
                  }}
                  style={{ background: "linear-gradient(135deg, #7c6bff, #22d3ee)", color: "white" }}
                >
                  <RefreshCw size={13} className={`mr-1.5 ${avitoFetching ? "animate-spin" : ""}`} />
                  {avitoFetching ? "Загружаю..." : "Обновить статистику"}
                </Button>
                {avitoStats.length > 0 && (
                  <span className="text-xs ml-auto" style={{ color: "#475569" }}>
                    {new Set(avitoStats.map((s: any) => s.itemId)).size} объявлений
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Статистика Авито ── */}
          {avitoStats.length > 0 && (() => {
            // Подготовка данных
            const items = Array.from(new Map(avitoStats.map((s: any) => [s.itemId, s])).values());
            const filteredStats = avitoStats.filter((s: any) => {
              const byItem = !avitoSelectedItem || s.itemId === avitoSelectedItem;
              const byFrom = !avitoDateFrom || s.date >= avitoDateFrom;
              const byTo = !avitoDateTo || s.date <= avitoDateTo;
              return byItem && byFrom && byTo;
            });

            // Сводная статистика по объявлениям
            const byItem = new Map<string, { title: string; url: string | null; status: string | null; views: number; contacts: number; favs: number }>();
            for (const s of filteredStats) {
              const cur = byItem.get(s.itemId) || { title: s.itemTitle || s.itemId, url: s.itemUrl, status: s.itemStatus, views: 0, contacts: 0, favs: 0 };
              cur.views += s.uniqViews || 0;
              cur.contacts += s.uniqContacts || 0;
              cur.favs += s.uniqFavorites || 0;
              byItem.set(s.itemId, cur);
            }
            const itemStats = Array.from(byItem.entries()).map(([id, v]) => ({ id, ...v }))
              .sort((a, b) => b[avitoSortBy === "views" ? "views" : avitoSortBy === "contacts" ? "contacts" : "favs"] - a[avitoSortBy === "views" ? "views" : avitoSortBy === "contacts" ? "contacts" : "favs"]);

            // Общая статистика
            const totals = filteredStats.reduce((acc: any, s: any) => {
              acc.views += s.uniqViews || 0;
              acc.contacts += s.uniqContacts || 0;
              acc.favs += s.uniqFavorites || 0;
              return acc;
            }, { views: 0, contacts: 0, favs: 0 });

            return (
              <div className="space-y-4">
                {/* Тоталы */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Просмотры", value: totals.views, color: "#7c6bff", icon: Eye },
                    { label: "Контакты", value: totals.contacts, color: "#22d3ee", icon: MousePointer },
                    { label: "Избранное", value: totals.favs, color: "#fb923c", icon: Heart },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--color-surface)", border: `1px solid ${color}30` }}>
                      <Icon size={18} className="mx-auto mb-2" style={{ color }} />
                      <div className="text-2xl font-bold" style={{ color }}>{value.toLocaleString("ru-RU")}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Фильтры */}
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={avitoSelectedItem || ""}
                    onChange={e => setAvitoSelectedItem(e.target.value || null)}
                    className="text-xs px-2 py-1.5 rounded-lg flex-1 min-w-[160px]"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#94a3b8" }}
                  >
                    <option value="">Все объявления ({items.length})</option>
                    {items.map((it: any) => <option key={it.itemId} value={it.itemId}>{it.itemTitle || it.itemId}</option>)}
                  </select>
                  <Input
                    type="date" value={avitoDateFrom}
                    onChange={e => setAvitoDateFrom(e.target.value)}
                    className="text-xs flex-1 min-w-[120px]"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#94a3b8" }}
                  />
                  <Input
                    type="date" value={avitoDateTo}
                    onChange={e => setAvitoDateTo(e.target.value)}
                    className="text-xs flex-1 min-w-[120px]"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#94a3b8" }}
                  />
                  <div className="flex gap-1">
                    {(["views", "contacts", "favorites"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setAvitoSortBy(s === "favorites" ? "favorites" : s)}
                        className="text-xs px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: avitoSortBy === (s === "favorites" ? "favorites" : s) ? "#7c6bff" : "var(--color-surface-2)",
                          color: avitoSortBy === (s === "favorites" ? "favorites" : s) ? "white" : "#64748b",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {s === "views" ? "Просмотры" : s === "contacts" ? "Контакты" : "Избранное"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Таблица по объявлениям */}
                <div className="space-y-2">
                  {itemStats.map(it => {
                    const maxVal = Math.max(...itemStats.map(i => avitoSortBy === "views" ? i.views : avitoSortBy === "contacts" ? i.contacts : i.favs), 1);
                    const val = avitoSortBy === "views" ? it.views : avitoSortBy === "contacts" ? it.contacts : it.favs;
                    const pct = Math.round((val / maxVal) * 100);
                    return (
                      <div
                        key={it.id}
                        className="rounded-xl p-3 cursor-pointer"
                        style={{ background: "var(--color-surface)", border: `1px solid ${avitoSelectedItem === it.id ? "#7c6bff" : "var(--color-border)"}` }}
                        onClick={() => setAvitoSelectedItem(avitoSelectedItem === it.id ? null : it.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: it.status === "active" ? "#4ade80" : it.status === "blocked" ? "#ef4444" : "#64748b" }}
                            />
                            <span className="text-sm truncate font-medium" style={{ color: "#e2e8f0" }}>{it.title}</span>
                            {it.url && (
                              <a href={it.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <ExternalLink size={11} style={{ color: "#475569" }} />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-xs" style={{ color: "#7c6bff" }}><Eye size={11} className="inline mr-0.5" />{it.views.toLocaleString("ru-RU")}</span>
                            <span className="text-xs" style={{ color: "#22d3ee" }}><MousePointer size={11} className="inline mr-0.5" />{it.contacts.toLocaleString("ru-RU")}</span>
                            <span className="text-xs" style={{ color: "#fb923c" }}><Heart size={11} className="inline mr-0.5" />{it.favs.toLocaleString("ru-RU")}</span>
                          </div>
                        </div>
                        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "var(--color-surface-2)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7c6bff, #22d3ee)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Динамика по дням (если выбрано объявление) */}
                {avitoSelectedItem && (() => {
                  const dayData = filteredStats
                    .filter((s: any) => s.itemId === avitoSelectedItem)
                    .sort((a: any, b: any) => a.date.localeCompare(b.date));
                  if (dayData.length === 0) return null;
                  return (
                    <div className="rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                      <div className="text-sm font-semibold mb-3" style={{ color: "#a78bfa" }}>Динамика по дням</div>
                      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                        {dayData.map((d: any) => (
                          <div key={d.date} className="flex items-center gap-3 py-1.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
                            <span className="text-xs w-24 shrink-0" style={{ color: "#64748b" }}>{d.date}</span>
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-xs" style={{ color: "#7c6bff" }}><Eye size={10} className="inline mr-0.5" />{d.uniqViews}</span>
                              <span className="text-xs" style={{ color: "#22d3ee" }}><MousePointer size={10} className="inline mr-0.5" />{d.uniqContacts}</span>
                              <span className="text-xs" style={{ color: "#fb923c" }}><Heart size={10} className="inline mr-0.5" />{d.uniqFavorites}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Нет статистики */}
          {avitoStats.length === 0 && avitoConnection && !avitoApiForm && (
            <div className="text-center py-8" style={{ color: "#475569" }}>
              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">Нажмите «Обновить статистику» для загрузки данных</div>
            </div>
          )}
          {!avitoConnection && !avitoApiForm && (
            <div className="text-center py-8" style={{ color: "#475569" }}>
              <WifiOff size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm mb-3">Подключите API Авито, чтобы получать автоматическую статистику</div>
              <button
                onClick={() => setAvitoApiForm(true)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "rgba(124,107,255,0.2)", color: "#a78bfa" }}
              >Подключить API</button>
            </div>
          )}

          {/* ── Ручные отчёты (старый блок) ── */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: "#94a3b8" }}>Ручные отчёты</span>
              <Button onClick={() => setReportDialog(true)} size="sm" style={{ background: "#22d3ee", color: "#0f172a" }} className="gap-2">
                <Plus size={13} /> Новый отчёт
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {reports.map(r => (
                <div key={r.id} className="rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>{r.period} — отчёт</div>
                    <button onClick={() => { apiRequest("DELETE", `/api/reports/${r.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "reports"] })); }}>
                      <Trash2 size={13} style={{ color: "#334155" }} className="hover:text-red-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { k: "impressions", label: "Показы", color: "#7c6bff" },
                      { k: "clicks", label: "Клики", color: "#22d3ee" },
                      { k: "calls", label: "Звонки", color: "#4ade80" },
                      { k: "messages", label: "Сообщения", color: "#fb923c" },
                      { k: "deals", label: "Сделки", color: "#fbbf24" },
                      { k: "adSpend", label: "Расход ₽", color: "#f472b6" },
                    ].map(({ k, label, color }) => (
                      <div key={k} className="text-center p-2 rounded-lg" style={{ background: `${color}10` }}>
                        <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>{label}</div>
                        <div className="font-bold text-sm" style={{ color }}>{((r as any)[k] || 0).toLocaleString("ru-RU")}</div>
                      </div>
                    ))}
                  </div>
                  {r.notes && <p className="text-xs mt-2" style={{ color: "#64748b" }}>{r.notes}</p>}
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-center text-sm py-6" style={{ color: "#475569" }}>Нет ручных отчётов</div>
              )}
            </div>
          </div>

          <Dialog open={reportDialog} onOpenChange={setReportDialog}>
            <DialogContent className="max-w-lg" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <DialogHeader><DialogTitle style={{ color: "#e2e8f0" }}>Новый отчёт</DialogTitle></DialogHeader>
              <ReportForm clientId={clientId} onClose={() => setReportDialog(false)} />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── DOCUMENTS ── */}
        <TabsContent value="documents">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setDocDialog(true)} style={{ background: "#22d3ee", color: "#0f172a" }} className="gap-2">
              <Plus size={15} /> Добавить документ
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {documents.length === 0 ? (
              <div
                className="rounded-xl p-12 text-center text-sm cursor-pointer transition-colors"
                style={{
                  background: docZoneDrag ? "#7c6bff15" : "var(--color-surface)",
                  border: `2px dashed ${docZoneDrag ? "#7c6bff" : "#252840"}`,
                  color: "#475569",
                }}
                onDragOver={e => { e.preventDefault(); setDocZoneDrag(true); }}
                onDragLeave={() => setDocZoneDrag(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDocZoneDrag(false);
                  const file = e.dataTransfer.files[0];
                  if (file) { setDocDropFile(file); setDocDialog(true); }
                }}
                onClick={() => setDocDialog(true)}
              >
                <Upload size={36} className="mx-auto mb-3" style={{ color: docZoneDrag ? "#7c6bff" : "#334155" }} />
                <p className="font-medium mb-1" style={{ color: docZoneDrag ? "#a78bfa" : "#64748b" }}>
                  {docZoneDrag ? "Отпустите для загрузки" : "Перетащите файл сюда"}
                </p>
                <p className="text-xs">Договоры, акты, чеки — PDF, Word, изображения</p>
              </div>
            ) : (
              documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-start gap-4 rounded-xl p-4"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  data-testid={`card-document-${doc.id}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${docTypeColor[doc.docType] || "#94a3b8"}20` }}
                  >
                    {doc.fileType === "image" ? (
                      <Image size={18} style={{ color: docTypeColor[doc.docType] || "#94a3b8" }} />
                    ) : (
                      <FileText size={18} style={{ color: docTypeColor[doc.docType] || "#94a3b8" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>{doc.title}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${docTypeColor[doc.docType] || "#94a3b8"}15`, color: docTypeColor[doc.docType] || "#94a3b8" }}
                      >
                        {DOC_TYPES.find(d => d.value === doc.docType)?.label || doc.docType}
                      </span>
                    </div>
                    {doc.date && (
                      <div className="text-xs mb-1" style={{ color: "#64748b" }}>
                        {new Date(doc.date).toLocaleDateString("ru-RU")}
                      </div>
                    )}
                    {doc.notes && <p className="text-xs" style={{ color: "#64748b" }}>{doc.notes}</p>}
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs mt-1 hover:underline"
                        style={{ color: "#22d3ee" }}
                      >
                        <ExternalLink size={11} /> Открыть файл
                      </a>
                    )}
                    {doc.publicUrl && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(doc.publicUrl!).catch(() => {});
                          toast({ title: "Ссылка скопирована" });
                        }}
                        className="flex items-center gap-1 text-xs mt-1 hover:underline"
                        style={{ color: "#7c6bff" }}
                      >
                        <Copy size={11} /> Скопировать публичную ссылку
                      </button>
                    )}
                  </div>
                  <button onClick={() => deleteDocument.mutate(doc.id)}>
                    <Trash2 size={13} style={{ color: "#334155" }} className="hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>
          <Dialog open={docDialog} onOpenChange={v => { setDocDialog(v); if (!v) setDocDropFile(undefined); }}>
            <DialogContent className="max-w-lg" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <DialogHeader><DialogTitle style={{ color: "#e2e8f0" }}>Добавить документ</DialogTitle></DialogHeader>
              <DocumentForm clientId={clientId} onClose={() => { setDocDialog(false); setDocDropFile(undefined); }} prefillFile={docDropFile} />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── REMINDERS ── */}
        <TabsContent value="reminders">
          {selectedReminder ? (
            // ── Детальный вид задачи
            <div>
              <button
                onClick={() => setSelectedReminder(null)}
                className="flex items-center gap-1.5 text-sm mb-4 hover:text-violet-400 transition-colors"
                style={{ color: "#64748b" }}
              >
                <ArrowLeft size={14} /> Назад к задачам
              </button>
              <div className="rounded-2xl p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                {(() => {
                  const r = selectedReminder;
                  const todayStr = new Date().toISOString().split("T")[0];
                  const isOverdue = r.dueDate < todayStr && !r.isDone;
                  const priorityColor: Record<string, string> = { high: "#f87171", medium: "#fbbf24", low: "#4ade80" };
                  const priorityLabel: Record<string, string> = { high: "Высокий", medium: "Средний", low: "Низкий" };
                  const typeLabel: Record<string, string> = { report: "Отчёт", payment: "Оплата", renewal: "Продление", task: "Задача", general: "Общее" };
                  const recurrenceLabel: Record<string, string> = { daily: "Ежедневно", weekly: "Еженедельно", monthly: "Ежемесячно" };
                  return (
                    <div className="flex flex-col gap-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-bold mb-1" style={{ color: r.isDone ? "#475569" : "#e2e8f0", textDecoration: r.isDone ? "line-through" : "none" }}>
                            {r.title}
                          </h2>
                          {r.description && (
                            <p className="text-sm" style={{ color: "#94a3b8" }}>{r.description}</p>
                          )}
                        </div>
                        {!r.isDone && (
                          <Button
                            onClick={() => { doneReminder.mutate(r.id); setSelectedReminder(null); }}
                            style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                            className="shrink-0 gap-1.5"
                            size="sm"
                          >
                            <CheckCircle2 size={14} /> Выполнено
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl p-3" style={{ background: "var(--color-surface-2)" }}>
                          <div className="text-xs mb-1" style={{ color: "#64748b" }}>Дата</div>
                          <div className="text-sm font-medium" style={{ color: isOverdue ? "#f87171" : "#e2e8f0" }}>
                            {new Date(r.dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                            {isOverdue && <span className="ml-1 text-xs" style={{ color: "#f87171" }}>(просрочено)</span>}
                          </div>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: "var(--color-surface-2)" }}>
                          <div className="text-xs mb-1" style={{ color: "#64748b" }}>Приоритет</div>
                          <div className="text-sm font-medium" style={{ color: priorityColor[r.priority || "medium"] }}>
                            {priorityLabel[r.priority || "medium"]}
                          </div>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: "var(--color-surface-2)" }}>
                          <div className="text-xs mb-1" style={{ color: "#64748b" }}>Тип</div>
                          <div className="text-sm font-medium" style={{ color: "#a78bfa" }}>{typeLabel[r.type] || r.type}</div>
                        </div>
                        {(r as any).recurrence && (r as any).recurrence !== "none" && (
                          <div className="rounded-xl p-3" style={{ background: "var(--color-surface-2)" }}>
                            <div className="text-xs mb-1" style={{ color: "#64748b" }}>Повторение</div>
                            <div className="text-sm font-medium flex items-center gap-1" style={{ color: "#7c6bff" }}>
                              <RotateCcw size={12} />
                              {recurrenceLabel[(r as any).recurrence] || (r as any).recurrence}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 hover:text-red-400"
                          style={{ color: "#475569" }}
                          onClick={() => {
                            apiRequest("DELETE", `/api/reminders/${r.id}`).then(() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/reminders/all"] });
                              setSelectedReminder(null);
                            });
                          }}
                        >
                          <Trash2 size={12} /> Удалить
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            // ── Список задач с подразделами
            <div>
              {/* Подвкладки: Технические / Финансовые / Все */}
              <TaskSubTabs
                reminders={clientReminders}
                onAdd={() => setReminderDialog(true)}
                onSelect={setSelectedReminder}
              />
            </div>
          )}
          <Dialog open={reminderDialog} onOpenChange={setReminderDialog}>
            <DialogContent className="max-w-lg" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <DialogHeader><DialogTitle style={{ color: "#e2e8f0" }}>Новая задача</DialogTitle></DialogHeader>
              <ReminderForm clientId={clientId} onClose={() => setReminderDialog(false)} />
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Edit Client Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <DialogHeader><DialogTitle style={{ color: "#e2e8f0" }}>Редактировать клиента</DialogTitle></DialogHeader>
          <ClientEditForm client={client} onClose={() => setEditDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
