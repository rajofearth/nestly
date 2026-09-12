import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const avatarValidator = v.object({
  shape: v.string(),
  color: v.string(),
  expression: v.string(),
});

// Queries and mutations both expose the same db reader surface, so any ctx
// with a `db` works for the helpers below.
type DbCtx = { db: QueryCtx["db"] };

export async function requireUser(
  ctx: DbCtx,
  token: string,
): Promise<Doc<"users">> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!user) throw new Error("Invalid auth token");
  return user;
}

export async function requireCircleUser(
  ctx: DbCtx,
  token: string,
): Promise<{ user: Doc<"users">; circleId: Id<"circles"> }> {
  const user = await requireUser(ctx, token);
  if (!user.circleId) throw new Error("Not in a circle");
  return { user, circleId: user.circleId };
}

export async function getCircleMembers(
  ctx: DbCtx,
  circleId: Id<"circles">,
): Promise<Doc<"users">[]> {
  return await ctx.db
    .query("users")
    .withIndex("by_circle", (q) => q.eq("circleId", circleId))
    .collect();
}

// Strips secrets before sending a user doc to other members.
export function publicUser(user: Doc<"users">): Omit<Doc<"users">, "token" | "pushToken"> {
  const { token: _token, pushToken: _pushToken, ...rest } = user;
  return rest;
}

export function insertAlert(
  ctx: Pick<MutationCtx, "db">,
  args: {
    circleId: Id<"circles">;
    type: Doc<"alerts">["type"];
    fromUserId: Id<"users">;
    toUserId?: Id<"users">;
    payload?: unknown;
  },
): Promise<Id<"alerts">> {
  return ctx.db.insert("alerts", {
    circleId: args.circleId,
    type: args.type,
    fromUserId: args.fromUserId,
    ...(args.toUserId !== undefined ? { toUserId: args.toUserId } : {}),
    ...(args.payload !== undefined ? { payload: args.payload } : {}),
    ts: Date.now(),
    read: false,
  });
}

// 6-char uppercase code from an unambiguous alphabet (no 0/O, 1/I/L, 8/B).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Math.random is available in mutations (they execute exactly once) but is
// banned in queries — only call this from a mutation handler.
export function genCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// v1 note: node:crypto is not available in the deterministic mutation runtime,
// so tokens are built from multiple Math.random draws mixed with a timestamp
// (roughly 100+ bits of entropy). Acceptable for a family app; consider an
// internal action that returns a crypto.randomUUID() token if stronger
// guarantees are ever needed.
export function genToken(): string {
  let token = Date.now().toString(36) + ".";
  for (let i = 0; i < 4; i++) {
    token += Math.random().toString(36).slice(2).padEnd(11, "0") + ".";
  }
  return token;
}
