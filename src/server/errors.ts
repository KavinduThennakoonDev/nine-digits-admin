import type { ActionError } from "@/lib/action-result";

/** Throw from services / DAL; converted into an ActionResult by runAction(). */
export class AppError extends Error {
  constructor(
    public code: ActionError["code"],
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
