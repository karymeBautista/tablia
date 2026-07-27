import { z } from "zod";

const RFC_PATTERN = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z0-9]{3})$/;

function isValidCalendarDate(value: string): boolean {
  const match = RFC_PATTERN.exec(value);
  if (!match) return false;

  const [, , yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const fullYear = year <= 30 ? 2000 + year : 1900 + year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));

  return (
    date.getUTCFullYear() === fullYear &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const personaInputSchema = z
  .object({
    nombreCompleto: z
      .string()
      .trim()
      .min(1, "El nombre completo es obligatorio")
      .max(150, "El nombre completo no puede superar 150 caracteres"),
    rfc: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => RFC_PATTERN.test(value), "El RFC debe tener un formato válido")
      .refine(isValidCalendarDate, "El RFC contiene una fecha inválida"),
    correoElectronico: z
      .email("El correo electrónico debe tener un formato válido")
      .trim()
      .max(254, "El correo electrónico no puede superar 254 caracteres")
      .transform((value) => value.toLowerCase()),
    codigoPostal: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "El código postal debe contener exactamente 5 dígitos")
  })
  .strict();

export const personaPatchSchema = personaInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Debes proporcionar al menos un campo para actualizar"
);

export const personaListQuerySchema = z.object({
  search: z.string().trim().max(150).optional().default(""),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10)
});

export type PersonaInput = z.infer<typeof personaInputSchema>;
export type PersonaPatch = z.infer<typeof personaPatchSchema>;
export type PersonaListQuery = z.infer<typeof personaListQuerySchema>;

export interface Persona extends PersonaInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
