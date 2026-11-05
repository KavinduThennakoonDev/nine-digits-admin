"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/layout/user-avatar";
import { RelativeTime } from "@/components/feedback/relative-time";
import { addCommentAction, deleteCommentAction } from "../actions";
import type { TaskComment } from "../queries";

export function TaskComments({ taskId, comments, canDeleteAny }: { taskId: string; comments: TaskComment[]; canDeleteAny: boolean }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = () => startTransition(async () => {
    const r = await addCommentAction({ taskId, body });
    if (!r.ok) return void toast.error(r.error.fieldErrors?.body?.[0] ?? r.error.message);
    setBody("");
  });
  return (
    <div className="space-y-4">
      {comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <UserAvatar name={c.userName} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-medium">{c.userName}</span> <span className="text-xs text-muted-foreground"><RelativeTime value={c.createdAt} mode="ago" /></span></p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
              {c.mine || canDeleteAny ? (
                <Button variant="ghost" size="icon-sm" aria-label="Delete comment" disabled={pending}
                  onClick={() => startTransition(async () => { const r = await deleteCommentAction(c.id); if (!r.ok) toast.error(r.error.message); })}><Trash2 /></Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) submit(); }}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" aria-label="Comment" className="min-h-20"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) { e.preventDefault(); submit(); } }} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ctrl/⌘ + Enter to send</span>
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>{pending ? <Spinner /> : null} Comment</Button>
        </div>
      </form>
    </div>
  );
}
