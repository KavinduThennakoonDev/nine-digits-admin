import "server-only";
import ExcelJS from "exceljs";

export type ExportColumn<T> = { header: string; width?: number; value: (row: T) => string | number | Date | null };

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return "﻿" + lines.join("\r\n"); // BOM so Excel opens UTF-8 correctly
}

export async function toXlsx<T>(sheetName: string, columns: ExportColumn<T>[], rows: T[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nine Digits Admin";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c, i) => ({ header: c.header, key: String(i), width: c.width ?? 18 }));
  for (const row of rows) {
    ws.addRow(Object.fromEntries(columns.map((c, i) => {
      const v = c.value(row);
      return [String(i), typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v];
    })));
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF6600" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
