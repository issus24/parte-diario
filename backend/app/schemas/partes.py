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
    patente: str
    chofer: str
    km: Optional[int] = None
    desperfectos: List[DesperfectoCreate]


class ParteUpdateFecha(BaseModel):
    fecha_citacion: Optional[date] = None


class ParteResponse(BaseModel):
    id: int
    n_parte: str
    patente: str
    chofer: str
    km: Optional[int]
    fecha_carga: datetime
    fecha_citacion: Optional[date]
    alta: bool
    desperfectos: List[DesperfectoResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ParteListItem(BaseModel):
    id: int
    n_parte: str
    patente: str
    chofer: str
    km: Optional[int]
    fecha_carga: datetime
    fecha_citacion: Optional[date]
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
