import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const demoPassword = process.env.E2E_DEMO_USER_PASSWORD;

test.describe("internal CSV qualification workflow", () => {
  test.skip(
    !demoPassword,
    "E2E_DEMO_USER_PASSWORD is required for the seeded Supabase scenario.",
  );

  test("imports, resolves duplicates and approves an unassigned draft", async ({
    page,
  }) => {
    await login(page, "admin@demo.affluo.local", "/admin");
    await page.getByRole("link", { name: "Gérer les imports" }).click();

    await page
      .getByLabel("Choisir un fichier CSV")
      .setInputFiles(
        resolve(process.cwd(), "fixtures/imports/affluo-demo-import.csv"),
      );
    await expect(page.getByText("affluo-demo-import.csv")).toBeVisible();
    await page
      .getByRole("button", { name: "Créer la prévisualisation" })
      .click();

    await expect(
      page.getByRole("heading", { name: "affluo-demo-import.csv" }),
    ).toBeVisible();
    await expect(page.getByText(/doublons doivent être résolus/)).toBeVisible();
    await expect(page.getByText("source_url").first()).toBeVisible();

    const resolutions = page.getByLabel("Résolution du doublon");
    const resolutionCount = await resolutions.count();
    for (let index = 0; index < resolutionCount; index += 1) {
      await resolutions.nth(index).selectOption("CREATE_DISTINCT");
      await page
        .getByRole("button", { name: "Enregistrer la résolution" })
        .nth(index)
        .click();
      await expect(page.getByText("Résolution enregistrée.")).toBeVisible();
    }

    await page.getByRole("button", { name: "Lancer l’import" }).click();
    await expect(page.getByText("Import terminé.")).toBeVisible();
    await page
      .getByRole("link", { name: "Ouvrir la fiche créée" })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: "Claire Martin" }),
    ).toBeVisible();
    await page
      .getByLabel("Résumé de qualification")
      .fill("Profil prioritaire vérifié par l’équipe.");
    await page
      .getByRole("button", { name: "Enregistrer les corrections" })
      .click();
    await expect(page.getByText("Corrections enregistrées.")).toBeVisible();

    await page
      .getByRole("button", { name: "Vérifier LinkedIn manuellement" })
      .click();
    await expect(
      page.getByText("Profil LinkedIn vérifié manuellement."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Valider l’opportunité" }).click();
    await expect(
      page.getByText(
        "Opportunité validée. Elle reste en brouillon non publié.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Validée").first()).toBeVisible();

    const opportunityId = new URL(page.url()).pathname.split("/").at(-1);
    if (!opportunityId) {
      throw new Error("Identifiant d’opportunité absent de l’URL de revue.");
    }
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await login(
      page,
      "cgp.alpha@demo.affluo.local",
      `/dashboard/opportunities/${opportunityId}`,
    );
    await expect(page.locator("body")).toContainText("404");
  });

  test("returns 404 when a member opens the administration", async ({
    page,
  }) => {
    await login(page, "cgp.alpha@demo.affluo.local", "/admin");
    await expect(page.locator("body")).toContainText("404");
    await expect(page.getByText("Administration interne")).not.toBeVisible();
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
