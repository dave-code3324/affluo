import {
  ContactDetailType,
  FeedbackDecision,
  VerificationStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createDecisionSections,
  feedbackInputSchema,
  formatDecisionDate,
  getVerificationPresentation,
  safeExternalUrl,
  selectPrimaryContact,
} from "@/modules/opportunities/domain";

describe("prospect decision domain", () => {
  it.each([
    [
      ContactDetailType.PROFESSIONAL_EMAIL,
      VerificationStatus.VERIFIED,
      "Email professionnel vérifié",
    ],
    [
      ContactDetailType.PROFESSIONAL_EMAIL,
      VerificationStatus.LIKELY,
      "Email professionnel probable — à confirmer",
    ],
    [
      ContactDetailType.LINKEDIN,
      VerificationStatus.UNVERIFIED,
      "Profil LinkedIn non vérifié",
    ],
  ])("builds an explicit verification label", (type, status, label) => {
    expect(getVerificationPresentation(type, status).label).toBe(label);
  });

  it("keeps verified facts and hypotheses in distinct sections", () => {
    const sections = createDecisionSections(
      ["Cession publiée le 14 juillet."],
      ["Diversification du patrimoine"],
    );

    expect(sections.facts.label).toBe("Faits vérifiés");
    expect(sections.facts.items).not.toContain("Diversification du patrimoine");
    expect(sections.hypotheses.label).toContain("Hypothèses");
    expect(sections.hypotheses.disclaimer).toContain("non des informations");
  });

  it("allows only HTTP and HTTPS external links", () => {
    expect(safeExternalUrl("https://example.com/source")).toBe(
      "https://example.com/source",
    );
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("ftp://example.com/source")).toBeNull();
  });

  it("validates decisions and optional reasons", () => {
    expect(
      feedbackInputSchema.safeParse({
        opportunityId: "41000000-0000-4000-8000-000000000041",
        decision: FeedbackDecision.TO_CONTACT,
        reason: "",
      }).success,
    ).toBe(true);
    expect(
      feedbackInputSchema.safeParse({
        opportunityId: "41000000-0000-4000-8000-000000000041",
        decision: "CONTACT_LATER",
        reason: "",
      }).success,
    ).toBe(false);
    expect(
      feedbackInputSchema.safeParse({
        opportunityId: "41000000-0000-4000-8000-000000000041",
        decision: FeedbackDecision.TO_CONTACT,
        reason: "WRONG_PROFILE",
      }).success,
    ).toBe(false);
  });

  it("formats dates in French and UTC", () => {
    expect(formatDecisionDate(new Date("2026-09-08T23:00:00.000Z"))).toBe(
      "8 septembre 2026",
    );
  });

  it("selects the declared primary usable contact and excludes invalid data", () => {
    const contacts = [
      {
        isPrimary: true,
        type: ContactDetailType.PROFESSIONAL_EMAIL,
        value: "invalid-address",
        verificationStatus: VerificationStatus.VERIFIED,
      },
      {
        isPrimary: false,
        type: ContactDetailType.PROFESSIONAL_EMAIL,
        value: "verified@example.com",
        verificationStatus: VerificationStatus.VERIFIED,
      },
      {
        isPrimary: true,
        type: ContactDetailType.PROFESSIONAL_EMAIL,
        value: "primary@example.com",
        verificationStatus: VerificationStatus.LIKELY,
      },
    ];

    expect(
      selectPrimaryContact(contacts, ContactDetailType.PROFESSIONAL_EMAIL)
        ?.value,
    ).toBe("primary@example.com");
  });
});
