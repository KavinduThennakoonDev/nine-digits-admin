import { z } from "zod";

export const roleSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  name: z.string().trim().min(2, "Enter a role name.").max(60),
  description: z.string().trim().max(240).default(""),
  permissions: z.array(z.string()).default([]),
});
export type RoleInput = z.input<typeof roleSchema>;
