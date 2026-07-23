import {
  ContactDetailType,
  ContactabilityStatus,
  OpportunityStatus,
  VerificationStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  canPublishOpportunity,
  contactabilityStatusSchema,
  formatWeeklyPeriod,
  getContactabilityPresentation,
  opportunityStatusSchema,
  weeklyBatchStatusSchema,
} from "@/modules/opportunities/domain";

describe("opportunity domain", () => {
  it("formats a weekly period in one month", () => {
    expect(
      formatWeeklyPeriod(
        new Date("2026-07-20T00:00:00.000Z"),
        new Date("2026-07-26T00:00:00.000Z"),
      ),
    ).toBe("Du 20 au 26 juillet 2026");
  });

  it("formats a weekly period across two months", () => {
    expect(
      formatWeeklyPeriod(
        new Date("2026-07-27T00:00:00.000Z"),
        new Date("2026-08-02T00:00:00.000Z"),
      ),
    ).toBe("Du 27 juillet au 2 août 2026");
  });

  it.each([
    [ContactabilityStatus.CONTACTABLE, "Contact professionnel vérifié"],
    [ContactabilityStatus.PARTIALLY_VERIFIED, "Contact à vérifier"],
    [ContactabilityStatus.NOT_CONTACTABLE, "Non contactable"],
  ])("maps %s to a clear label", (status, label) => {
    expect(getContactabilityPresentation(status).label).toBe(label);
  });

  it("validates only known statuses", () => {
    expect(opportunityStatusSchema.parse("PUBLISHED")).toBe(
      OpportunityStatus.PUBLISHED,
    );
    expect(weeklyBatchStatusSchema.safeParse("ARCHIVED").success).toBe(true);
    expect(
      contactabilityStatusSchema.safeParse("PARTIALLY_VERIFIED").success,
    ).toBe(true);
    expect(opportunityStatusSchema.safeParse("READY").success).toBe(false);
    expect(weeklyBatchStatusSchema.safeParse("READY").success).toBe(false);
    expect(contactabilityStatusSchema.safeParse("READY").success).toBe(false);
  });

  it("prevents publishing a non-contactable prospect", () => {
    expect(
      canPublishOpportunity({
        contactabilityStatus: ContactabilityStatus.NOT_CONTACTABLE,
        emailVerificationStatus: VerificationStatus.VERIFIED,
        linkedinUrl: "https://www.linkedin.com/in/demo",
        professionalEmail: "demo@example.com",
      }),
    ).toBe(false);
  });

  it("requires a usable channel for a verified contact", () => {
    expect(
      canPublishOpportunity({
        contactabilityStatus: ContactabilityStatus.CONTACTABLE,
        emailVerificationStatus: VerificationStatus.UNVERIFIED,
        linkedinUrl: null,
        professionalEmail: "demo@example.com",
      }),
    ).toBe(false);

    expect(
      canPublishOpportunity({
        contactabilityStatus: ContactabilityStatus.CONTACTABLE,
        emailVerificationStatus: VerificationStatus.VERIFIED,
        linkedinUrl: null,
        professionalEmail: "demo@example.com",
      }),
    ).toBe(true);
  });

  it("accepts a verified normalized contact channel for publication", () => {
    expect(
      canPublishOpportunity({
        contactDetails: [
          {
            type: ContactDetailType.LINKEDIN,
            value: "https://www.linkedin.com/in/demo-profile",
            verificationStatus: VerificationStatus.VERIFIED,
          },
        ],
        contactabilityStatus: ContactabilityStatus.CONTACTABLE,
        emailVerificationStatus: VerificationStatus.UNVERIFIED,
        linkedinUrl: null,
        professionalEmail: null,
      }),
    ).toBe(true);
  });
});
