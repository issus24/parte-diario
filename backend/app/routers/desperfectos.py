from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Desperfecto, Estado
from app.schemas.partes import DesperfectoUpdate, DesperfectoResponse
from app.routers.partes import recalcular_alta

router = APIRouter(prefix="/desperfectos", tags=["desperfectos"])


@router.patch("/{desperfecto_id}/estado", response_model=DesperfectoResponse)
def actualizar_estado(
    desperfecto_id: int,
    data: DesperfectoUpdate,
    db: Session = Depends(get_db)
):
    """Actualiza el estado de un desperfecto individual (Taller)."""
    desperfecto = db.query(Desperfecto).filter(Desperfecto.id == desperfecto_id).first()
    if not desperfecto:
        raise HTTPException(status_code=404, detail="Desperfecto no encontrado")

    estado = db.query(Estado).filter(Estado.nombre == data.estado).first()
    if not estado:
        raise HTTPException(status_code=400, detail=f"Estado '{data.estado}' no existe")

    desperfecto.estado = data.estado
    if data.notas is not None:
        desperfecto.notas = data.notas

    db.commit()
    db.refresh(desperfecto)

    recalcular_alta(db, desperfecto.parte_id)

    return desperfecto
