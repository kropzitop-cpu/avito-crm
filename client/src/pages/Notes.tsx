import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Pin, PinOff, Trash2, X, Tag, Search, StickyNote,
  Check, ChevronDown, ChevronUp, Edit3, List,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── Цвета стикеров ───────────────────────────────────────────────────────────
const STICKER_COLORS = [
  { value: "#1e2235", label: "Тёмный" },
  { value: "#2d1f3d", label: "Фиолетовый" },
  { value: "#1a2e1a", label: "Зелёный" },
  { value: "#2e1a1a", label: "Красный" },
  { value: "#1a2440", label: "Синий" },
  { value: "#2e2a14", label: "Жёлтый" },
  { value: "#1a2c2e", label: "Бирюзовый" },
  { value: "#2e1d2a", label: "Розовый" },
];

// Светлая обводка под цвет стикера
const STICKER_BORDER: Record<string, string> = {
  "#1e2235": "#3a3f5c",
  "#2d1f3d": "#7c6bff",
  "#1a2e1a": "#4ade80",
  "#2e1a1a": "#f87171",
  "#1a2440": "#22d3ee",
  "#2e2a14": "#fbbf24",
  "#1a2c2e": "#06b6d4",
  "#2e1d2a": "#f472b6",
};

const STICKER_ACCENT: Record<string, string> = {
  "#1e2235": "#a78bfa",
  "#2d1f3d": "#c4b5fd",
  "#1a2e1a": "#86efac",
  "#2e1a1a": "#fca5a5",
  "#1a2440": "#7dd3fc",
  "#2e2a14": "#fde68a",
  "#1a2c2e": "#a5f3fc",
  "#2e1d2a": "#fbcfe8",
};

type Note = {
  id: number;
  title: string;
  content: string;
  color: string;
  tags: string; // JSON
  isPinned: boolean;
  folderId: number | null;
  posX: number;
  posY: number;
  createdAt: string;
  updatedAt: string;
};

function parseTags(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) || []; } catch { return []; }
}

