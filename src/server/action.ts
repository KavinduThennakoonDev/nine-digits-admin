import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AppError } from "./errors";

/**
 * Wraps Server Action bodies: converts AppError / Zod / Mongo errors into a
 * typed ActionResult and never leaks internals to the client.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    unstable_rethrow(err); // let redirect()/notFound() through
    if (err instanceof AppError) return fail(err.code, err.message, err.fieldErrors);
    if (err instanceof z.ZodError) {
      return fail("VALIDATION", "Please fix the highlighted fields.", z.flattenError(err).fieldErrors as Record<string, string[]>);
    }
    if (typeof err === "object" && err && "code" in err && (err as { code: unknown }).code === 11000) {
      const field = Object.keys((err as { keyValue?: object }).keyValue ?? {})[0];
      return fail("CONFLICT", field ? `That ${field} is already in use.` : "This record already exists.",
        field ? { [field]: [`This ${field} is already in use.`] } : undefined);
    }
    console.error("[action] unexpected error", err);
    return fail("INTERNAL", "Something went wrong. Please try again.");
  }
}

/** Parse untrusted input with a Zod schema (throws ZodError → VALIDATION result). */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  return schema.parse(input);
}
