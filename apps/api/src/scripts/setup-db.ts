import "../load-env";
import { closePool, createDatabaseAndRunMigrations } from "../database";

try {
  await createDatabaseAndRunMigrations();
  console.log(`Base de datos ${process.env.DB_NAME} preparada correctamente`);
} finally {
  await closePool();
}
