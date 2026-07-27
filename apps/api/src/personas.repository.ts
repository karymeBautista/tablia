import type {
  Persona,
  PersonaInput,
  PersonaListQuery,
  PersonaPatch
} from "@tablia/shared";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "./database";
import { AppError } from "./errors";

interface PersonaRow extends RowDataPacket {
  id: number;
  nombre_completo: string;
  rfc: string;
  correo_electronico: string;
  codigo_postal: string;
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function toPersona(row: PersonaRow): Persona {
  return {
    id: Number(row.id),
    nombreCompleto: row.nombre_completo,
    rfc: row.rfc,
    correoElectronico: row.correo_electronico,
    codigoPostal: row.codigo_postal,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapDuplicateError(error: unknown): never {
  const mysqlError = error as { code?: string; message?: string };
  if (mysqlError.code !== "ER_DUP_ENTRY") throw error;

  const field = mysqlError.message?.includes("uq_personas_rfc")
    ? "RFC"
    : "correo electrónico";
  throw new AppError(409, "DUPLICATE_VALUE", `Ya existe una persona con ese ${field}`);
}

export async function createPersona(input: PersonaInput): Promise<Persona> {
  const pool = await getPool();
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO personas
        (nombre_completo, rfc, correo_electronico, codigo_postal)
       VALUES (?, ?, ?, ?)`,
      [input.nombreCompleto, input.rfc, input.correoElectronico, input.codigoPostal]
    );
    return (await findPersonaById(result.insertId)) as Persona;
  } catch (error) {
    return mapDuplicateError(error);
  }
}

export async function listPersonas(query: PersonaListQuery): Promise<{
  items: Persona[];
  total: number;
}> {
  const pool = await getPool();
  const search = `%${query.search}%`;
  const where = query.search
    ? "WHERE nombre_completo LIKE ? OR rfc LIKE ? OR correo_electronico LIKE ?"
    : "";
  const params = query.search ? [search, search, search] : [];
  const offset = (query.page - 1) * query.limit;

  const [rows] = await pool.query<PersonaRow[]>(
    `SELECT * FROM personas ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset]
  );
  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM personas ${where}`,
    params
  );

  return {
    items: rows.map(toPersona),
    total: Number(countRows[0]?.total ?? 0)
  };
}

export async function findPersonaById(id: number): Promise<Persona | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<PersonaRow[]>(
    "SELECT * FROM personas WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ? toPersona(rows[0]) : null;
}

export async function updatePersona(
  id: number,
  input: PersonaInput | PersonaPatch
): Promise<Persona> {
  const existing = await findPersonaById(id);
  if (!existing) {
    throw new AppError(404, "PERSONA_NOT_FOUND", "La persona solicitada no existe");
  }

  const next = {
    nombreCompleto: input.nombreCompleto ?? existing.nombreCompleto,
    rfc: input.rfc ?? existing.rfc,
    correoElectronico: input.correoElectronico ?? existing.correoElectronico,
    codigoPostal: input.codigoPostal ?? existing.codigoPostal
  };
  const pool = await getPool();

  try {
    await pool.execute(
      `UPDATE personas
       SET nombre_completo = ?, rfc = ?, correo_electronico = ?, codigo_postal = ?
       WHERE id = ?`,
      [
        next.nombreCompleto,
        next.rfc,
        next.correoElectronico,
        next.codigoPostal,
        id
      ]
    );
  } catch (error) {
    return mapDuplicateError(error);
  }

  return (await findPersonaById(id)) as Persona;
}

export async function deletePersona(id: number): Promise<void> {
  const pool = await getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM personas WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new AppError(404, "PERSONA_NOT_FOUND", "La persona solicitada no existe");
  }
}
