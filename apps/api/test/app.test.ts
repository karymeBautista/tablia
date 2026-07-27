import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("API base", () => {
  it("devuelve JSON para rutas inexistentes", async () => {
    const response = await request(app).get("/ruta-inexistente");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "La ruta solicitada no existe"
      }
    });
  });

  it("rechaza un identificador inválido antes de consultar MySQL", async () => {
    const response = await request(app).get("/api/personas/no-es-id");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ID");
  });

  it("rechaza JSON mal formado", async () => {
    const response = await request(app)
      .post("/api/personas")
      .set("Content-Type", "application/json")
      .send('{"nombreCompleto":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
});
