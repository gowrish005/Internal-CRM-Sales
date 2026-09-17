import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/lead-status";

export const createContactSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  designation: z.string().optional(),
  company: z.string().optional(),
  linkedin: z.string().optional(),
  location: z.string().optional(),
  branchId: z.string().optional(),
  ownerId: z.string().optional(),
  leadStatus: z.enum(["NEW","CONTACTED","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"]).default("NEW"),
  leadSource: z.enum(["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"]).optional(),
  priority: z.enum(["LOW","MEDIUM","HIGH"]).default("MEDIUM"),
  tags: z.array(z.string()).default([]),
  nextFollowUpAt: z.string().optional(),
});

export const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name required"),
  code: z.string().min(1, "Branch code required"),
  location: z.string().optional(),
  address: z.string().optional(),
  managerId: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const createLeadSchema = z.object({
  name: z.string().min(1, "Lead name required"),
  branchId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  college: z.string().optional(),
  branch: z.string().optional(),
  usn: z.string().optional(),
  passoutYear: z.coerce.number().int().optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
  source: z.enum(["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"]).optional(),
  status: z.enum(LEAD_STATUSES).default("NEW"),
  priority: z.enum(["LOW","MEDIUM","HIGH"]).default("MEDIUM"),
  track: z.coerce.number().int().min(1).max(3).optional(),
  estimatedValue: z.coerce.number().optional(),
  expectedCloseAt: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  college: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  usn: z.string().optional().nullable(),
  passoutYear: z.coerce.number().int().optional().nullable(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().optional().nullable(),
  source: z.enum(["REFERRAL","WEBSITE","COLD_OUTREACH","EVENT","SOCIAL_MEDIA","OTHER"]).optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(["LOW","MEDIUM","HIGH"]).optional(),
  track: z.coerce.number().int().min(1).max(3).optional().nullable(),
  estimatedValue: z.coerce.number().optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  branchId: z.string().optional(),
  priority: z.enum(["LOW","MEDIUM","HIGH"]).default("MEDIUM"),
  status: z.enum(["TODO","IN_PROGRESS","COMPLETED"]).default("TODO"),
  dueAt: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  meetingId: z.string().optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  type: z.enum(["MEETING","CALL","EVENT","FOLLOW_UP"]).default("MEETING"),
  startAt: z.string().min(1, "Start time required"),
  endAt: z.string().min(1, "End time required"),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  organizerId: z.string().optional(),
  participantIds: z.array(z.string()).default([]),
  branchId: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
  reminderAt: z.string().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1, "Note content required"),
  contactId: z.string().optional(),
  branchId: z.string().optional(),
  leadId: z.string().optional(),
  meetingId: z.string().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
