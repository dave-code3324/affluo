import { expect, test } from "@playwright/test";

test("navigates through the public authentication entry points", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Créer mon espace" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Créer votre espace" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email professionnel")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();

  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Se connecter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mot de passe oublié ?" }),
  ).toBeVisible();
});
