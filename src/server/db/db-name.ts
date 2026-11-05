/**
 * The database is pinned here so a connection string without a path
 * (".../mongodb.net/") doesn't silently fall back to MongoDB's empty "test" database.
 */
export const DB_NAME = process.env.MONGODB_DB?.trim() || "nine-digits";
