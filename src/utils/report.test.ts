import { describe, it, expect } from "vitest";
import {
  MONTH_SHORT_EN,
  PDF_SHARE_OPTIONS,
  isStaleReportFile,
  parseExportResponse,
  reportFileName,
} from "./report";

describe("isStaleReportFile", () => {
  it("matches generated report files", () => {
    expect(isStaleReportFile("Finzz-Summer-Oct-2026.pdf")).toBe(true);
    expect(isStaleReportFile("Finzz-.pdf")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isStaleReportFile("Print-1234.pdf")).toBe(false);
    expect(isStaleReportFile("Finzz-Summer.png")).toBe(false);
    expect(isStaleReportFile("Finzz-Summer.pdf.tmp")).toBe(false);
    expect(isStaleReportFile("my-Finzz-Summer.pdf")).toBe(false);
    expect(isStaleReportFile("")).toBe(false);
  });
});

describe("MONTH_SHORT_EN", () => {
  it("has 12 short names", () => {
    expect(MONTH_SHORT_EN).toHaveLength(12);
    expect(MONTH_SHORT_EN[0]).toBe("Jan");
    expect(MONTH_SHORT_EN[11]).toBe("Dec");
  });
});

describe("reportFileName", () => {
  it("builds the basic name", () => {
    expect(reportFileName("Summer", 2026, 10)).toBe("Finzz-Summer-Oct-2026.pdf");
  });
  it("collapses whitespace to a dash", () => {
    expect(reportFileName("  Mary   Jane ", 2026, 1)).toBe("Finzz-Mary-Jane-Jan-2026.pdf");
  });
  it("strips invalid file-name characters", () => {
    expect(reportFileName('a/b\c:d*e?f"g<h>i|j', 2026, 3)).toBe("Finzz-abcdefghij-Mar-2026.pdf");
  });
  it("strips control characters", () => {
    expect(reportFileName("Jo\u0000\u0007e\n", 2026, 3)).toBe("Finzz-Joe-Mar-2026.pdf");
  });
  it("removes emoji consistently", () => {
    expect(reportFileName("Sam 😀", 2026, 5)).toBe("Finzz-Sam-May-2026.pdf");
    expect(reportFileName("😀😀", 2026, 5)).toBe("Finzz-Friend-May-2026.pdf");
  });
  it("limits the name part to 40 chars", () => {
    const name = "A".repeat(100);
    expect(reportFileName(name, 2026, 12)).toBe(`Finzz-${"A".repeat(40)}-Dec-2026.pdf`);
  });
  it("falls back to Friend for empty or missing names", () => {
    expect(reportFileName("", 2026, 2)).toBe("Finzz-Friend-Feb-2026.pdf");
    expect(reportFileName(undefined, 2026, 2)).toBe("Finzz-Friend-Feb-2026.pdf");
    expect(reportFileName("   ", 2026, 2)).toBe("Finzz-Friend-Feb-2026.pdf");
    expect(reportFileName("///", 2026, 2)).toBe("Finzz-Friend-Feb-2026.pdf");
  });
});

describe("PDF_SHARE_OPTIONS", () => {
  it("has the expected values", () => {
    expect(PDF_SHARE_OPTIONS).toEqual({
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Share report",
    });
  });
});

describe("parseExportResponse", () => {
  const fallback = { friendName: "Summer", year: 2026, month: 10 };

  it("handles the old shape { success, html }", () => {
    expect(parseExportResponse({ success: true, html: "<p>x</p>" }, fallback)).toEqual({
      html: "<p>x</p>",
      fileName: "Finzz-Summer-Oct-2026.pdf",
      periodLabel: "October 2026",
    });
  });

  it("handles the new shape", () => {
    const body = {
      success: true,
      html: "<p>x</p>",
      fileName: "Finzz-Summer-Oct-2026.pdf",
      period: { year: 2026, month: 10, label: "October 2026" },
    };
    expect(parseExportResponse(body, fallback)).toEqual({
      html: "<p>x</p>",
      fileName: "Finzz-Summer-Oct-2026.pdf",
      periodLabel: "October 2026",
    });
  });

  it("uses a valid server fileName and label", () => {
    const r = parseExportResponse(
      { html: "<p/>", fileName: "Custom.pdf", period: { label: "Oct 2026 (partial)" } },
      fallback,
    );
    expect(r.fileName).toBe("Custom.pdf");
    expect(r.periodLabel).toBe("Oct 2026 (partial)");
  });

  it("throws when html is missing or empty", () => {
    expect(() => parseExportResponse({ success: true }, fallback)).toThrow("No report was returned");
    expect(() => parseExportResponse({ html: "" }, fallback)).toThrow("No report was returned");
    expect(() => parseExportResponse({ html: "   " }, fallback)).toThrow("No report was returned");
    expect(() => parseExportResponse({ html: 5 }, fallback)).toThrow("No report was returned");
    expect(() => parseExportResponse(null, fallback)).toThrow("No report was returned");
    expect(() => parseExportResponse(undefined, fallback)).toThrow("No report was returned");
  });

  it("sanitises a malicious server fileName and ensures .pdf", () => {
    const r = parseExportResponse({ html: "<p/>", fileName: "../../x" }, fallback);
    expect(r.fileName).toBe("x.pdf");
    expect(r.fileName).not.toMatch(/[\/]/);
    const r2 = parseExportResponse({ html: "<p/>", fileName: "..\..\evil.exe" }, fallback);
    expect(r2.fileName.endsWith(".pdf")).toBe(true);
    expect(r2.fileName).not.toMatch(/[\/]/);
    expect(r2.fileName.startsWith(".")).toBe(false);
  });

  it("falls back when server fileName / label are invalid", () => {
    const r = parseExportResponse(
      { html: "<p/>", fileName: "///", period: { label: 42 } },
      fallback,
    );
    expect(r.fileName).toBe("Finzz-Summer-Oct-2026.pdf");
    expect(r.periodLabel).toBe("October 2026");
    const r2 = parseExportResponse({ html: "<p/>", fileName: 7, period: "x" }, fallback);
    expect(r2.fileName).toBe("Finzz-Summer-Oct-2026.pdf");
  });
});
