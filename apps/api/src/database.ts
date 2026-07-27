import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
import { PERSONAS_TABLE_SQL } from "./schema";

let poolPromise: Promise<Pool> | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

async function resolvePoolOptions(includeDatabase = true): Promise<PoolOptions> {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? "";

  if (!host || !user) {
    throw new Error("La configuración de conexión MySQL está incompleta");
  }

  return {
    host,
    port,
    user,
    password,
    database: includeDatabase ? required("DB_NAME") : undefined,
    connectionLimit: Number(process.env.DB_POOL_LIMIT ?? 2),
    waitForConnections: true,
    enableKeepAlive: true,
    timezone: "Z",
    decimalNumbers: true
  };
}

export async function getPool(): Promise<Pool> {
  poolPromise ??= resolvePoolOptions().then((options) => mysql.createPool(options));
  return poolPromise;
}

export async function runMigrations(): Promise<void> {
  const pool = await getPool();
  await pool.query(PERSONAS_TABLE_SQL);
}

export async function createDatabaseAndRunMigrations(): Promise<void> {
  const databaseName = required("DB_NAME");
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error("DB_NAME solo puede contener letras, números y guion bajo");
  }

  const connection = await mysql.createConnection(await resolvePoolOptions(false));
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }

  await runMigrations();
}

export async function closePool(): Promise<void> {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.end();
    poolPromise = undefined;
  }
}
