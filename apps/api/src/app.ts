import {
  personaInputSchema,
  personaListQuerySchema,
  personaPatchSchema,
  type ApiError,
  type ApiSuccess,
  type Persona
} from "@tablia/shared";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { ZodError } from "zod";
import { getPool } from "./database";
import { AppError, validationError } from "./errors";
import {
  createPersona,
  deletePersona,
  findPersonaById,
  listPersonas,
  updatePersona
} from "./personas.repository";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.json({ limit: "100kb" }));

function parseId(request: Request): number {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, "INVALID_ID", "El identificador debe ser un entero positivo");
  }
  return id;
}

function asyncRoute(
  handler: (request: Request, response: Response) => Promise<void>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

app.get(
  "/api/health",
  asyncRoute(async (_request, response) => {
    const pool = await getPool();
    await pool.query("SELECT 1");
    response.json({
      success: true,
      data: { service: "tablia-api", database: "connected" }
    });
  })
);

app.post(
  "/api/personas",
  asyncRoute(async (request, response) => {
    const input = personaInputSchema.parse(request.body);
    const persona = await createPersona(input);
    const payload: ApiSuccess<Persona> = { success: true, data: persona };
    response.status(201).json(payload);
  })
);

app.get(
  "/api/personas",
  asyncRoute(async (request, response) => {
    const query = personaListQuerySchema.parse(request.query);
    const result = await listPersonas(query);
    const payload: ApiSuccess<Persona[]> = {
      success: true,
      data: result.items,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit)
      }
    };
    response.json(payload);
  })
);

app.get(
  "/api/personas/:id",
  asyncRoute(async (request, response) => {
    const persona = await findPersonaById(parseId(request));
    if (!persona) {
      throw new AppError(404, "PERSONA_NOT_FOUND", "La persona solicitada no existe");
    }
    response.json({ success: true, data: persona } satisfies ApiSuccess<Persona>);
  })
);

app.put(
  "/api/personas/:id",
  asyncRoute(async (request, response) => {
    const input = personaInputSchema.parse(request.body);
    const persona = await updatePersona(parseId(request), input);
    response.json({ success: true, data: persona } satisfies ApiSuccess<Persona>);
  })
);

app.patch(
  "/api/personas/:id",
  asyncRoute(async (request, response) => {
    const input = personaPatchSchema.parse(request.body);
    const persona = await updatePersona(parseId(request), input);
    response.json({ success: true, data: persona } satisfies ApiSuccess<Persona>);
  })
);

app.delete(
  "/api/personas/:id",
  asyncRoute(async (request, response) => {
    const id = parseId(request);
    await deletePersona(id);
    response.json({ success: true, data: { id } } satisfies ApiSuccess<{ id: number }>);
  })
);

app.use((_request, response) => {
  const payload: ApiError = {
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: "La ruta solicitada no existe" }
  };
  response.status(404).json(payload);
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  let appError: AppError;
  if (error instanceof ZodError) {
    appError = validationError(error);
  } else if (
    error instanceof SyntaxError &&
    "body" in error &&
    (error as { status?: number }).status === 400
  ) {
    appError = new AppError(400, "INVALID_JSON", "El cuerpo JSON no es válido");
  } else if (error instanceof AppError) {
    appError = error;
  } else {
    console.error("Unhandled API error", error);
    appError = new AppError(500, "INTERNAL_ERROR", "Ocurrió un error interno");
  }

  const payload: ApiError = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {})
    }
  };
  response.status(appError.status).json(payload);
};

app.use(errorHandler);
