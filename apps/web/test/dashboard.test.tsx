import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonasDashboard } from "../src/components/personas-dashboard";

describe("PersonasDashboard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("muestra los registros devueltos por la API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              nombreCompleto: "Karyme Bautista",
              rfc: "BAUK950515A12",
              correoElectronico: "karyme@example.com",
              codigoPostal: "86000",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z"
            }
          ],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<PersonasDashboard />);
    expect(screen.getByRole("heading", { name: "Personas" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Karyme Bautista")).toBeInTheDocument()
    );
    expect(screen.getByText("BAUK950515A12")).toBeInTheDocument();
  });
});
