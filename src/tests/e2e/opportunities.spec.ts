import { expect, test } from "@playwright/test";

const demoPassword = process.env.E2E_DEMO_USER_PASSWORD;

test.describe("weekly opportunity demo", () => {
  test.skip(
    !demoPassword,
    "E2E_DEMO_USER_PASSWORD is required for the seeded Supabase scenario.",
  );

  test("decides from a sourced sheet and protects another firm's detail", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByLabel("Email professionnel")
      .fill("cgp.alpha@demo.affluo.local");
    await page.getByLabel("Mot de passe").fill(demoPassword ?? "");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Opportunités" }),
    ).toBeVisible();
    await expect(page.getByText("Cabinet Aster")).toBeVisible();
    await page.getByRole("link", { name: "Voir le prospect" }).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Claire Martin" }),
    ).toBeVisible();
    await expect(page.getByText("Cession partielle annoncée")).toBeVisible();
    await expect(
      page.getByText("Journal économique de démonstration"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Copier l’email" }).click();
    await expect(page.getByText("Email copié")).toBeVisible();

    await page.getByRole("button", { name: /À contacter/ }).click();
    await expect(
      page.getByText("Votre décision est enregistrée."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /À contacter/ }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto(
      "/dashboard/opportunities/46000000-0000-4000-8000-000000000046",
    );
    await expect(page.getByText("Thomas Dubois")).not.toBeVisible();
    await expect(page.locator("body")).toContainText("404");
  });
});
