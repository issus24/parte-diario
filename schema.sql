-- Parte Diario - Schema PostgreSQL
-- Sistema de gestión de reparaciones de flota

-- Tabla de estados (predefinidos + custom)
CREATE TABLE IF NOT EXISTS estados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    es_resolutivo BOOLEAN NOT NULL DEFAULT FALSE,
    color VARCHAR(20) DEFAULT 'gray',
    orden INTEGER NOT NULL DEFAULT 0
);

-- Seed estados predefinidos
INSERT INTO estados (nombre, es_resolutivo, color, orden) VALUES
    ('Pendiente',           FALSE, 'warning',  0),
    ('En Proceso',          FALSE, 'info',     1),
    ('Esperando Repuesto',  FALSE, 'orange',   2),
    ('Reparado',            TRUE,  'success',  3),
    ('No Aplica',           TRUE,  'muted',    4)
ON CONFLICT (nombre) DO NOTHING;

-- Tabla principal de partes
CREATE TABLE IF NOT EXISTS partes (
    id SERIAL PRIMARY KEY,
    n_parte VARCHAR(20) NOT NULL UNIQUE,
    patente VARCHAR(60) NOT NULL,
    chofer VARCHAR(100) NOT NULL,
    km INTEGER,
    fecha_carga TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_citacion DATE,
    alta BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de desperfectos (1 parte -> N desperfectos)
CREATE TABLE IF NOT EXISTS desperfectos (
    id SERIAL PRIMARY KEY,
    parte_id INTEGER NOT NULL REFERENCES partes(id) ON DELETE CASCADE,
    sector VARCHAR(30) NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    notas TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de log de sync con Google Sheets
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(30) NOT NULL,
    ultimo_sync TIMESTAMP NOT NULL DEFAULT NOW(),
    filas_sync INTEGER NOT NULL DEFAULT 0
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_partes_fecha_citacion ON partes(fecha_citacion);
CREATE INDEX IF NOT EXISTS idx_partes_alta ON partes(alta);
CREATE INDEX IF NOT EXISTS idx_partes_patente ON partes(patente);
CREATE INDEX IF NOT EXISTS idx_desperfectos_parte_id ON desperfectos(parte_id);
CREATE INDEX IF NOT EXISTS idx_desperfectos_estado ON desperfectos(estado);

-- Trigger para updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_partes_updated
    BEFORE UPDATE ON partes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_desperfectos_updated
    BEFORE UPDATE ON desperfectos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
