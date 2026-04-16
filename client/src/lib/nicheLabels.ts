export const NICHE_LABELS: Record<string, string> = {
  pest_control: "Уничтожение вредителей",
  cleaning: "Клининг",
  auto: "Авто / аренда",
  construction: "Строительство",
  ceilings: "Натяжные потолки",
  repair: "Ремонт",
  beauty: "Красота / здоровье",
  other: "Другое",
};

export const nicheLabel = (v: string | null | undefined) =>
  v ? (NICHE_LABELS[v] ?? v) : "Ниша не указана";
