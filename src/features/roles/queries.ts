import "server-only";
import { connectDB } from "@/server/db/connect";
import { Role } from "@/server/db/models/role";
import { User } from "@/server/db/models/user";
import { authorize } from "@/server/auth/dal";
import { ALL_PERMISSIONS, SUPER_ADMIN_SLUG, type Permission } from "@/lib/permissions";

export type RoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  isSuperAdmin: boolean;
  permissions: Permission[];
  userCount: number;
};

export async function listRoles(): Promise<RoleRow[]> {
  await authorize("users.view");
  await connectDB();
  const [roles, counts] = await Promise.all([
    Role.find().sort({ isSystem: -1, createdAt: 1 }).lean(),
    User.aggregate<{ _id: unknown; count: number }>([{ $group: { _id: "$roleId", count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return roles.map((r) => ({
    id: String(r._id),
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    isSystem: Boolean(r.isSystem),
    isSuperAdmin: r.slug === SUPER_ADMIN_SLUG,
    permissions: r.slug === SUPER_ADMIN_SLUG ? ALL_PERMISSIONS : (r.permissions as Permission[]),
    userCount: countMap.get(String(r._id)) ?? 0,
  }));
}
