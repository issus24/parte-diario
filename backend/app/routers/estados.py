from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models import Estado
from app.schemas.partes import EstadoCreate, EstadoResponse

router = APIRouter(prefix="/estados", tags=["estados"])


@router.get("/", response_model=list[EstadoResponse])
def listar_estados(db: Session = Depends(get_db)):
    """Lista todos los estados disponibles (predefinidos + custom)."""
    return db.query(Estado).order_by(Estado.orden).all()


@router.post("/", response_model=EstadoResponse, status_code=201)
def crear_estado(data: EstadoCreate, db: Session = Depends(get_db)):
    """Crea un estado custom."""
    existe = db.query(Estado).filter(Estado.nombre == data.nombre).first()
    if existe:
        raise HTTPException(status_code=409, detail=f"Ya existe el estado '{data.nombre}'")

    max_orden = db.query(func.max(Estado.orden)).scalar() or 0

    estado = Estado(
        nombre=data.nombre,
        es_resolutivo=data.es_resolutivo,
        color=data.color,
        orden=max_orden + 1
    )
    db.add(estado)
    db.commit()
    db.refresh(estado)
    return estado
