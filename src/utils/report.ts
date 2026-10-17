export const MONTH_SHORT_EN: readonly string[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_LONG_EN: readonly string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NAME_MAX = 40;
const SERVER_NAME_MAX = 80;
const LABEL_MAX = 60;

// Invalid file-name chars, control chars, emoji / astral symbols and joiners.
// eslint-disable-next-line no-control-regex
const INVALID_CHARS = /[\/:*?"<>|\u0000-\u001f\u007f-\u009f\uD800-\uDFFF\u200B-\u200D\u2600-\u27BF\uFE0F]/g;

const sanitizePart = (raw: string, max: number): string => {
  const cleaned = raw
    .replace(INVALID_CHARS, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, max)
    .replace(/[-.]+$/g, "");
  return cleaned;
};

export const reportFileName = (
  friendName: string | undefined,
  year: number,
  month: number,
): string => {
  const name = sanitizePart(typeof friendName === "string" ? friendName : "", NAME_MAX) || "Friend";
  const mon = MONTH_SHORT_EN[month - 1] ?? String(month);
  return `Finzz-${name}-${mon}-${year}.pdf`;
};

// Temp PDFs written by the share flow; swept from the cache directory because
// they cannot be deleted right after sharing (Android targets read lazily).
export const isStaleReportFile = (name: string): boolean => /^Finzz-.*\.pdf$/.test(name);

export const PDF_SHARE_OPTIONS: {
  mimeType: "application/pdf";
  UTI: "com.adobe.pdf";
  dialogTitle: string;
} = {
  mimeType: "application/pdf",
  UTI: "com.adobe.pdf",
  dialogTitle: "Share report",
};

export interface ParsedExport {
  html: string;
  fileName: string;
  periodLabel: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export const parseExportResponse = (
  body: unknown,
  fallback: { friendName?: string; year: number; month: number },
): ParsedExport => {
  const data = isRecord(body) ? body : {};
  const html = data.html;
  if (typeof html !== "string" || html.trim() === "") {
    throw new Error("No report was returned");
  }

  let fileName = "";
  if (typeof data.fileName === "string") {
    const stem = sanitizePart(data.fileName.replace(/\.pdf$/i, ""), SERVER_NAME_MAX);
    if (stem) fileName = `${stem}.pdf`;
  }
  if (!fileName) fileName = reportFileName(fallback.friendName, fallback.year, fallback.month);

  let periodLabel = "";
  const period = data.period;
  if (isRecord(period) && typeof period.label === "string") {
    periodLabel = period.label.replace(INVALID_CHARS, "").trim().slice(0, LABEL_MAX);
  }
  if (!periodLabel) {
    const monthName = MONTH_LONG_EN[fallback.month - 1] ?? String(fallback.month);
    periodLabel = `${monthName} ${fallback.year}`;
  }

  return { html, fileName, periodLabel };
};
