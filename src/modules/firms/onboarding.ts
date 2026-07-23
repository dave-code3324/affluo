import { z } from "zod";

export const TARGET_PROFILES = [
  { label: "Dirigeants", value: "dirigeants" },
  { label: "Pharmaciens", value: "pharmaciens" },
  { label: "Professions libérales", value: "professions-liberales" },
  { label: "PME", value: "pme" },
  { label: "ETI", value: "eti" },
] as const;

export const DEPARTMENT_PATTERN = /^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/;

export function parseDepartments(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((department) => department.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export const onboardingSchema = z
  .object({
    firmName: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(120),
    department: z
      .string()
      .trim()
      .toUpperCase()
      .regex(DEPARTMENT_PATTERN, "Département invalide."),
    nationwide: z.boolean(),
    departments: z.array(z.string().regex(DEPARTMENT_PATTERN)).max(101),
    targetProfiles: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  })
  .superRefine((data, context) => {
    if (!data.nationwide && data.departments.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Ajoutez au moins un département de prospection.",
        path: ["departments"],
      });
    }
  });

export type OnboardingData = z.infer<typeof onboardingSchema>;
