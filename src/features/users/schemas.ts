import { z } from "zod";
import { passwordRule } from "@/features/auth/schemas";
import { USER_STATUSES } from "@/lib/constants";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");

const userBase = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(120),
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  roleId: objectId.or(z.literal("")).refine((v) => v !== "", "Select a role."),
  jobTitle: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).default(""),
});

export const createUserSchema = userBase.extend({
  password: passwordRule,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = userBase.extend({
  id: objectId,
  status: z.enum(USER_STATUSES),
  grant: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const resetPasswordSchema = z
  .object({ id: objectId, password: passwordRule, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
