import { describe, expect, it } from "vitest";
import { personaInputSchema, personaPatchSchema } from "../src";

const validPersona = {
  nombreCompleto: "María López",
  rfc: "LOPM900101ABC",
  correoElectronico: "MARIA@EXAMPLE.COM",
  codigoPostal: "86000"
};

describe("personaInputSchema", () => {
  it("normaliza una persona física válida", () => {
    const result = personaInputSchema.parse(validPersona);
    expect(result.rfc).toBe("LOPM900101ABC");
    expect(result.correoElectronico).toBe("maria@example.com");
  });

  it("acepta un RFC de persona moral", () => {
    expect(
      personaInputSchema.safeParse({ ...validPersona, rfc: "ABC9001011A2" }).success
    ).toBe(true);
  });

  it("rechaza una fecha inexistente dentro del RFC", () => {
    expect(
      personaInputSchema.safeParse({ ...validPersona, rfc: "LOPM900231ABC" }).success
    ).toBe(false);
  });

  it("rechaza correo, código postal y campos desconocidos inválidos", () => {
    const result = personaInputSchema.safeParse({
      ...validPersona,
      correoElectronico: "correo-invalido",
      codigoPostal: "1234",
      extra: true
    });
    expect(result.success).toBe(false);
  });
});

describe("personaPatchSchema", () => {
  it("acepta una actualización parcial", () => {
    expect(personaPatchSchema.safeParse({ codigoPostal: "01234" }).success).toBe(true);
  });

  it("rechaza una actualización vacía", () => {
    expect(personaPatchSchema.safeParse({}).success).toBe(false);
  });
});
