import "server-only";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Burns the same CPU time as a real check so unknown emails can't be detected by timing. */
let dummyHash: Promise<string> | null = null;
export async function fakeVerify(plain: string): Promise<false> {
  dummyHash ??= bcrypt.hash("nine-digits-dummy-password", ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
