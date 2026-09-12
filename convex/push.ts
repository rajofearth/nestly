import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

// Loads push tokens for the target users (actions cannot use ctx.db directly,
// so this runs as an internal query).
export const getPushTargets = internalQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    return users
      .filter((u): u is NonNullable<(typeof users)[number]> =>
        Boolean(u && u.pushToken !== undefined),
      )
      .map((u) => ({ userId: u._id, pushToken: u.pushToken as string }));
  },
});

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  sound?: "default";
  data?: Record<string, unknown>;
};

export const sendPush = internalAction({
  args: {
    userIds: v.array(v.id("users")),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { userIds, title, body, data }) => {
    const targets = await ctx.runQuery(internal.push.getPushTargets, {
      userIds,
    });
    const tokens = targets.map((t) => t.pushToken);
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100);
      const messages: ExpoPushMessage[] = chunk.map((to) => ({
        to,
        title,
        body,
        sound: "default",
        ...(data !== undefined ? { data } : {}),
      }));
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(
            `Expo push API returned ${res.status}: ${text} (${chunk.length} messages)`,
          );
        }
      } catch (err) {
        console.error("Expo push request failed", err);
      }
    }
  },
});

// Fire-and-forget push: schedules the sendPush action without blocking the
// calling mutation. Call from mutation handlers only.
export async function queuePush(
  ctx: Pick<MutationCtx, "scheduler">,
  userIds: Id<"users">[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (userIds.length === 0) return;
  await ctx.scheduler.runAfter(0, internal.push.sendPush, {
    userIds,
    title,
    body,
    data,
  });
}
