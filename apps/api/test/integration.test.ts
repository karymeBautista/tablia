import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import {
  closePool,
  createDatabaseAndRunMigrations,
  getPool
} from "../src/database";

const run = process.env.RUN_DB_TESTS === "true";
const suite = run ? describe : describe.skip;

suite("CRUD personas con MySQL", () => {
  beforeAll(async () => {
    await createDatabaseAndRunMigrations();
    const pool = await getPool();
    await pool.query("DELETE FROM personas");
  });

  afterAll(async () => {
    await closePool();
  });

  it("ejecuta crear, listar, leer, actualizar y eliminar", async () => {
    const input = {
      nombreCompleto: "Karyme Bautista",
      rfc: "BAUK950515A12",
      correoElectronico: "karyme@example.com",
      codigoPostal: "86000"
    };

    const created = await request(app).post("/api/personas").send(input);
    expect(created.status).toBe(201);
    const id = created.body.data.id as number;

    const list = await request(app).get("/api/personas?search=Karyme&page=1&limit=10");
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);

    const found = await request(app).get(`/api/personas/${id}`);
    expect(found.body.data.rfc).toBe(input.rfc);

    const patched = await request(app)
      .patch(`/api/personas/${id}`)
      .send({ codigoPostal: "01234" });
    expect(patched.body.data.codigoPostal).toBe("01234");

    const replaced = await request(app)
      .put(`/api/personas/${id}`)
      .send({ ...input, correoElectronico: "nuevo@example.com" });
    expect(replaced.body.data.correoElectronico).toBe("nuevo@example.com");

    const duplicate = await request(app)
      .post("/api/personas")
      .send({ ...input, correoElectronico: "otro@example.com" });
    expect(duplicate.status).toBe(409);

    const deleted = await request(app).delete(`/api/personas/${id}`);
    expect(deleted.status).toBe(200);

    const missing = await request(app).get(`/api/personas/${id}`);
    expect(missing.status).toBe(404);
  });
});
