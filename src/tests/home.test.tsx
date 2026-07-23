import { render, screen } from "@testing-library/react";

import Home from "@/app/page";

describe("Home", () => {
  it("presents the Affluo value proposition", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Affluo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Les meilleures opportunités patrimoniales, avant tout le monde.",
      ),
    ).toBeInTheDocument();
  });
});
