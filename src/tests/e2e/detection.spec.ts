import { expect, test } from "@playwright/test";

const demoPassword = process.env.E2E_DEMO_USER_PASSWORD;

test.describe("Patrimoine Radar detection", () => {
  test.skip(
    !demoPassword,
    "E2E_DEMO_USER_PASSWORD is required for the seeded Supabase scenario.",
  );

  test("creates a sourced draft for human review without CGP publication", async ({
    page,
  }) => {
    await login(page, "admin@demo.affluo.local", "/admin/detection");
    await expect(
      page.getByRole("heading", { name: "Détection automatique" }),
    ).toBeVisible();

    const demoCard = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: "BODACC — source simulée",
      }),
    });
    await demoCard.getByRole("button", { name: "Lancer maintenant" }).click();
    await expect(page.getByText("DEMO-BODACC-AFFLUO-001")).toBeVisible();
    await expect(page.getByText("BODACC_DEMO").first()).toBeVisible();

    await page.getByRole("link", { name: "Ouvrir l’opportunité" }).click();
    await expect(page.getByText("Détection automatique")).toBeVisible();
    await expect(page.getByText("Fait sourcé")).toBeVisible();
    await expect(page.getByText("Hypothèses patrimoniales")).toBeVisible();
    await expect(page.getByText("Statut LinkedIn : UNVERIFIED")).toBeVisible();

    const opportunityId = new URL(page.url()).pathname.split("/").at(-1);
    if (!opportunityId) {
      throw new Error("Identifiant d’opportunité absent.");
    }
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await login(
      page,
      "cgp.alpha@demo.affluo.local",
      `/dashboard/opportunities/${opportunityId}`,
    );
    await expect(page.locator("body")).toContainText("404");
  });
});

async function login(
  page: import("@playwright/test").Page,
  email: string,
  next: string,
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe").fill(demoPassword ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
}
