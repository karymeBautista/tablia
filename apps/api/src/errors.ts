import type { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field: string; message: string }>
  ) {
    super(message);
  }
}

export function validationError(error: ZodError): AppError {
  return new AppError(
    422,
    "VALIDATION_ERROR",
    "Los datos enviados no son válidos",
    error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message
    }))
  );
}
