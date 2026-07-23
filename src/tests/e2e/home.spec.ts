import { expect, test } from "@playwright/test";

test("shows the Affluo landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Affluo");
  await expect(
    page.getByRole("heading", { level: 1, name: "Affluo" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Les meilleures opportunités patrimoniales, avant tout le monde.",
    ),
  ).toBeVisible();
});
