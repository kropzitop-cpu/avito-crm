import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Brain, Plus, Search, Star, StarOff, Copy, Check,
  Trash2, ChevronDown, ChevronUp, Pencil, ArrowLeft,
  ListOrdered, X, GripVertical, FileText, Upload, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, API_BASE } from "@/lib/queryClient";

// Helper that returns parsed JSON (apiRequest returns Response)
async function api<T>(method: string, url: string, data?: any): Promise<T> {
  const res = await apiRequest(method, url, data);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Prompt {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptModel {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

interface PromptModelStep {
  id: number;
  modelId: number;
  stepNumber: number;
  name: string;
  content: string;
}

// ── DocxImportZone ────────────────────────────────────────────────────────
function DocxImportZone({ onParsed }: { onParsed: (data: { title: string; content: string; filename: string }) => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".docx")) {
      toast({ title: "Только .docx", description: "Загрузите файл формата Word (.docx)", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/prompts/parse-docx`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onParsed(data);
      toast({ title: `Файл распознан`, description: `${data.chars} символов извлечено` });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [onParsed, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-xl cursor-pointer transition-all select-none"
      style={{
        border: `2px dashed ${dragging ? "#7c6bff" : "var(--color-border)"}`,
        background: dragging ? "rgba(124,107,255,0.08)" : "transparent",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
      />
      {loading ? (
        <><Loader2 size={22} className="animate-spin" style={{ color: "#7c6bff" }} />
        <span className="text-sm" style={{ color: "#64748b" }}>Распознаю текст...</span></>
      ) : (
        <><FileText size={22} style={{ color: dragging ? "#7c6bff" : "#475569" }} />
        <div className="text-center">
          <div className="text-sm font-medium" style={{ color: dragging ? "#a78bfa" : "#64748b" }}>
            {dragging ? "Отпустите файл" : "Перетащите .docx или нажмите"}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#334155" }}>Word-файл будет распознан и предложен для добавления в библиотеку</div>
        </div></>
      )}
    </div>
  );
}

// ── Default categories ─────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  "Все", "Анализ профиля", "Сбор ЦА", "УТП", "Тексты",
  "Аналитика", "Ключи", "Общее",
];

// ── Default steps for new model ────────────────────────────────────────────
const DEFAULT_STEP_NAMES = [
  "Шаг 0 Агент Анализ профиля",
  "Шаг 1 ИИ Сбор портрета ЦА",
  "Шаг 2 ИИ Глубокий ЦА",
  "Шаг 3 АГЕНТ (Сбор УТП)",
  "Шаг 4 Агент СбОР Ключей",
  "Шаг 5 Агент анализ трендов",
  "Шаг 6 ИИ написание текстов",
  "Аналитика",
  "Работа со статистикой авито",
  "Анализ выдачи",
  "Строгое фото",
];

// ── InlineEdit component ───────────────────────────────────────────────────
function InlineEdit({
  value,
  onSave,
  className = "",
  inputClassName = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        autoFocus
        className={`bg-transparent border-b outline-none ${inputClassName}`}
        style={{ borderColor: "#7c6bff", color: "#e2e8f0" }}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:underline decoration-dotted ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Нажмите для переименования"
    >
      {value}
    </span>
  );
}

// ── Prompts Library Tab ────────────────────────────────────────────────────
function PromptsLibrary() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null);

  // Docx preview dialog
  const [docxPreview, setDocxPreview] = useState<{ title: string; content: string; filename: string } | null>(null);
  const [docxTitle, setDocxTitle] = useState("");
  const [docxContent, setDocxContent] = useState("");
  const [docxCategory, setDocxCategory] = useState("Общее");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("Общее");
  const [formTags, setFormTags] = useState("");

  const { data: prompts = [] } = useQuery<Prompt[]>({
    queryKey: ["/api/prompts"],
    throwOnError: false,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/prompts", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/prompts"] }); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/prompts/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/prompts"] }); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/prompts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/prompts"] }),
  });

  const favMut = useMutation({
    mutationFn: ({ id, isFavorite }: { id: number; isFavorite: boolean }) =>
      apiRequest("PATCH", `/api/prompts/${id}`, { isFavorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/prompts"] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditPrompt(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("Общее");
    setFormTags("");
  };

  const openEdit = (p: Prompt) => {
    setEditPrompt(p);
    setFormTitle(p.title);
    setFormContent(p.content);
    setFormCategory(p.category);
    setFormTags((p.tags || []).join(", "));
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    if (editPrompt) {
      updateMut.mutate({ id: editPrompt.id, title: formTitle, content: formContent, category: formCategory, tags });
    } else {
      createMut.mutate({ title: formTitle, content: formContent, category: formCategory, tags, isFavorite: false });
    }
  };

  const copyPrompt = (p: Prompt) => {
    navigator.clipboard.writeText(p.content);
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Скопировано в буфер обмена" });
  };

  // All categories including custom ones from data
  const allCats = [...DEFAULT_CATEGORIES];
  prompts.forEach((p) => {
    if (p.category && !allCats.includes(p.category)) allCats.push(p.category);
  });

  // Filtering
  const filtered = prompts.filter((p) => {
    const inCat = activeCategory === "Все" || p.category === activeCategory;
    const inSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return inCat && inSearch;
  });

  // Favorites first
  const sorted = [...filtered].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск промтов..."
            className="pl-9 text-sm"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
          />
        </div>
        <Button
          onClick={() => { setEditPrompt(null); resetForm(); setShowForm(true); }}
          size="sm"
          style={{ background: "linear-gradient(135deg, #7c6bff, #a78bfa)", color: "white" }}
        >
          <Plus size={14} className="mr-1" /> Добавить промт
        </Button>
      </div>

      {/* Drag-and-drop зона для Word */}
      <DocxImportZone
        onParsed={(data) => {
          setDocxPreview(data);
          setDocxTitle(data.title);
          setDocxContent(data.content);
          setDocxCategory("Общее");
        }}
      />

      {/* Диалог предпросмотра распознанного контента */}
      <Dialog open={!!docxPreview} onOpenChange={(open) => !open && setDocxPreview(null)}>
        <DialogContent
          className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          style={{ background: "var(--color-surface)", border: "1px solid #7c6bff" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#e2e8f0" }}>
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: "#7c6bff" }} />
                Распознанный файл: {docxPreview?.filename}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#64748b" }}>Название промта</label>
              <Input
                value={docxTitle}
                onChange={e => setDocxTitle(e.target.value)}
                className="text-sm"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#64748b" }}>Категория</label>
              <select
                value={docxCategory}
                onChange={e => setDocxCategory(e.target.value)}
                className="w-full text-sm px-3 py-1.5 rounded-lg"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
              >
                {DEFAULT_CATEGORIES.filter(c => c !== "Все").map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "#64748b" }}>
                Текст промта — отредактируйте если нужно
              </label>
              <Textarea
                value={docxContent}
                onChange={e => setDocxContent(e.target.value)}
                rows={12}
                className="text-sm resize-none font-mono"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#e2e8f0", lineHeight: 1.6 }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDocxPreview(null)}
                style={{ color: "#64748b" }}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                disabled={!docxTitle.trim() || !docxContent.trim()}
                onClick={() => {
                  createMut.mutate({
                    title: docxTitle.trim(),
                    content: docxContent.trim(),
                    category: docxCategory,
                    tags: [],
                    isFavorite: false,
                  });
                  setDocxPreview(null);
                }}
                style={{ background: "#7c6bff", color: "white" }}
              >
                <Upload size={13} className="mr-1.5" /> Добавить в библиотеку
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {allCats.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: activeCategory === cat ? "#7c6bff" : "var(--color-surface-2)",
              color: activeCategory === cat ? "white" : "#94a3b8",
              border: `1px solid ${activeCategory === cat ? "#7c6bff" : "var(--color-border)"}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--color-surface-2)", border: "1px solid #7c6bff" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm" style={{ color: "#a78bfa" }}>
              {editPrompt ? "Редактировать промт" : "Новый промт"}
            </span>
            <button onClick={resetForm}><X size={16} style={{ color: "#64748b" }} /></button>
          </div>
          <Input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Название промта"
            className="text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
          />
          <Textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="Текст промта..."
            rows={5}
            className="text-sm resize-none"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
          />
          <div className="flex gap-3 flex-wrap">
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg flex-1 min-w-[140px]"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
            >
              {DEFAULT_CATEGORIES.filter((c) => c !== "Все").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="Теги через запятую"
              className="text-sm flex-1"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm} style={{ color: "#64748b" }}>Отмена</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!formTitle.trim() || !formContent.trim()}
              style={{ background: "#7c6bff", color: "white" }}
            >
              {editPrompt ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      )}

      {/* Prompt list */}
      {sorted.length === 0 ? (
        <div className="text-center py-12" style={{ color: "#475569" }}>
          <Brain size={36} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">Промты не найдены</div>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div
              key={p.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${p.isFavorite ? "rgba(124,107,255,0.4)" : "var(--color-border)"}`,
                boxShadow: p.isFavorite ? "0 0 8px rgba(124,107,255,0.15)" : "none",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); favMut.mutate({ id: p.id, isFavorite: !p.isFavorite }); }}
                  className="shrink-0"
                >
                  {p.isFavorite
                    ? <Star size={15} fill="#fbbf24" color="#fbbf24" />
                    : <StarOff size={15} style={{ color: "#475569" }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ color: "#e2e8f0" }}>{p.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(124,107,255,0.15)", color: "#a78bfa" }}
                    >
                      {p.category}
                    </span>
                    {(p.tags || []).map((tag) => (
                      <span key={tag} className="text-xs" style={{ color: "#475569" }}>#{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyPrompt(p); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "#64748b" }}
                    title="Копировать"
                  >
                    {copied === p.id ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "#64748b" }}
                    title="Редактировать"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMut.mutate(p.id); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "#64748b" }}
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                  {expandedId === p.id ? <ChevronUp size={14} style={{ color: "#64748b" }} /> : <ChevronDown size={14} style={{ color: "#64748b" }} />}
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === p.id && (
                <div
                  className="px-4 pb-4"
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <pre
                    className="text-sm mt-3 whitespace-pre-wrap leading-relaxed"
                    style={{ color: "#cbd5e1", fontFamily: "inherit" }}
                  >
                    {p.content}
                  </pre>
                  <button
                    onClick={() => copyPrompt(p)}
                    className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(124,107,255,0.15)", color: "#a78bfa" }}
                  >
                    {copied === p.id ? <Check size={12} /> : <Copy size={12} />}
                    {copied === p.id ? "Скопировано!" : "Копировать промт"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Working Models Tab ─────────────────────────────────────────────────────
function WorkingModels() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedModel, setSelectedModel] = useState<PromptModel | null>(null);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelDesc, setNewModelDesc] = useState("");

  const { data: models = [] } = useQuery<PromptModel[]>({
    queryKey: ["/api/prompt-models"],
    throwOnError: false,
  });

  const { data: steps = [] } = useQuery<PromptModelStep[]>({
    queryKey: [`/api/prompt-models/${selectedModel?.id}/steps`],
    enabled: !!selectedModel,
    throwOnError: false,
  });

  const createModelMut = useMutation({
    mutationFn: (data: any) => api<PromptModel>("POST", "/api/prompt-models", data),
    onSuccess: async (model: PromptModel) => {
      // Create default steps
      for (let i = 0; i < DEFAULT_STEP_NAMES.length; i++) {
        await api("POST", "/api/prompt-model-steps", {
          modelId: model.id,
          stepNumber: i,
          name: DEFAULT_STEP_NAMES[i],
          content: "",
        });
      }
      qc.invalidateQueries({ queryKey: ["/api/prompt-models"] });
      setSelectedModel(model);
      setShowNewModel(false);
      setNewModelName("");
      setNewModelDesc("");
    },
  });

  const updateModelMut = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/prompt-models/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/prompt-models"] }),
  });

  const deleteModelMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/prompt-models/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/prompt-models"] });
      setSelectedModel(null);
    },
  });

  const stepsKey = () => [`/api/prompt-models/${selectedModel?.id}/steps`];

  const updateStepMut = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/prompt-model-steps/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey() }),
  });

  const deleteStepMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/prompt-model-steps/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey() }),
  });

  const addStepMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/prompt-model-steps", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey() }),
  });

  const copyStep = (s: PromptModelStep) => {
    navigator.clipboard.writeText(s.content);
    toast({ title: "Промт скопирован" });
  };

  // ── Model detail view ────────────────────────────────────────────────────
  if (selectedModel) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedModel(null)}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "#64748b" }}
          >
            <ArrowLeft size={15} /> Модели
          </button>
          <span style={{ color: "#252840" }}>·</span>
          <InlineEdit
            value={selectedModel.name}
            onSave={(name) => {
              updateModelMut.mutate({ id: selectedModel.id, name });
              setSelectedModel({ ...selectedModel, name });
            }}
            className="font-bold text-lg"
            inputClassName="font-bold text-lg w-64"
          />
          <button
            className="ml-auto p-1.5 rounded-lg"
            style={{ color: "#ef4444" }}
            onClick={() => {
              if (confirm("Удалить модель и все шаги?")) deleteModelMut.mutate(selectedModel.id);
            }}
            title="Удалить модель"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              onRename={(name) => updateStepMut.mutate({ id: step.id, name })}
              onContentChange={(content) => updateStepMut.mutate({ id: step.id, content })}
              onDelete={() => deleteStepMut.mutate(step.id)}
              onCopy={() => copyStep(step)}
            />
          ))}
        </div>

        {/* Add step */}
        <button
          onClick={() => {
            const nextNum = steps.length > 0 ? Math.max(...steps.map((s) => s.stepNumber)) + 1 : 0;
            addStepMut.mutate({
              modelId: selectedModel.id,
              stepNumber: nextNum,
              name: `Шаг ${nextNum}`,
              content: "",
            });
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-colors"
          style={{
            border: "2px dashed var(--color-border)",
            color: "#64748b",
          }}
        >
          <Plus size={14} /> Добавить шаг
        </button>
      </div>
    );
  }

  // ── Models list ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setShowNewModel(true)}
          style={{ background: "linear-gradient(135deg, #7c6bff, #a78bfa)", color: "white" }}
        >
          <Plus size={14} className="mr-1" /> Новая модель
        </Button>
      </div>

      {showNewModel && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--color-surface-2)", border: "1px solid #7c6bff" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm" style={{ color: "#a78bfa" }}>Новая рабочая модель</span>
            <button onClick={() => setShowNewModel(false)}><X size={16} style={{ color: "#64748b" }} /></button>
          </div>
          <Input
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            placeholder="Название модели"
            className="text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
          />
          <Input
            value={newModelDesc}
            onChange={(e) => setNewModelDesc(e.target.value)}
            placeholder="Описание (необязательно)"
            className="text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "#e2e8f0" }}
          />
          <div className="text-xs" style={{ color: "#475569" }}>
            Будут созданы {DEFAULT_STEP_NAMES.length} стандартных шагов (можно переименовать)
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNewModel(false)} style={{ color: "#64748b" }}>Отмена</Button>
            <Button
              size="sm"
              onClick={() => createModelMut.mutate({ name: newModelName || "Новая модель", description: newModelDesc })}
              style={{ background: "#7c6bff", color: "white" }}
            >
              Создать
            </Button>
          </div>
        </div>
      )}

      {models.length === 0 ? (
        <div className="text-center py-16" style={{ color: "#475569" }}>
          <ListOrdered size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm font-medium mb-1">Нет рабочих моделей</div>
          <div className="text-xs">Создайте первую модель с последовательностью шагов</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((model) => (
            <div
              key={model.id}
              onClick={() => setSelectedModel(model)}
              className="rounded-xl p-4 cursor-pointer transition-all"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#7c6bff";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px rgba(124,107,255,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(124,107,255,0.15)" }}
                >
                  <ListOrdered size={18} style={{ color: "#7c6bff" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>{model.name}</div>
                  {model.description && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: "#64748b" }}>{model.description}</div>
                  )}
                  <div className="text-xs mt-1" style={{ color: "#475569" }}>
                    {new Date(model.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step Card ──────────────────────────────────────────────────────────────
function StepCard({
  step,
  onRename,
  onContentChange,
  onDelete,
  onCopy,
}: {
  step: PromptModelStep;
  onRename: (name: string) => void;
  onContentChange: (content: string) => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localContent, setLocalContent] = useState(step.content);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Step header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: "rgba(124,107,255,0.2)", color: "#a78bfa" }}
        >
          {step.stepNumber}
        </div>
        <InlineEdit
          value={step.name}
          onSave={onRename}
          className="flex-1 font-medium text-sm"
          inputClassName="flex-1 font-medium text-sm w-48"
        />
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {step.content && (
            <button onClick={onCopy} className="p-1.5 rounded-lg" style={{ color: "#64748b" }} title="Копировать">
              <Copy size={13} />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ color: "#64748b" }} title="Удалить шаг">
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} style={{ color: "#64748b" }} /> : <ChevronDown size={14} style={{ color: "#64748b" }} />}
        </div>
      </div>

      {/* Expandable content area */}
      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <Textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={() => { if (localContent !== step.content) onContentChange(localContent); }}
            placeholder="Вставьте промт для этого шага..."
            rows={6}
            className="mt-3 text-sm resize-none w-full"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              color: "#e2e8f0",
              borderRadius: "8px",
            }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs" style={{ color: "#475569" }}>
              {localContent.length > 0 ? `${localContent.length} символов` : "Пусто"}
            </span>
            {localContent !== step.content && (
              <button
                onClick={() => onContentChange(localContent)}
                className="text-xs px-3 py-1 rounded-lg"
                style={{ background: "#7c6bff", color: "white" }}
              >
                Сохранить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Prompts Page ──────────────────────────────────────────────────────
export default function Prompts() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #7c6bff, #22d3ee)" }}
        >
          <Brain size={20} color="white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>Промты</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>Хранилище промтов и рабочие модели</p>
        </div>
      </div>

      <Tabs defaultValue="library">
        <TabsList
          className="mb-6"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          <TabsTrigger value="library" style={{ color: "#94a3b8" }}>
            <Brain size={14} className="mr-1.5" /> Библиотека
          </TabsTrigger>
          <TabsTrigger value="models" style={{ color: "#94a3b8" }}>
            <ListOrdered size={14} className="mr-1.5" /> Рабочие модели
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <PromptsLibrary />
        </TabsContent>
        <TabsContent value="models">
          <WorkingModels />
        </TabsContent>
      </Tabs>
    </div>
  );
}
