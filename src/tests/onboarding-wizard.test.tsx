import { fireEvent, render, screen } from "@testing-library/react";

import { OnboardingWizard } from "@/modules/firms/components/onboarding-wizard";

describe("OnboardingWizard", () => {
  it("guides a user through the three input screens", () => {
    render(<OnboardingWizard />);

    const firstContinue = screen.getByRole("button", { name: "Continuer" });
    expect(firstContinue).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nom du cabinet"), {
      target: { value: "Cabinet Horizon" },
    });
    fireEvent.change(screen.getByLabelText("Ville"), {
      target: { value: "Paris" },
    });
    fireEvent.change(screen.getByLabelText("Département"), {
      target: { value: "75" },
    });

    expect(firstContinue).toBeEnabled();
    fireEvent.click(firstContinue);

    expect(
      screen.getByRole("group", { name: "Zone de prospection" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /France entière/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    const submit = screen.getByRole("button", {
      name: "Valider mon ciblage",
    });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Dirigeants" }));
    expect(submit).toBeEnabled();
  });
});
