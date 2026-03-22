from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import os

from app.core.config import settings
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(NoCacheMiddleware)

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
