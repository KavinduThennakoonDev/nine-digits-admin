/**
 * Emergency access recovery: sets the password of the account in SEED_ADMIN_EMAIL to
 * SEED_ADMIN_PASSWORD, unlocks it, reactivates it and signs out its existing sessions.
 *
 *   npm run reset-admin
 *
 * Remove SEED_ADMIN_PASSWORD from .env.local afterwards — it's stored in plain text.
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DB_NAME } from "../src/server/db/db-name";
import { User } from "../src/server/db/models/user";
import { Session } from "../src/server/db/models/session";
import { ActivityLog } from "../src/server/db/models/activity-log";

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!uri || !email || !password) throw new Error("Set MONGODB_URI, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local.");
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");

  await mongoose.connect(uri, { dbName: DB_NAME });
  const user = await User.findOne({ email });
  if (!user) throw new Error(`No user with email ${email}. Run \`npm run seed\` first.`);

  user.passwordHash = await bcrypt.hash(password, 12);
  user.mustChangePassword = false;
  user.status = "active";
  user.sessionVersion += 1;
  user.set({ failedLoginCount: 0, lockedUntil: null });
  await user.save();
  await Session.deleteMany({ userId: user._id });
  await ActivityLog.create({ userId: user._id, action: "password_reset", module: "auth", recordId: user._id, summary: "Password reset from the command line" });

  console.log(`Password updated for ${email}. You can sign in now.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
