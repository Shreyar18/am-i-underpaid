import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index('by_email', ['email']),

  submissions: defineTable({
    employmentType: v.union(v.literal('full-time'), v.literal('freelance')),
    role: v.string(),
    city: v.string(),
    experience: v.number(),
    salaryOrRate: v.number(),
    email: v.optional(v.string()),
    companySize: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_employment_city_role', ['employmentType', 'city', 'role'])
    .index('by_created_at', ['createdAt']),
});
