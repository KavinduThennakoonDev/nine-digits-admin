"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { saveCategoryAction } from "../actions";
import type { CategoryRow } from "../queries";

export function CategoriesSheet({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (o: boolean) => void; categories: CategoryRow[] }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (input: { id?: string; name: string; isActive: boolean }, done?: () => void) =>
    startTransition(async () => {
      const r = await saveCategoryAction(input);
      if (!r.ok) return void toast.error(r.error.fieldErrors?.name?.[0] ?? r.error.message);
      done?.();
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Expense categories</SheetTitle>
          <SheetDescription>Inactive categories stay on past expenses but can&apos;t be picked for new ones.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save({ name: name.trim(), isActive: true }, () => { setName(""); toast.success("Category added."); });
          }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" aria-label="New category name" maxLength={60} />
            <Button type="submit" disabled={pending || !name.trim()}><Plus /> Add</Button>
          </form>
          <ul className="divide-y rounded-lg border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                {editing?.id === c.id ? (
                  <form className="flex flex-1 gap-1" onSubmit={(e) => {
                    e.preventDefault();
                    save({ id: c.id, name: editing.name, isActive: c.isActive }, () => setEditing(null));
                  }}>
                    <Input value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} className="h-7" autoFocus aria-label="Category name" />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save"><Check /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}><X /></Button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={c.isActive ? "truncate text-sm" : "truncate text-sm text-muted-foreground line-through"}>{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.count} expense{c.count === 1 ? "" : "s"}</p>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil /></Button>
                    <Switch checked={c.isActive} aria-label={`${c.name} active`} disabled={pending}
                      onCheckedChange={(v) => save({ id: c.id, name: c.name, isActive: v })} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
