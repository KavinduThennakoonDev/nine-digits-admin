/**
 * Idempotent bootstrap: system roles, settings singleton, indexes and the first
 * Super Admin (only when the users collection is empty).
 *
 *   npm run seed
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DB_NAME } from "../src/server/db/db-name";
import { Role } from "../src/server/db/models/role";
import { User } from "../src/server/db/models/user";
import { Session } from "../src/server/db/models/session";
import { Settings } from "../src/server/db/models/settings";
import { ActivityLog } from "../src/server/db/models/activity-log";
import { Service } from "../src/server/db/models/service";
import { Client } from "../src/server/db/models/client";
import { ClientActivity } from "../src/server/db/models/client-activity";
import { Lead } from "../src/server/db/models/lead";
import { LeadActivity } from "../src/server/db/models/lead-activity";
import { SUPER_ADMIN_SLUG, SYSTEM_ROLES } from "../src/lib/permissions";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Create .env.local from .env.example.");
  await mongoose.connect(uri, { dbName: DB_NAME });
  console.log(`Connected to ${mongoose.connection.name}`);

  for (const model of [Role, User, Session, Settings, ActivityLog, Service, Client, ClientActivity, Lead, LeadActivity]) {
    await model.syncIndexes();
  }
  console.log("Indexes synced");

  for (const role of SYSTEM_ROLES) {
    // Super Admin always gets everything; other system roles keep any edits made in the app.
    await Role.updateOne(
      { slug: role.slug },
      role.slug === SUPER_ADMIN_SLUG
        ? { $set: { name: role.name, description: role.description, isSystem: true, permissions: role.permissions } }
        : { $setOnInsert: { name: role.name, description: role.description, isSystem: true, permissions: role.permissions } },
      { upsert: true },
    );
  }
  console.log(`System roles ready: ${SYSTEM_ROLES.map((r) => r.name).join(", ")}`);

  await Settings.updateOne({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true });

  // Starter catalogue (only when empty) — edit prices and descriptions in the app.
  if ((await Service.estimatedDocumentCount()) === 0) {
    const starter: [string, string, "monthly" | "one_off"][] = [
      ["Social Media Management", "Marketing", "monthly"],
      ["SEO", "Marketing", "monthly"],
      ["Website Development", "Development", "one_off"],
      ["Graphic Design", "Design", "one_off"],
      ["Video Production", "Production", "one_off"],
      ["Paid Advertising", "Marketing", "monthly"],
      ["Content Creation", "Marketing", "monthly"],
      ["Digital Strategy", "Consulting", "one_off"],
    ];
    await Service.insertMany(starter.map(([name, category, billing]) => ({ name, category, billing })));
    console.log(`Added ${starter.length} starter services`);
  }

  if ((await User.estimatedDocumentCount()) === 0) {
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    const name = process.env.SEED_ADMIN_NAME?.trim() || "Super Admin";
    if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first Super Admin.");
    if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");

    const superRole = await Role.findOne({ slug: SUPER_ADMIN_SLUG }).lean();
    // The seed password is temporary: the admin must choose their own at first sign-in.
    await User.create({ name, email, roleId: superRole!._id, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true });
    console.log(`Created Super Admin ${email}`);
  } else {
    console.log("Users already exist; skipped Super Admin creation");
  }

  await mongoose.disconnect();
  console.log("Seed complete ✔");
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
