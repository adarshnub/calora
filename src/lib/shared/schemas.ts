import { z } from "zod";
export const zoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA time zone");
export const preferencesSchema = z
  .object({
    timeZone: zoneSchema,
    clock: z.enum(["12", "24"]),
    weekStart: z.union([z.literal(0), z.literal(1)]),
    appearance: z.enum(["light", "dark", "system"]),
    groupDuplicates: z.boolean(),
    showWeekends: z.boolean(),
    workingStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    workingEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    allDayBusy: z.boolean(),
  })
  .partial();
export const rangeSchema = z
  .object({
    start: z.iso.date(),
    end: z.iso.date(),
    timeZone: zoneSchema.default("Asia/Kolkata"),
    sources: z.array(z.string().min(1).max(100)).max(100).optional(),
  })
  .refine((v) => {
    const days = (Date.parse(v.end) - Date.parse(v.start)) / 86400000;
    return days > 0 && days <= 62;
  }, "Range must be between 1 and 62 days");
