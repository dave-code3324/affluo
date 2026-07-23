import { safeRedirectPath } from "@/lib/security/redirects";

describe("safeRedirectPath", () => {
  it("keeps an internal application path", () => {
    expect(safeRedirectPath("/dashboard/history")).toBe("/dashboard/history");
  });

  it.each([
    "https://malicious.example",
    "//malicious.example",
    "/\\malicious.example",
    "",
  ])("rejects unsafe redirect %s", (candidate) => {
    expect(safeRedirectPath(candidate)).toBe("/dashboard");
  });
});
