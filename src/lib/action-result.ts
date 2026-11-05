export type ActionError = {
  code: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (
  code: ActionError["code"],
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> => ({ ok: false, error: { code, message, fieldErrors } });
