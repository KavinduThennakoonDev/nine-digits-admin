import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().default(false),
  next: z.string().optional(),
});
export type LoginInput = z.input<typeof loginSchema>;

export const passwordRule = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[a-zA-Z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one.",
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z.string().trim().max(40).default(""),
  jobTitle: z.string().trim().max(80).default(""),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

/** Only allow same-origin relative redirects after login. */
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return "/dashboard";
  return next;
}
