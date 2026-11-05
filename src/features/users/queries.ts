import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { User, type UserDoc } from "@/server/db/models/user";
import { Role } from "@/server/db/models/role";
import { authorize } from "@/server/auth/dal";
import { escapeRegex, parseListParams, first, type Paginated, type SearchParams } from "@/lib/list-params";
import { USER_STATUSES, type NotificationType, type UserStatus } from "@/lib/constants";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  phone: string;
  status: UserStatus;
  roleId: string;
  roleName: string;
  roleSlug: string;
  lastLoginAt: string | null;
  createdAt: string;
  grant: string[];
  deny: string[];
};

export const USER_SORTABLE = ["name", "email", "status", "lastLoginAt", "createdAt"] as const;

export async function listUsers(sp: SearchParams): Promise<Paginated<UserRow>> {
  await authorize("users.view");
  await connectDB();
  const params = parseListParams(sp, USER_SORTABLE, "createdAt");

  const filter: QueryFilter<UserDoc> = {};
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { jobTitle: rx }];
  }
  const status = first(sp.status);
  if (status && (USER_STATUSES as readonly string[]).includes(status)) filter.status = status as UserStatus;
  const role = first(sp.role);
  if (role && Types.ObjectId.isValid(role)) filter.roleId = new Types.ObjectId(role);

  const [docs, total, roles] = await Promise.all([
    User.find(filter)
      .sort({ [params.sort]: params.dir === "asc" ? 1 : -1, _id: 1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean(),
    User.countDocuments(filter),
    Role.find({}, { name: 1, slug: 1 }).lean(),
  ]);
  const roleMap = new Map(roles.map((r) => [String(r._id), r]));

  return {
    rows: docs.map((u) => {
      const r = roleMap.get(String(u.roleId));
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        jobTitle: u.jobTitle ?? "",
        phone: u.phone ?? "",
        status: u.status as UserStatus,
        roleId: String(u.roleId),
        roleName: r?.name ?? "—",
        roleSlug: r?.slug ?? "",
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        createdAt: (u as unknown as { createdAt: Date }).createdAt.toISOString(),
        grant: u.permissionOverrides?.grant ?? [],
        deny: u.permissionOverrides?.deny ?? [],
      };
    }),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getProfile(userId: string) {
  await connectDB();
  const u = await User.findById(userId).lean();
  if (!u) return null;
  return { name: u.name, email: u.email, phone: u.phone ?? "", jobTitle: u.jobTitle ?? "", mutedNotifications: (u.mutedNotifications ?? []) as NotificationType[] };
}
