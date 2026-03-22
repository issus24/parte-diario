from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


# --- Desperfecto ---

class DesperfectoCreate(BaseModel):
    sector: str
    descripcion: str


class DesperfectoUpdate(BaseModel):
    estado: str
    notas: Optional[str] = None


class DesperfectoResponse(BaseModel):
    id: int
    parte_id: int
    sector: str
    descripcion: str
    estado: str
    notas: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Parte ---

class ParteCreate(BaseModel):
    n_parte: Optional[str] = None  # auto-generado si no se envia
    dominio: str
    operacion: str = "BASE TT"
    tipo_reparacion: str = "RAPIDA"  # RAPIDA, LENTA, PROFUNDA
    tipo_taller: str = "INTERNO"  # INTERNO, EXTERNO
    taller_externo: Optional[str] = None
    novedad: str
    taller_box: Optional[str] = None  # MECANICA, ELECTRICIDAD, etc.
    observaciones: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    fecha_probable_fin: Optional[date] = None
    desperfectos: List[DesperfectoCreate] = []


class ParteUpdate(BaseModel):
    estado: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    fecha_probable_fin: Optional[date] = None
    tipo_taller: Optional[str] = None
    taller_box: Optional[str] = None
    novedad: Optional[str] = None
    tipo_reparacion: Optional[str] = None


class ParteResponse(BaseModel):
    id: int
    n_parte: str
    dominio: str
    operacion: str
    tipo_reparacion: str
    tipo_taller: str
    taller_externo: Optional[str]
    novedad: str
    taller_box: Optional[str]
    estado: str
    observaciones: Optional[str]
    fecha_ingreso: Optional[date]
    fecha_probable_fin: Optional[date]
    alta: bool
    desperfectos: List[DesperfectoResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ParteListItem(BaseModel):
    id: int
    n_parte: str
    dominio: str
    operacion: str
    tipo_reparacion: str
    tipo_taller: str
    taller_externo: Optional[str]
    novedad: str
    taller_box: Optional[str]
    estado: str
    observaciones: Optional[str]
    fecha_ingreso: Optional[date]
    fecha_probable_fin: Optional[date]
    alta: bool
    cant_desperfectos: int = 0
    cant_resueltos: int = 0

    class Config:
        from_attributes = True


# --- Estado ---

class EstadoCreate(BaseModel):
    nombre: str
    es_resolutivo: bool = False
    color: str = "gray"


class EstadoResponse(BaseModel):
    id: int
    nombre: str
    es_resolutivo: bool
    color: str
    orden: int

    class Config:
        from_attributes = True
