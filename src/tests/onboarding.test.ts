import { onboardingSchema, parseDepartments } from "@/modules/firms/onboarding";

describe("onboarding validation", () => {
  it("normalizes and deduplicates department codes", () => {
    expect(parseDepartments("75, 92, 75, 2a")).toEqual(["75", "92", "2A"]);
  });

  it("accepts a focused regional targeting", () => {
    const result = onboardingSchema.safeParse({
      firmName: "Cabinet Horizon",
      city: "Paris",
      department: "75",
      nationwide: false,
      departments: ["75", "92"],
      targetProfiles: ["dirigeants"],
    });

    expect(result.success).toBe(true);
  });

  it("requires departments when nationwide targeting is disabled", () => {
    const result = onboardingSchema.safeParse({
      firmName: "Cabinet Horizon",
      city: "Paris",
      department: "75",
      nationwide: false,
      departments: [],
      targetProfiles: ["dirigeants"],
    });

    expect(result.success).toBe(false);
  });
});
