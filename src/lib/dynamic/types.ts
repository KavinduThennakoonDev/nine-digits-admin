import type { Currency } from "@/lib/constants";

/** Every supported field type. Behaviour for each lives in ./registry.ts. */
export const FIELD_TYPES = [
  "text", "textarea", "number", "currency", "email", "phone", "url",
  "date", "datetime", "select", "multiselect", "checkbox", "boolean", "file",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_META: Record<FieldType, { label: string; description: string }> = {
  text: { label: "Text", description: "A single line of text" },
  textarea: { label: "Long text", description: "Paragraphs and notes" },
  number: { label: "Number", description: "Whole or decimal numbers" },
  currency: { label: "Currency", description: "Money in LKR or USD" },
  email: { label: "Email", description: "A validated email address" },
  phone: { label: "Phone", description: "Phone or WhatsApp number" },
  url: { label: "URL", description: "A web link" },
  date: { label: "Date", description: "A calendar day" },
  datetime: { label: "Date & time", description: "A day and a time" },
  select: { label: "Dropdown", description: "Pick one option" },
  multiselect: { label: "Multi-select", description: "Pick several options" },
  checkbox: { label: "Checkbox", description: "Ticked or not (e.g. “Contacted”)" },
  boolean: { label: "Yes / No", description: "An explicit yes or no answer" },
  file: { label: "File link", description: "A link to a file (Drive, Dropbox…)" },
};

export type FieldOption = { id: string; label: string };

/** A field definition as the app sees it (dates/ids as strings). */
export type FieldDef = {
  /** Immutable storage key — record values live under data[id]. */
  id: string;
  /** Human key, unique per table (CSV headers, exports). Renaming is safe. */
  key: string;
  label: string;
  type: FieldType;
  placeholder: string;
  helpText: string;
  required: boolean;
  /** Default in *input* format (see registry). */
  defaultValue: FieldInput;
  options: FieldOption[];
  min: number | null;
  max: number | null;
  currency: Currency;
  order: number;
  showInTable: boolean;
  showInForm: boolean;
  archivedAt: string | null;
};

/** Value shape inside forms and CSV parsing. */
export type FieldInput = string | string[] | boolean;
/** Value shape in the database. Dates are Date server-side and ISO strings on the client. */
export type StoredValue = string | number | boolean | string[] | Date | null;

export type TableLevel = "none" | "view" | "edit" | "manage";
export const TABLE_LEVEL_OPTIONS: { value: Exclude<TableLevel, "manage">; label: string; description: string }[] = [
  { value: "none", label: "No access", description: "Hidden" },
  { value: "view", label: "View", description: "See and export records" },
  { value: "edit", label: "Edit", description: "Add, edit, delete and import records" },
];

export const TABLE_ICONS = ["table", "users", "plane", "phone", "megaphone", "calendar", "clipboard", "star", "map", "package", "camera", "briefcase"] as const;
export type TableIcon = (typeof TABLE_ICONS)[number];
