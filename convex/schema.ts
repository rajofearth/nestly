import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    token: v.string(),
    name: v.string(),
    role: v.string(),
    roleLabel: v.optional(v.string()),
    circleId: v.optional(v.id("circles")),
    avatar: v.object({
      shape: v.string(),
      color: v.string(),
      expression: v.string(),
    }),
    pushToken: v.optional(v.string()),
    isOwner: v.boolean(),
    createdAt: v.number(),
    // Live presence fields, updated by presence:heartbeat.
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),
    battery: v.optional(v.number()),
    isCharging: v.optional(v.boolean()),
    isLowPower: v.optional(v.boolean()),
    deviceModel: v.optional(v.string()),
    lastSeen: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_circle", ["circleId"]),

  circles: defineTable({
    name: v.string(),
    code: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  places: defineTable({
    circleId: v.id("circles"),
    name: v.string(),
    emoji: v.string(),
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    notifyOnArrive: v.boolean(),
    notifyOnLeave: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_circle", ["circleId"]),

  placeEvents: defineTable({
    circleId: v.id("circles"),
    userId: v.id("users"),
    placeId: v.id("places"),
    type: v.union(v.literal("arrive"), v.literal("leave")),
    ts: v.number(),
  })
    .index("by_circle_ts", ["circleId", "ts"])
    .index("by_place", ["placeId"]),

  breadcrumbs: defineTable({
    circleId: v.id("circles"),
    userId: v.id("users"),
    lat: v.number(),
    lng: v.number(),
    speed: v.number(),
    ts: v.number(),
  }).index("by_user_ts", ["userId", "ts"]),

  checkinRequests: defineTable({
    circleId: v.id("circles"),
    requestedBy: v.id("users"),
    targetId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("ok")),
    ts: v.number(),
    respondedTs: v.optional(v.number()),
  })
    .index("by_target_status", ["targetId", "status"])
    .index("by_circle_status", ["circleId", "status"]),

  messages: defineTable({
    circleId: v.id("circles"),
    userId: v.id("users"),
    text: v.string(),
    ts: v.number(),
  }).index("by_circle_ts", ["circleId", "ts"]),

  alerts: defineTable({
    circleId: v.id("circles"),
    type: v.union(
      v.literal("sos"),
      v.literal("memberJoined"),
      v.literal("arrive"),
      v.literal("leave"),
      v.literal("batteryLow"),
      v.literal("checkin"),
    ),
    fromUserId: v.id("users"),
    toUserId: v.optional(v.id("users")),
    payload: v.optional(v.any()),
    ts: v.number(),
    read: v.boolean(),
  })
    .index("by_circle_ts", ["circleId", "ts"])
    .index("by_target", ["toUserId"]),
});
