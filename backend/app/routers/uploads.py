from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import os
import uuid
import json
import traceback

from app.core.database import get_db
from app.models import Parte, Adjunto, Desperfecto
from app.routers.partes import generar_n_parte

router = APIRouter(tags=["uploads"])

UPLOADS_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_AUDIO = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def save_file(parte_id: int, file: UploadFile, tipo: str) -> tuple:
    """Guarda archivo y retorna (filename, original_name, mime_type)."""
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else ("jpg" if tipo == "foto" else "webm")
    filename = f"{uuid.uuid4().hex}.{ext}"
    parte_dir = os.path.join(UPLOADS_BASE, str(parte_id))
    os.makedirs(parte_dir, exist_ok=True)

    filepath = os.path.join(parte_dir, filename)
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (max 10MB)")

    with open(filepath, "wb") as f:
        f.write(content)

    return filename, file.filename, file.content_type


@router.post("/partes/chofer", status_code=201)
def crear_parte_chofer(
    dominio: str = Form(...),
    novedad: str = Form(...),
    chofer_nombre: str = Form(""),
    taller_box: str = Form(""),
    problemas: str = Form("[]"),
    fotos: Optional[List[UploadFile]] = File(None),
    audios: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db)
):
    """Endpoint para choferes: crea parte con fotos y audios."""
    if fotos is None:
        fotos = []
    if audios is None:
        audios = []

    try:
        if not dominio.strip():
            raise HTTPException(status_code=400, detail="Dominio es requerido")
        if not novedad.strip():
            raise HTTPException(status_code=400, detail="Novedad es requerida")

        n_parte = generar_n_parte(db)

        parte = Parte(
            n_parte=n_parte,
            dominio=dominio.strip().upper(),
            chofer=chofer_nombre.strip() or "",
            chofer_nombre=chofer_nombre.strip() or None,
            novedad=novedad.strip(),
            taller_box=taller_box.strip().upper() if taller_box.strip() else None,
            operacion="BASE TT",
            tipo_reparacion="RAPIDA",
            tipo_taller="INTERNO",
            estado="Pendiente",
        )
        db.add(parte)
        db.flush()

        # Crear desperfectos individuales desde problemas
        try:
            lista_problemas = json.loads(problemas)
        except (json.JSONDecodeError, TypeError):
            lista_problemas = []

        for prob in lista_problemas:
            if isinstance(prob, dict) and prob.get("texto"):
                db.add(Desperfecto(
                    parte_id=parte.id,
                    sector=prob.get("sector", "MECANICA").upper(),
                    descripcion=prob["texto"].strip(),
                ))

        # Guardar fotos
        for foto in fotos:
            try:
                if foto and foto.filename:
                    filename, original, mime = save_file(parte.id, foto, "foto")
                    db.add(Adjunto(
                        parte_id=parte.id, tipo="foto",
                        filename=filename, original_name=original, mime_type=mime
                    ))
            except Exception:
                pass

        # Guardar audios
        for audio in audios:
            try:
                if audio and audio.filename:
                    filename, original, mime = save_file(parte.id, audio, "audio")
                    db.add(Adjunto(
                        parte_id=parte.id, tipo="audio",
                        filename=filename, original_name=original, mime_type=mime
                    ))
            except Exception:
                pass

        db.commit()
        db.refresh(parte)

        return {
            "id": parte.id,
            "n_parte": parte.n_parte,
            "dominio": parte.dominio,
            "chofer_nombre": parte.chofer_nombre,
            "novedad": parte.novedad,
            "adjuntos": len(fotos) + len(audios),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_detail = traceback.format_exc()
        print(f"ERROR en crear_parte_chofer: {error_detail}")
        return JSONResponse(status_code=500, content={"detail": str(e), "trace": error_detail})


@router.get("/partes/{parte_id}/adjuntos")
def listar_adjuntos(parte_id: int, db: Session = Depends(get_db)):
    """Lista adjuntos de un parte."""
    adjuntos = db.query(Adjunto).filter(Adjunto.parte_id == parte_id).all()
    return [{
        "id": a.id,
        "tipo": a.tipo,
        "filename": a.filename,
        "original_name": a.original_name,
        "mime_type": a.mime_type,
        "url": f"/uploads/{parte_id}/{a.filename}",
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in adjuntos]
