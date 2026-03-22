from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.models import Parte, Desperfecto, Estado
from app.schemas.partes import (
    ParteCreate, ParteUpdate, ParteResponse, ParteListItem
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
    """Recalcula estado y alta del parte basado en desperfectos."""
    parte = db.query(Parte).filter(Parte.id == parte_id).first()
    if not parte:
        return

    estados_resolutivos = db.query(Estado.nombre).filter(Estado.es_resolutivo == True).all()
    nombres_resolutivos = {e.nombre for e in estados_resolutivos}

    desperfectos = db.query(Desperfecto).filter(Desperfecto.parte_id == parte_id).all()

    if desperfectos:
        resueltos = sum(1 for d in desperfectos if d.estado in nombres_resolutivos)
        total = len(desperfectos)

        if resueltos == total:
            # Todos resueltos -> Operativo + alta
            parte.estado = "Operativo"
            parte.alta = True
        elif resueltos > 0:
            # Algunos resueltos -> En Proceso
            parte.estado = "En Proceso"
            parte.alta = False
        else:
            # Ninguno resuelto pero ya en taller
            if parte.fecha_ingreso and parte.estado == "Pendiente":
                parte.estado = "Pendiente"
            parte.alta = False
    else:
        # Sin desperfectos, respetar estado manual
        parte.alta = parte.estado in nombres_resolutivos

    db.commit()


@router.get("/", response_model=list[ParteListItem])
def listar_partes(
    tipo_taller: Optional[str] = None,
    estado: Optional[str] = None,
    alta: Optional[bool] = None,
    dominio: Optional[str] = None,
    taller_box: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista partes con filtros opcionales."""
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

    if tipo_taller:
        query = query.filter(Parte.tipo_taller == tipo_taller)
    if estado:
        query = query.filter(Parte.estado == estado)
    if alta is not None:
        query = query.filter(Parte.alta == alta)
    if dominio:
        query = query.filter(Parte.dominio.ilike(f"%{dominio}%"))
    if taller_box:
        query = query.filter(Parte.taller_box == taller_box)

    query = query.order_by(Parte.created_at.desc())
    results = query.all()

    items = []
    for parte, cant_desp, cant_res in results:
        items.append(ParteListItem(
            id=parte.id,
            n_parte=parte.n_parte,
            dominio=parte.dominio,
            chofer_nombre=parte.chofer_nombre,
            operacion=parte.operacion,
            tipo_reparacion=parte.tipo_reparacion,
            tipo_taller=parte.tipo_taller,
            taller_externo=parte.taller_externo,
            novedad=parte.novedad,
            taller_box=parte.taller_box,
            estado=parte.estado,
            observaciones=parte.observaciones,
            fecha_ingreso=parte.fecha_ingreso,
            ingreso_confirmado=parte.ingreso_confirmado if hasattr(parte, 'ingreso_confirmado') else False,
            fecha_probable_fin=parte.fecha_probable_fin,
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
    """Crea un parte con sus desperfectos opcionales."""
    n_parte = data.n_parte or generar_n_parte(db)

    existe = db.query(Parte).filter(Parte.n_parte == n_parte).first()
    if existe:
        raise HTTPException(status_code=409, detail=f"Ya existe un parte con N {n_parte}")

    parte = Parte(
        n_parte=n_parte,
        dominio=data.dominio.upper(),
        operacion=data.operacion.upper(),
        tipo_reparacion=data.tipo_reparacion.upper(),
        tipo_taller=data.tipo_taller.upper(),
        taller_externo=data.taller_externo,
        novedad=data.novedad,
        taller_box=data.taller_box.upper() if data.taller_box else None,
        observaciones=data.observaciones,
        fecha_ingreso=data.fecha_ingreso or date.today(),
        fecha_probable_fin=data.fecha_probable_fin,
    )
    db.add(parte)
    db.flush()

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
def actualizar_parte(parte_id: int, data: ParteUpdate, db: Session = Depends(get_db)):
    """Actualiza campos de un parte."""
    parte = db.query(Parte).options(
        joinedload(Parte.desperfectos)
    ).filter(Parte.id == parte_id).first()

    if not parte:
        raise HTTPException(status_code=404, detail="Parte no encontrado")

    if data.estado is not None:
        # Validar que el estado exista
        estado_obj = db.query(Estado).filter(Estado.nombre == data.estado).first()
        if not estado_obj:
            raise HTTPException(status_code=400, detail=f"Estado '{data.estado}' no existe")
        parte.estado = data.estado

    if data.observaciones is not None:
        parte.observaciones = data.observaciones
    if data.fecha_ingreso is not None:
        parte.fecha_ingreso = data.fecha_ingreso
    if data.ingreso_confirmado is not None:
        parte.ingreso_confirmado = data.ingreso_confirmado
        if data.ingreso_confirmado and parte.estado == "Pendiente de Ingreso":
            parte.estado = "Pendiente"
    if data.fecha_probable_fin is not None:
        parte.fecha_probable_fin = data.fecha_probable_fin
    if data.tipo_taller is not None:
        parte.tipo_taller = data.tipo_taller.upper()
    if data.taller_box is not None:
        parte.taller_box = data.taller_box.upper()
    if data.novedad is not None:
        parte.novedad = data.novedad
    if data.tipo_reparacion is not None:
        parte.tipo_reparacion = data.tipo_reparacion.upper()

    db.commit()
    db.refresh(parte)

    # Recalcular alta
    recalcular_alta(db, parte_id)
    db.refresh(parte)

    return parte


@router.delete("/{parte_id}", status_code=204)
def eliminar_parte(parte_id: int, db: Session = Depends(get_db)):
    """Elimina un parte y sus desperfectos/adjuntos (cascade)."""
    parte = db.query(Parte).filter(Parte.id == parte_id).first()
    if not parte:
        raise HTTPException(status_code=404, detail="Parte no encontrado")
    db.delete(parte)
    db.commit()
