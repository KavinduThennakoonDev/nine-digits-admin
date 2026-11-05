"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/forms/combobox";
import { cn } from "@/lib/utils";
import type { FieldDef, FieldInput } from "@/lib/dynamic/types";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocal = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Renders the right control for any field type, from its metadata alone. */
export function DynamicInput({
  field, id, value, onChange, onBlur, invalid,
}: {
  field: Pick<FieldDef, "type" | "placeholder" | "options" | "currency" | "label">;
  id: string;
  value: FieldInput;
  onChange: (v: FieldInput) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const str = typeof value === "string" ? value : "";
  const common = { id, onBlur, "aria-invalid": invalid, placeholder: field.placeholder || undefined };
  switch (field.type) {
    case "textarea":
      return <Textarea {...common} value={str} onChange={(e) => onChange(e.target.value)} className="min-h-20" />;
    case "number":
      return <Input {...common} inputMode="decimal" className="tabular" value={str} onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ""))} />;
    case "currency":
      return (
        <InputGroup>
          <InputGroupInput {...common} inputMode="decimal" className="tabular" value={str} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} placeholder={field.placeholder || "0.00"} />
          <InputGroupAddon align="inline-end" className="text-xs">{field.currency}</InputGroupAddon>
        </InputGroup>
      );
    case "email":
      return <Input {...common} type="email" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input {...common} type="tel" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "+94 77 123 4567"} />;
    case "url":
    case "file":
      return <Input {...common} type="url" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "https://"} />;
    case "date":
      return <Input {...common} type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <Input {...common} type="datetime-local" value={toLocal(str)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")} />;
    case "select":
      return (
        <Combobox id={id} value={str} onChange={(v) => onChange(v)} invalid={invalid} placeholder={field.placeholder || "Select…"}
          options={field.options.map((o) => ({ value: o.id, label: o.label }))} />
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div id={id} role="group" aria-label={field.label}
          className={cn("flex flex-wrap gap-1.5 rounded-lg border p-2", invalid && "border-destructive")}>
          {field.options.map((o) => {
            const on = arr.includes(o.id);
            return (
              <button key={o.id} type="button" aria-pressed={on}
                onClick={() => onChange(on ? arr.filter((x) => x !== o.id) : [...arr, o.id])}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "checkbox":
      return (
        <label htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Checkbox id={id} checked={value === true} onCheckedChange={(v) => onChange(v === true)} aria-invalid={invalid} />
          {field.label}
        </label>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2 text-sm">
          <Switch id={id} checked={value === true} onCheckedChange={(v) => onChange(v)} />
          <span className="text-muted-foreground">{value === true ? "Yes" : "No"}</span>
        </div>
      );
    default:
      return <Input {...common} value={str} onChange={(e) => onChange(e.target.value)} />;
  }
}
