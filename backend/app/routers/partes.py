from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.models import Parte, Desperfecto, Estado
from app.schemas.partes import (
    ParteCreate, ParteUpdateFecha, ParteResponse, ParteListItem
)

router = APIRouter(prefix="/partes", tags=["partes"])


def generar_n_parte(db: Session) -> str:
    """Genera el siguiente N Parte en formato 0000-XXXXX."""
    ultimo = db.query(func.max(Parte.n_parte)).scalar()
    if ultimo:
        try:
            num = int(ultimo.split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"0000-{num:05d}"


def recalcular_alta(db: Session, parte_id: int):
    """Recalcula si un parte tiene alta (todos desperfectos resueltos)."""
    desperfectos = db.query(Desperfecto).filter(Desperfecto.parte_id == parte_id).all()
    if not desperfectos:
        return

    # Obtener estados resolutivos
    estados_resolutivos = db.query(Estado.nombre).filter(Estado.es_resolutivo == True).all()
    nombres_resolutivos = {e.nombre for e in estados_resolutivos}

    todos_resueltos = all(d.estado in nombres_resolutivos for d in desperfectos)

    parte = db.query(Parte).filter(Parte.id == parte_id).first()
    if parte:
        parte.alta = todos_resueltos
        db.commit()


@router.get("/", response_model=list[ParteListItem])
def listar_partes(
    fecha_citacion: Optional[date] = None,
    alta: Optional[bool] = None,
    sin_citar: Optional[bool] = None,
    patente: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista partes con filtros opcionales."""
    # Subquery para contar desperfectos y resueltos
    estados_resolutivos = db.query(Estado.nombre).filter(Estado.es_resolutivo == True).subquery()

    query = db.query(
        Parte,
        func.count(Desperfecto.id).label("cant_desperfectos"),
        func.sum(
            case(
                (Desperfecto.estado.in_(db.query(Estado.nombre).filter(Estado.es_resolutivo == True)), 1),
                else_=0
            )
        ).label("cant_resueltos")
    ).outerjoin(Desperfecto).group_by(Parte.id)

    if fecha_citacion:
        query = query.filter(Parte.fecha_citacion == fecha_citacion)
    if alta is not None:
        query = query.filter(Parte.alta == alta)
    if sin_citar:
        query = query.filter(Parte.fecha_citacion.is_(None))
    if patente:
        query = query.filter(Parte.patente.ilike(f"%{patente}%"))

    query = query.order_by(Parte.fecha_carga.desc())
    results = query.all()

    items = []
    for parte, cant_desp, cant_res in results:
        items.append(ParteListItem(
            id=parte.id,
            n_parte=parte.n_parte,
            patente=parte.patente,
            chofer=parte.chofer,
            km=parte.km,
            fecha_carga=parte.fecha_carga,
            fecha_citacion=parte.fecha_citacion,
            alta=parte.alta,
            cant_desperfectos=cant_desp or 0,
            cant_resueltos=int(cant_res or 0)
        ))
    return items


@router.get("/{parte_id}", response_model=ParteResponse)
def obtener_parte(parte_id: int, db: Session = Depends(get_db)):
    """Obtiene un parte con todos sus desperfectos."""
    parte = db.query(Parte).options(
        joinedload(Parte.desperfectos)
    ).filter(Parte.id == parte_id).first()

    if not parte:
        raise HTTPException(status_code=404, detail="Parte no encontrado")
    return parte


@router.post("/", response_model=ParteResponse, status_code=201)
def crear_parte(data: ParteCreate, db: Session = Depends(get_db)):
    """Crea un parte con sus desperfectos."""
    if not data.desperfectos:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un desperfecto")

    n_parte = data.n_parte or generar_n_parte(db)

    # Verificar que no exista
    existe = db.query(Parte).filter(Parte.n_parte == n_parte).first()
    if existe:
        raise HTTPException(status_code=409, detail=f"Ya existe un parte con N {n_parte}")

    parte = Parte(
        n_parte=n_parte,
        patente=data.patente.upper(),
        chofer=data.chofer,
        km=data.km
    )
    db.add(parte)
    db.flush()  # para obtener el id

    for desp in data.desperfectos:
        desperfecto = Desperfecto(
            parte_id=parte.id,
            sector=desp.sector.upper(),
            descripcion=desp.descripcion
        )
        db.add(desperfecto)

    db.commit()
    db.refresh(parte)
    return parte


@router.patch("/{parte_id}", response_model=ParteResponse)
def actualizar_parte(parte_id: int, data: ParteUpdateFecha, db: Session = Depends(get_db)):
    """Actualiza fecha de citacion de un parte (Coordinacion)."""
    parte = db.query(Parte).options(
        joinedload(Parte.desperfectos)
    ).filter(Parte.id == parte_id).first()

    if not parte:
        raise HTTPException(status_code=404, detail="Parte no encontrado")

    parte.fecha_citacion = data.fecha_citacion
    db.commit()
    db.refresh(parte)
    return parte