// ── Компонент одного стикера ─────────────────────────────────────────────────
function StickerCard({
  note,
  onOpen,
  onPin,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const tags = parseTags(note.tags);
  const border = STICKER_BORDER[note.color] || "#3a3f5c";
  const accent = STICKER_ACCENT[note.color] || "#a78bfa";

  return (
    <div
      onClick={onOpen}
      draggable
      onDragStart={e => { e.dataTransfer.setData("noteId", String(note.id)); e.dataTransfer.effectAllowed = "move"; }}
      className="relative flex flex-col rounded-2xl p-4 cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-[1.02] hover:shadow-xl group"
      style={{
        background: note.color,
        border: `1.5px solid ${border}`,
        boxShadow: `0 2px 16px 0 rgba(0,0,0,0.35)`,
        minHeight: 160,
      }}
    >
      {/* Закреплено */}
      {note.isPinned && (
        <div className="absolute top-3 right-10" style={{ color: accent }}>
          <Pin size={14} />
        </div>
      )}

      {/* Кнопки (видны при hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
          style={{ color: accent }}
          title={note.isPinned ? "Открепить" : "Закрепить"}
        >
          {note.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
          style={{ color: "#f87171" }}
          title="Удалить"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Заголовок */}
      <div className="font-semibold text-sm mb-2 pr-10 leading-snug" style={{ color: "#e2e8f0" }}>
        {note.title || "Без названия"}
      </div>

      {/* Текст (первые 200 символов) */}
      {note.content && (
        <div
          className="text-xs leading-relaxed flex-1 overflow-hidden"
          style={{ color: "#94a3b8", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" } as any}
        >
          {note.content}
        </div>
      )}

      {/* Теги */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: `${border}88`, color: accent, border: `1px solid ${border}` }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Дата */}
      <div className="text-xs mt-2" style={{ color: "#475569" }}>
        {new Date(note.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
      </div>
    </div>
  );
}

// ── Панель редактирования заметки ────────────────────────────────────────────
function NotePanel({
  note,
  folders,
  onClose,
  onSave,
  onDelete,
}: {
  note: Note | null;
  folders: { id: number; name: string; color: string }[];
  onClose: () => void;
  onSave: (data: Partial<Note>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("#1e2235");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<number | null>(null);

  const dataRef = useRef({ title: "", content: "", color: "#1e2235", tags: [] as string[], folderId: null as number | null });
  const prevNoteIdRef = useRef<number | null>(null);

  useEffect(() => { dataRef.current = { title, content, color, tags, folderId }; }, [title, content, color, tags, folderId]);

  useEffect(() => {
    if (!note) return;
    if (prevNoteIdRef.current !== null && prevNoteIdRef.current !== note.id) {
      const d = dataRef.current;
      onSave({ title: d.title, content: d.content, color: d.color, tags: JSON.stringify(d.tags), folderId: d.folderId } as any);
    }
    prevNoteIdRef.current = note.id;
    setTitle(note.title || "");
    setContent(note.content || "");
    setColor(note.color || "#1e2235");
    setTags(parseTags(note.tags));
    setFolderId((note as any).folderId ?? null);
    setTagInput("");
  }, [note?.id]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleSave = () => {
    onSave({ title, content, color, tags: JSON.stringify(tags), folderId } as any);
  };

  if (!note) return null;

  const accent = STICKER_ACCENT[color] || "#a78bfa";
  const border = STICKER_BORDER[color] || "#3a3f5c";

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#131520", borderLeft: "1px solid #252840" }}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#252840" }}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} style={{ color: accent }} />
          <span className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>Редактирование</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} className="h-7 px-3 text-xs" style={{ background: "#7c6bff", color: "#fff" }}>
            <Check size={12} className="mr-1" /> Сохранить
          </Button>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5" style={{ color: "#64748b" }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {/* Название */}
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: "#64748b" }}>Название</div>
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            placeholder="Название заметки"
            className="border-[#252840] text-sm"
            style={{ background: "#191c2a", color: "#e2e8f0" }}
          />
        </div>

        {/* Цвет стикера */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: "#64748b" }}>Цвет стикера</div>
          <div className="flex flex-wrap gap-2">
            {STICKER_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => { setColor(c.value); setDirty(true); }}
                title={c.label}
                className="w-7 h-7 rounded-lg transition-all"
                style={{
                  background: c.value,
                  border: color === c.value ? `2px solid ${STICKER_BORDER[c.value] || "#fff"}` : "2px solid transparent",
                  boxShadow: color === c.value ? `0 0 8px ${STICKER_BORDER[c.value]}88` : "none",
                  outline: color === c.value ? `1.5px solid ${STICKER_ACCENT[c.value] || "#a78bfa"}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Папка */}
        {folders.length > 0 && (
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "#64748b" }}>Папка</div>
            <select
              value={folderId ?? ""}
              onChange={e => { setFolderId(e.target.value ? Number(e.target.value) : null); }}
              className="w-full h-8 text-xs rounded-lg px-2 border"
              style={{ background: "#191c2a", color: "#e2e8f0", borderColor: "#252840" }}
            >
              <option value="">Без папки</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {/* Теги */}
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: "#64748b" }}>Теги</div>
          <div className="flex gap-2 mb-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
              placeholder="Добавить тег..."
              className="border-[#252840] text-xs h-8"
              style={{ background: "#191c2a", color: "#e2e8f0" }}
            />
            <Button size="sm" onClick={addTag} className="h-8 px-3" style={{ background: "#1e2235", border: `1px solid ${border}`, color: accent }}>
              <Tag size={12} />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full cursor-pointer hover:opacity-80"
                style={{ background: `${border}55`, color: accent, border: `1px solid ${border}` }}
                onClick={() => removeTag(t)}
              >
                #{t} <X size={10} />
              </span>
            ))}
          </div>
        </div>

        {/* Текст заметки */}
        <div className="flex-1 flex flex-col">
          <div className="text-xs font-medium mb-1.5" style={{ color: "#64748b" }}>Текст заметки</div>
          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            placeholder="Запишите что-нибудь..."
            className="flex-1 border-[#252840] text-sm resize-none"
            style={{ background: "#191c2a", color: "#e2e8f0", minHeight: 200 }}
          />
        </div>
      </div>

      {/* Кнопки внизу */}
      <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "#252840" }}>
        <Button onClick={handleSave} className="flex-1 text-sm" style={{ background: "#7c6bff", color: "#fff" }}>
          <Check size={14} className="mr-1.5" /> Сохранить
        </Button>
        <Button
          onClick={onDelete}
          variant="outline"
          className="px-3 border-red-500/30 hover:bg-red-500/10"
          style={{ color: "#f87171" }}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────────────────────
type NoteFolder = { id: number; name: string; color: string; createdAt: string };

export default function Notes() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null | "all">("all");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#7c6bff");
  const [dragOverFolder, setDragOverFolder] = useState<number | null | "all" | "none">(null);

  const { data: rawNotes = [] } = useQuery<Note[]>({ queryKey: ["/api/notes"], throwOnError: false });
  const { data: folders = [] } = useQuery<NoteFolder[]>({ queryKey: ["/api/note-folders"], throwOnError: false });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Note>) => { const r = await apiRequest("POST", "/api/notes", data); return r.json(); },
    onSuccess: (note) => { queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); setActiveNote(note); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Note> }) => { const r = await apiRequest("PATCH", `/api/notes/${id}`, data); return r.json(); },
    onSuccess: (updated) => { queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); if (activeNote && updated?.id === activeNote.id) setActiveNote(updated); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/notes/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/notes"] }); setActiveNote(null); toast({ title: "Заметка удалена" }); },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => { const r = await apiRequest("POST", "/api/note-folders", data); return r.json(); },
    onSuccess: (folder) => { queryClient.invalidateQueries({ queryKey: ["/api/note-folders"] }); setSelectedFolderId(folder.id); setShowNewFolder(false); setNewFolderName(""); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/note-folders/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/note-folders", "/api/notes"] }); setSelectedFolderId("all"); toast({ title: "Папка удалена" }); },
  });

  // Поиск по тексту И по тегам
  const filtered = useMemo(() => {
    return rawNotes.filter((n) => {
      // Фильтр папки
      if (selectedFolderId !== "all") {
        if (selectedFolderId === null && n.folderId != null) return false;
        if (selectedFolderId !== null && n.folderId !== selectedFolderId) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      const inTitle = n.title.toLowerCase().includes(q);
      const inContent = (n.content || "").toLowerCase().includes(q);
      const inTags = parseTags(n.tags).some(t => t.toLowerCase().includes(q));
      return inTitle || inContent || inTags;
    });
  }, [rawNotes, search, selectedFolderId]);

  const pinned = filtered.filter(n => n.isPinned);
  const unpinned = filtered.filter(n => !n.isPinned);

  const handleCreate = () => {
    const folderId = selectedFolderId !== "all" ? selectedFolderId : null;
    createMutation.mutate({ title: "Новая заметка", content: "", color: "#1e2235", tags: "[]", isPinned: false, folderId } as any);
  };

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: number | null) => {
    e.preventDefault();
    setDragOverFolder(null);
    const noteId = parseInt(e.dataTransfer.getData("noteId"));
    if (!noteId) return;
    const note = rawNotes.find(n => n.id === noteId);
    if (!note) return;
    if (note.folderId === targetFolderId) return; // already there
    updateMutation.mutate({ id: noteId, data: { folderId: targetFolderId } });
    toast({ title: targetFolderId === null ? "Заметка убрана из папки" : "Заметка перемещена в папку" });
  };

  const handleSave = useCallback((data: Partial<Note>) => {
    if (!activeNote) return;
    updateMutation.mutate({ id: activeNote.id, data });
  }, [activeNote?.id]);

  const handlePin = (note: Note) => { updateMutation.mutate({ id: note.id, data: { isPinned: !note.isPinned } }); };
  const handleDelete = (id: number) => { deleteMutation.mutate(id); };

  const FOLDER_COLORS = ["#7c6bff","#22d3ee","#4ade80","#f87171","#fbbf24","#fb923c","#f472b6","#94a3b8"];

  const currentFolderName = selectedFolderId === "all"
    ? "Все заметки"
    : selectedFolderId === null
    ? "Без папки"
    : folders.find(f => f.id === selectedFolderId)?.name || "Заметки";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-bg-deep)" }}>

      {/* ── Левый сайдбар: папки ── */}
      <div className="w-52 shrink-0 flex flex-col border-r overflow-hidden" style={{ background: "#0a0c17", borderColor: "#252840" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "#252840" }}>
          <div className="flex items-center gap-2 mb-3">
            <StickyNote size={14} style={{ color: "#a78bfa" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Папки</span>
          </div>
          {/* Поиск */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="pl-7 h-7 text-xs border-[#252840]"
              style={{ background: "#131520", color: "#e2e8f0" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Все заметки */}
          <button
            onClick={() => setSelectedFolderId("all")}
            className="w-full text-left px-4 py-2 flex items-center gap-2.5 transition-colors hover:bg-white/5"
            style={{
              background: selectedFolderId === "all" ? "rgba(124,107,255,0.1)" : "transparent",
              borderLeft: selectedFolderId === "all" ? "2px solid #7c6bff" : "2px solid transparent",
            }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#a78bfa" }} />
            <span className="text-xs flex-1 truncate" style={{ color: selectedFolderId === "all" ? "#e2e8f0" : "#94a3b8" }}>Все заметки</span>
            <span className="text-xs" style={{ color: "#334155" }}>{rawNotes.length}</span>
          </button>

          {/* Без папки — дроп-зона */}
          <div
            onClick={() => setSelectedFolderId(null)}
            onDragOver={e => { e.preventDefault(); setDragOverFolder("none"); }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={e => handleDropOnFolder(e, null)}
            className="w-full text-left px-4 py-2 flex items-center gap-2.5 transition-colors hover:bg-white/5 cursor-pointer"
            style={{
              background: dragOverFolder === "none" ? "rgba(71,85,105,0.25)" : selectedFolderId === null ? "rgba(124,107,255,0.1)" : "transparent",
              borderLeft: selectedFolderId === null ? "2px solid #475569" : dragOverFolder === "none" ? "2px solid #475569" : "2px solid transparent",
              outline: dragOverFolder === "none" ? "1.5px dashed #475569" : "none",
              borderRadius: dragOverFolder === "none" ? 8 : 0,
            }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#475569" }} />
            <span className="text-xs flex-1 truncate" style={{ color: selectedFolderId === null ? "#e2e8f0" : "#94a3b8" }}>Без папки</span>
            <span className="text-xs" style={{ color: "#334155" }}>{rawNotes.filter(n => n.folderId == null).length}</span>
          </div>

          {/* Разделитель */}
          {folders.length > 0 && <div className="mx-4 my-2 border-t" style={{ borderColor: "#1e2235" }} />}

          {/* Папки пользователя */}
          {folders.map(folder => {
            const count = rawNotes.filter(n => n.folderId === folder.id).length;
            const isActive = selectedFolderId === folder.id;
            const isDragOver = dragOverFolder === folder.id;
            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                onDragOver={e => { e.preventDefault(); setDragOverFolder(folder.id); }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={e => handleDropOnFolder(e, folder.id)}
                className="w-full text-left px-4 py-2 flex items-center gap-2.5 transition-colors hover:bg-white/5 cursor-pointer group"
                style={{
                  background: isDragOver ? `${folder.color}20` : isActive ? "rgba(124,107,255,0.1)" : "transparent",
                  borderLeft: isActive ? `2px solid ${folder.color}` : isDragOver ? `2px solid ${folder.color}` : "2px solid transparent",
                  outline: isDragOver ? `1.5px dashed ${folder.color}` : "none",
                  borderRadius: isDragOver ? 8 : 0,
                }}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: folder.color }} />
                <span className="text-xs flex-1 truncate" style={{ color: isActive || isDragOver ? "#e2e8f0" : "#94a3b8" }}>{folder.name}</span>
                <span className="text-xs" style={{ color: "#334155" }}>{count}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteFolderMutation.mutate(folder.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
                  style={{ color: "#f87171" }}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Новая папка */}
        <div className="p-3 border-t" style={{ borderColor: "#252840" }}>
          {showNewFolder ? (
            <div className="space-y-2">
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newFolderName.trim()) createFolderMutation.mutate({ name: newFolderName.trim(), color: newFolderColor }); if (e.key === "Escape") setShowNewFolder(false); }}
                placeholder="Название папки"
                autoFocus
                className="h-7 text-xs border-[#252840]"
                style={{ background: "#131520", color: "#e2e8f0" }}
              />
              <div className="flex gap-1 flex-wrap">
                {FOLDER_COLORS.map(c => (
                  <button key={c} onClick={() => setNewFolderColor(c)}
                    className="w-5 h-5 rounded-md transition-all"
                    style={{ background: c, outline: newFolderColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1 h-6 text-xs" style={{ background: "#7c6bff", color: "#fff" }}
                  onClick={() => { if (newFolderName.trim()) createFolderMutation.mutate({ name: newFolderName.trim(), color: newFolderColor }); }}>
                  <Check size={10} className="mr-1" />Создать
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setShowNewFolder(false)}>
                  <X size={10} />
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewFolder(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
              style={{ color: "#a78bfa", border: "1px dashed #7c6bff44" }}>
              <Plus size={11} /> Новая папка
            </button>
          )}
        </div>
      </div>

      {/* ── Основная область ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Шапка */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: "#252840" }}>
            <div className="flex items-center gap-3">
              <div className="font-bold text-sm" style={{ color: "#e2e8f0" }}>{currentFolderName}</div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1e2235", color: "#64748b" }}>{filtered.length}</span>
            </div>
            <Button onClick={handleCreate} size="sm" className="h-8 px-3 text-xs font-medium"
              style={{ background: "linear-gradient(135deg, #7c6bff, #a78bfa)", color: "#fff", border: "none" }}>
              <Plus size={14} className="mr-1" /> Новая заметка
            </Button>
          </div>

          {/* Стикерная доска */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {rawNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "#334155" }}>
                <StickyNote size={48} strokeWidth={1} />
                <div className="text-center">
                  <div className="text-base font-medium mb-1" style={{ color: "#475569" }}>Заметок пока нет</div>
                  <div className="text-sm">Нажмите «Новая заметка» чтобы начать</div>
                </div>
                <Button onClick={handleCreate} style={{ background: "linear-gradient(135deg, #7c6bff, #a78bfa)", color: "#fff", border: "none" }}>
                  <Plus size={14} className="mr-1.5" /> Создать первую заметку
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "#334155" }}>
                <Search size={32} strokeWidth={1} />
                <div className="text-sm" style={{ color: "#475569" }}>Ничего не найдено</div>
              </div>
            ) : (
              <div className="space-y-5">
                {pinned.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Pin size={12} style={{ color: "#a78bfa" }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Закреплённые</span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {pinned.map(n => (
                        <StickerCard key={n.id} note={n} onOpen={() => setActiveNote(n)} onPin={() => handlePin(n)} onDelete={() => handleDelete(n.id)} />
                      ))}
                    </div>
                  </div>
                )}
                {unpinned.length > 0 && (
                  <div>
                    {pinned.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <StickyNote size={12} style={{ color: "#64748b" }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Остальные</span>
                      </div>
                    )}
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {unpinned.map(n => (
                        <StickerCard key={n.id} note={n} onOpen={() => setActiveNote(n)} onPin={() => handlePin(n)} onDelete={() => handleDelete(n.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Правый список ── */}
        <div className="w-48 shrink-0 border-l flex flex-col overflow-hidden" style={{ background: "#0a0c17", borderColor: "#252840" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#252840" }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Список</div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0
              ? <div className="px-4 py-6 text-xs text-center" style={{ color: "#334155" }}>Пусто</div>
              : filtered.map(n => {
                  const isActive = activeNote?.id === n.id;
                  const accent = STICKER_ACCENT[n.color] || "#a78bfa";
                  return (
                    <button key={n.id} onClick={() => setActiveNote(n)}
                      className="w-full text-left px-3 py-2 flex items-start gap-2 transition-colors hover:bg-white/5"
                      style={{ background: isActive ? "rgba(124,107,255,0.08)" : "transparent", borderLeft: isActive ? "2px solid #7c6bff" : "2px solid transparent" }}>
                      <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: n.color, border: `1.5px solid ${STICKER_BORDER[n.color] || "#3a3f5c"}` }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate" style={{ color: isActive ? "#e2e8f0" : "#94a3b8" }}>{n.title || "Без названия"}</div>
                        <div className="text-xs" style={{ color: "#334155" }}>
                          {new Date(n.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </button>
                  );
                })
            }
          </div>
          <div className="p-3 border-t" style={{ borderColor: "#252840" }}>
            <button onClick={handleCreate}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
              style={{ color: "#a78bfa", border: "1px dashed #7c6bff44" }}>
              <Plus size={11} /> Добавить
            </button>
          </div>
        </div>
      </div>

      {/* ── Панель редактирования ── */}
      {activeNote && (
        <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor: "#252840" }}>
          <NotePanel
            note={activeNote}
            folders={folders}
            onClose={() => setActiveNote(null)}
            onSave={handleSave}
            onDelete={() => handleDelete(activeNote.id)}
          />
        </div>
      )}
    </div>
  );
}
