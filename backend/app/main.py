from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from starlette.requests import Request
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.models import Estado, Parte, Desperfecto, SyncLog
from app.routers import partes, desperfectos, estados


# --- Anti-cache middleware (desarrollo) ---
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets") or request.url.path.endswith(".html"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return response


app = FastAPI(
    title="Parte Diario API",
    description="Sistema de gestion de reparaciones de flota - Logiteck",
    version="1.0.0"
)


@app.on_event("startup")
def on_startup():
    """Crea tablas y seed de estados al iniciar."""
    from sqlalchemy.orm import Session
    from sqlalchemy import inspect, text

    # Crear tablas nuevas si no existen
    Base.metadata.create_all(bind=engine)

    # Migrar columnas si es necesario (tabla existente pre-restructura)
    with engine.connect() as conn:
        inspector = inspect(engine)
        if inspector.has_table("partes"):
            existing_cols = {c["name"] for c in inspector.get_columns("partes")}
            # Solo migrar si la tabla vieja tiene "patente" y no tiene "dominio"
            if "patente" in existing_cols and "dominio" not in existing_cols:
                conn.execute(text("ALTER TABLE partes RENAME COLUMN patente TO dominio"))
            # Agregar columnas nuevas que falten
            new_cols = {
                "operacion": "VARCHAR(60) DEFAULT 'BASE TT'",
                "tipo_reparacion": "VARCHAR(20) DEFAULT 'RAPIDA'",
                "tipo_taller": "VARCHAR(20) DEFAULT 'INTERNO'",
                "taller_externo": "VARCHAR(100)",
                "novedad": "TEXT DEFAULT ''",
                "taller_box": "VARCHAR(50)",
                "estado": "VARCHAR(50) DEFAULT 'Pendiente'",
                "observaciones": "TEXT",
                "fecha_ingreso": "DATE",
                "fecha_probable_fin": "DATE",
            }
            for col, col_type in new_cols.items():
                if col not in existing_cols:
                    conn.execute(text(f"ALTER TABLE partes ADD COLUMN {col} {col_type}"))
            conn.commit()

    # Seed estados
    with Session(engine) as db:
        if db.query(Estado).count() == 0:
            estados_seed = [
                Estado(nombre="Pendiente", es_resolutivo=False, color="warning", orden=0),
                Estado(nombre="En Proceso", es_resolutivo=False, color="info", orden=1),
                Estado(nombre="En Espera", es_resolutivo=False, color="orange", orden=2),
                Estado(nombre="Esperando Repuesto", es_resolutivo=False, color="orange", orden=3),
                Estado(nombre="Operativo", es_resolutivo=True, color="success", orden=4),
                Estado(nombre="No Aplica", es_resolutivo=True, color="muted", orden=5),
            ]
            db.add_all(estados_seed)
            db.commit()
        else:
            # Agregar estados nuevos si no existen
            for nombre, resolutivo, color, orden in [
                ("En Espera", False, "orange", 2),
                ("Operativo", True, "success", 4),
            ]:
                if not db.query(Estado).filter(Estado.nombre == nombre).first():
                    db.add(Estado(nombre=nombre, es_resolutivo=resolutivo, color=color, orden=orden))
            db.commit()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(NoCacheMiddleware)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# Routers API
app.include_router(partes.router, prefix="/api")
app.include_router(desperfectos.router, prefix="/api")
app.include_router(estados.router, prefix="/api")

# Servir frontend estático
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")
if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.get("/{page}.html")
    async def serve_page(page: str):
        file_path = os.path.join(frontend_path, f"{page}.html")
        if os.path.exists(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))
