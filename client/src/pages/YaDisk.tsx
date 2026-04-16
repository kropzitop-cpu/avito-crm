import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { HardDrive, FolderOpen, File, Link2, Copy, Check, RefreshCw, Upload, Plus, ChevronRight, ArrowLeft } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface YaDiskInfo {
  total_space: number;
  used_space: number;
  login?: string;
}

interface YaDiskFile {
  name: string;
  path: string;
  type: "dir" | "file";
  size?: number;
  mime_type?: string;
  public_url?: string;
  modified?: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export default function YaDisk() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [currentFolder, setCurrentFolder] = useState("disk:/");
  const [folderPath, setFolderPath] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Load saved token from settings
  const { data: tokenData, isLoading: tokenLoading } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/settings/yadisk_token"],
    queryFn: () => apiRequest("GET", "/api/settings/yadisk_token").then(r => r.json()),
    throwOnError: false,
  });

  // Применяем токен из БД при загрузке
  useEffect(() => {
    if (tokenData?.value) {
      setSavedToken(tokenData.value);
      setToken(tokenData.value);
    }
  }, [tokenData]);

  const saveTokenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { key: "yadisk_token", value: token }),
    onSuccess: () => {
      setSavedToken(token);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/yadisk_token"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yadisk/info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yadisk/files"] });
      toast({ title: "Токен сохранён" });
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings", { key: "yadisk_token", value: "" }),
    onSuccess: () => {
      setSavedToken("");
      setToken("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/yadisk_token"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yadisk/info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yadisk/files"] });
      toast({ title: "Токен удалён" });
    },
  });

  // Disk info
  const { data: diskInfo, isLoading: infoLoading, refetch: refetchInfo } = useQuery<YaDiskInfo>({
    queryKey: ["/api/yadisk/info"],
    enabled: !!savedToken,
    queryFn: () => apiRequest("GET", "/api/yadisk/info").then(r => r.json()),
    retry: false,
  });

  // Files in current folder
  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery<{ items: YaDiskFile[] }>({
    queryKey: ["/api/yadisk/files", currentFolder],
    enabled: !!savedToken,
    queryFn: () => apiRequest("GET", `/api/yadisk/files?folder=${encodeURIComponent(currentFolder)}`).then(r => r.json()),
    retry: false,
  });

  const files = filesData?.items ?? [];

  const publishMutation = useMutation({
    mutationFn: (path: string) => apiRequest("POST", "/api/yadisk/publish", { path }).then(r => r.json()),
    onSuccess: (data, path) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yadisk/files", currentFolder] });
      const url = data?.href || data?.public_url || "";
      if (url) {
        copyToClipboard(url);
        toast({ title: "Ссылка скопирована!", description: url });
      } else {
        refetchFiles();
        toast({ title: "Файл опубликован" });
      }
    },
    onError: () => toast({ title: "Ошибка публикации", variant: "destructive" }),
  });

  const mkdirMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await apiRequest("POST", "/api/yadisk/mkdir", { path });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.already_exists) {
        toast({ title: "Папка уже существует" });
      } else {
        toast({ title: "Папка создана" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/yadisk/files", currentFolder] });
      setNewFolderName("");
      setShowNewFolder(false);
    },
    onError: (e: any) => {
      const msg = e?.message || "Ошибка создания папки";
      toast({ title: msg, variant: "destructive" });
    },
  });

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url).catch(() => {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  function navigateToFolder(folder: YaDiskFile) {
    setFolderPath(fp => [...fp, currentFolder]);
    setCurrentFolder(folder.path);
  }

  function navigateBack() {
    if (folderPath.length === 0) return;
    const prev = folderPath[folderPath.length - 1];
    setFolderPath(fp => fp.slice(0, -1));
    setCurrentFolder(prev);
  }

  function navigateToRoot() {
    setFolderPath([]);
    setCurrentFolder("disk:/");
  }

  const usedPercent = diskInfo ? Math.round((diskInfo.used_space / diskInfo.total_space) * 100) : 0;

  if (tokenLoading) {
    return <div className="p-6" style={{ color: "#64748b" }}>Загрузка...</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#e2e8f0" }}>
          Яндекс Диск
        </h1>
        <p className="text-sm" style={{ color: "#64748b" }}>
          Управление файлами, публичные ссылки для автозагрузки Авито
        </p>
      </div>

      {/* Token setup */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={16} style={{ color: "#7c6bff" }} />
          <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>OAuth-токен</span>
          {savedToken && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
              Подключено
            </span>
          )}
        </div>

        {savedToken ? (
          /* Токен уже сохранён — показываем маску + кнопки */
          <div className="flex items-center gap-3">
            <div
              className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "#64748b" }}
            >
              {savedToken.slice(0, 8)}{'\u2022'.repeat(16)}{savedToken.slice(-4)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSavedToken(""); setToken(""); }}
              className="border-border gap-1.5"
              style={{ color: "#94a3b8" }}
            >
              Изменить
            </Button>
            <Button
              size="sm"
              onClick={() => deleteTokenMutation.mutate()}
              disabled={deleteTokenMutation.isPending}
              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
            >
              {deleteTokenMutation.isPending ? "Удаляем..." : "Отвязать"}
            </Button>
          </div>
        ) : (
          /* Токен не задан — поле ввода */
          <>
            <p className="text-xs mb-3" style={{ color: "#64748b" }}>
              Получить токен:{" "}
              <a
                href="https://oauth.yandex.ru/authorize?response_type=token&client_id=1e9f6b5b5d2a4d1190bbac5d06f49e80"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#22d3ee", textDecoration: "underline" }}
              >
                oauth.yandex.ru
              </a>
              {" "}→ авторизуйтесь → скопируйте токен из URL (access_token=...)
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="y0_AgAAAA..."
                className="bg-transparent border-border flex-1"
                data-testid="input-yadisk-token"
              />
              <Button
                onClick={() => saveTokenMutation.mutate()}
                disabled={!token || saveTokenMutation.isPending}
                style={{ background: "var(--color-violet)", color: "white" }}
              >
                {saveTokenMutation.isPending ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </>
        )}
      </div>

      {!savedToken ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <HardDrive size={48} className="mx-auto mb-4" style={{ color: "#334155" }} />
          <p className="text-sm" style={{ color: "#475569" }}>
            Введите OAuth-токен для подключения к Яндекс Диску
          </p>
        </div>
      ) : (
        <>
          {/* Disk info */}
          {diskInfo && (
            <div
              className="rounded-2xl p-4 mb-5 flex flex-wrap gap-6 items-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div>
                <div className="text-xs mb-1" style={{ color: "#64748b" }}>Использовано</div>
                <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                  {formatBytes(diskInfo.used_space)} / {formatBytes(diskInfo.total_space)}
                </div>
              </div>
              <div className="flex-1 min-w-32">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${usedPercent}%`, background: usedPercent > 80 ? "#f87171" : "#7c6bff" }}
                  />
                </div>
                <div className="text-xs mt-1" style={{ color: "#64748b" }}>{usedPercent}%</div>
              </div>
              <button
                onClick={() => { refetchInfo(); refetchFiles(); }}
                className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
                style={{ color: "#7c6bff" }}
              >
                <RefreshCw size={13} /> Обновить
              </button>
            </div>
          )}

          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <button
                onClick={navigateToRoot}
                className="transition-colors hover:text-violet-400"
                style={{ color: folderPath.length === 0 ? "#e2e8f0" : "#7c6bff" }}
              >
                Диск
              </button>
              {folderPath.map((_, i) => {
                const label = _.replace(/^disk:\//, "").split("/").filter(Boolean).pop() || "disk";
                return (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight size={12} style={{ color: "#475569" }} />
                    <button style={{ color: "#7c6bff" }} className="hover:opacity-80">
                      {label}
                    </button>
                  </span>
                );
              })}
              {currentFolder !== "disk:/" && (
                <span className="flex items-center gap-1">
                  <ChevronRight size={12} style={{ color: "#475569" }} />
                  <span style={{ color: "#e2e8f0" }}>
                    {currentFolder.replace(/^disk:\//, "").split("/").filter(Boolean).pop() || "disk"}
                  </span>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {folderPath.length > 0 && (
                <Button variant="outline" size="sm" onClick={navigateBack} className="gap-1.5 border-border">
                  <ArrowLeft size={13} /> Назад
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewFolder(v => !v)}
                className="gap-1.5 border-border"
              >
                <Plus size={13} /> Папка
              </Button>
            </div>
          </div>

          {/* New folder input */}
          {showNewFolder && (
            <div className="flex gap-2 mb-3">
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Название папки"
                className="bg-transparent border-border"
                onKeyDown={e => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    const path = currentFolder.replace(/\/$/, "") + "/" + newFolderName.trim();
                    mkdirMutation.mutate(path);
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (!newFolderName.trim()) return;
                  const path = currentFolder.replace(/\/$/, "") + "/" + newFolderName.trim();
                  mkdirMutation.mutate(path);
                }}
                disabled={!newFolderName.trim() || mkdirMutation.isPending}
                style={{ background: "var(--color-violet)", color: "white" }}
              >
                Создать
              </Button>
            </div>
          )}

          {/* File list */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {filesLoading || infoLoading ? (
              <div className="p-8 text-center text-sm" style={{ color: "#475569" }}>
                Загрузка файлов...
              </div>
            ) : files.length === 0 ? (
              <div className="p-12 text-center text-sm" style={{ color: "#475569" }}>
                Папка пуста
              </div>
            ) : (
              <div>
                {/* Header row */}
                <div
                  className="grid grid-cols-12 px-4 py-2 text-xs font-medium"
                  style={{ color: "#475569", borderBottom: "1px solid var(--color-border)" }}
                >
                  <div className="col-span-5">Имя</div>
                  <div className="col-span-2">Размер</div>
                  <div className="col-span-3">Публичная ссылка</div>
                  <div className="col-span-2 text-right">Действия</div>
                </div>
                {files.map((f, i) => (
                  <div
                    key={f.path}
                    className="grid grid-cols-12 items-center px-4 py-3 transition-colors hover:bg-white/5"
                    style={{ borderBottom: i < files.length - 1 ? "1px solid var(--color-border)" : "none" }}
                    data-testid={`row-file-${i}`}
                  >
                    {/* Name */}
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      {f.type === "dir" ? (
                        <FolderOpen size={16} style={{ color: "#fbbf24" }} className="shrink-0" />
                      ) : (
                        <File size={16} style={{ color: "#7c6bff" }} className="shrink-0" />
                      )}
                      {f.type === "dir" ? (
                        <button
                          onClick={() => navigateToFolder(f)}
                          className="text-sm truncate text-left hover:opacity-80"
                          style={{ color: "#e2e8f0" }}
                        >
                          {f.name}
                        </button>
                      ) : (
                        <span className="text-sm truncate" style={{ color: "#94a3b8" }}>{f.name}</span>
                      )}
                    </div>

                    {/* Size */}
                    <div className="col-span-2 text-xs" style={{ color: "#475569" }}>
                      {f.size ? formatBytes(f.size) : f.type === "dir" ? "—" : "—"}
                    </div>

                    {/* Public URL */}
                    <div className="col-span-3 min-w-0">
                      {f.public_url ? (
                        <a
                          href={f.public_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs truncate block hover:underline"
                          style={{ color: "#22d3ee" }}
                          title={f.public_url}
                        >
                          {f.public_url.replace("https://disk.yandex.ru/", "").slice(0, 28)}...
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: "#334155" }}>Не опубликован</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex gap-2 justify-end">
                      {f.type !== "dir" && (
                        <>
                          <button
                            onClick={() => publishMutation.mutate(f.path)}
                            disabled={publishMutation.isPending}
                            title="Опубликовать и получить ссылку"
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
                            style={{ color: "#7c6bff", border: "1px solid rgba(124,107,255,0.3)" }}
                            data-testid={`button-publish-${i}`}
                          >
                            <Link2 size={11} /> Ссылка
                          </button>
                          {f.public_url && (
                            <button
                              onClick={() => copyToClipboard(f.public_url!)}
                              title="Скопировать ссылку"
                              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/10"
                              style={{ color: copiedUrl === f.public_url ? "#4ade80" : "#64748b" }}
                              data-testid={`button-copy-${i}`}
                            >
                              {copiedUrl === f.public_url ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Usage hint */}
          <div
            className="mt-4 rounded-xl px-4 py-3 text-xs"
            style={{ background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.2)", color: "#64748b" }}
          >
            <span style={{ color: "#22d3ee" }}>Подсказка:</span> Нажмите «Ссылка» рядом с файлом, чтобы опубликовать его и получить публичную ссылку — она сразу скопируется в буфер обмена и подойдёт для автозагрузки Авито.
          </div>
        </>
      )}
    </div>
  );
}
