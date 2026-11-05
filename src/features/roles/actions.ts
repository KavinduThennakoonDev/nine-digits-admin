"use server";

import { refresh } from "next/cache";
import { connectDB } from "@/server/db/connect";
import { Role } from "@/server/db/models/role";
import { User } from "@/server/db/models/user";
import { authorize } from "@/server/auth/dal";
import { audit, diff } from "@/server/services/audit";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { isPermission, SUPER_ADMIN_SLUG } from "@/lib/permissions";
import type { ActionResult } from "@/lib/action-result";
import { roleSchema, type RoleInput } from "./schemas";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "role";

export async function saveRoleAction(input: RoleInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("roles.manage");
    const data = parse(roleSchema, input);
    await connectDB();
    const permissions = [...new Set(data.permissions.filter(isPermission))];

    if (!data.id) {
      const slug = slugify(data.name);
      if (await Role.exists({ slug })) throw new AppError("CONFLICT", "A role with this name already exists.", { name: ["A role with this name already exists."] });
      const role = await Role.create({ name: data.name, slug, description: data.description, permissions, createdBy: actor.id, updatedBy: actor.id });
      await audit({ userId: actor.id, action: "create", module: "roles", recordId: String(role._id), summary: `Created role ${data.name}`, after: { name: data.name, permissions } });
      refresh();
      return { id: String(role._id) };
    }

    const role = await Role.findById(data.id);
    if (!role) throw new AppError("NOT_FOUND", "Role not found.");
    if (role.slug === SUPER_ADMIN_SLUG) throw new AppError("FORBIDDEN", "The Super Admin role can't be edited.");
    if (role.slug === actor.roleSlug && !actor.isSuperAdmin) {
      throw new AppError("FORBIDDEN", "You can't edit the role you're assigned to.");
    }

    const before = { name: role.name, description: role.description, permissions: [...role.permissions] };
    role.set({ name: role.isSystem ? role.name : data.name, description: data.description, permissions, updatedBy: actor.id });
    await role.save();
    const d = diff(before, { name: role.name, description: role.description, permissions });
    if (d.changed) await audit({ userId: actor.id, action: "update", module: "roles", recordId: data.id, summary: `Updated role ${role.name}`, before: d.before, after: d.after });
    refresh();
    return { id: data.id };
  });
}

export async function deleteRoleAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("roles.manage");
    await connectDB();
    const role = await Role.findById(id);
    if (!role) throw new AppError("NOT_FOUND", "Role not found.");
    if (role.isSystem) throw new AppError("FORBIDDEN", "System roles can't be deleted.");
    const assigned = await User.countDocuments({ roleId: role._id });
    if (assigned > 0) throw new AppError("CONFLICT", `${assigned} user(s) still have this role. Reassign them first.`);
    await role.deleteOne();
    await audit({ userId: actor.id, action: "delete", module: "roles", recordId: id, summary: `Deleted role ${role.name}`, before: { name: role.name, permissions: role.permissions } });
    refresh();
    return null;
  });
}
