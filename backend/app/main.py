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
    Base.metadata.create_all(bind=engine)
    # Seed estados predefinidos
    with Session(engine) as db:
        if db.query(Estado).count() == 0:
            estados_seed = [
                Estado(nombre="Pendiente", es_resolutivo=False, color="warning", orden=0),
                Estado(nombre="En Proceso", es_resolutivo=False, color="info", orden=1),
                Estado(nombre="Esperando Repuesto", es_resolutivo=False, color="orange", orden=2),
                Estado(nombre="Reparado", es_resolutivo=True, color="success", orden=3),
                Estado(nombre="No Aplica", es_resolutivo=True, color="muted", orden=4),
            ]
            db.add_all(estados_seed)
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
