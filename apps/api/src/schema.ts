export const PERSONAS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS personas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_completo VARCHAR(150) NOT NULL,
  rfc VARCHAR(13) NOT NULL,
  correo_electronico VARCHAR(254) NOT NULL,
  codigo_postal CHAR(5) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_personas_rfc (rfc),
  UNIQUE KEY uq_personas_correo (correo_electronico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;
