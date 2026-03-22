from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Estado(Base):
    __tablename__ = "estados"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    es_resolutivo = Column(Boolean, default=False, nullable=False)
    color = Column(String(20), default="gray")
    orden = Column(Integer, default=0, nullable=False)


class Parte(Base):
    __tablename__ = "partes"

    id = Column(Integer, primary_key=True, index=True)
    n_parte = Column(String(20), unique=True, nullable=False)
    dominio = Column(String(60), nullable=False)  # era "patente"
    operacion = Column(String(60), default="BASE TT")
    tipo_reparacion = Column(String(20), default="RAPIDA")  # RAPIDA, LENTA, PROFUNDA
    tipo_taller = Column(String(20), default="INTERNO")  # INTERNO, EXTERNO
    taller_externo = Column(String(100), nullable=True)  # nombre del taller si es externo
    novedad = Column(Text, nullable=False)  # descripcion completa del trabajo
    taller_box = Column(String(50), nullable=True)  # MECANICA, ELECTRICIDAD, HERRERIA, CHAPA/PINTURA, GOMERIA
    estado = Column(String(50), default="Pendiente", nullable=False)
    observaciones = Column(Text, nullable=True)
    fecha_ingreso = Column(Date, nullable=True)
    fecha_probable_fin = Column(Date, nullable=True)
    alta = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    desperfectos = relationship("Desperfecto", back_populates="parte", cascade="all, delete-orphan")


class Desperfecto(Base):
    __tablename__ = "desperfectos"

    id = Column(Integer, primary_key=True, index=True)
    parte_id = Column(Integer, ForeignKey("partes.id", ondelete="CASCADE"), nullable=False)
    sector = Column(String(30), nullable=False)
    descripcion = Column(Text, nullable=False)
    estado = Column(String(50), default="Pendiente", nullable=False)
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    parte = relationship("Parte", back_populates="desperfectos")


class SyncLog(Base):
    __tablename__ = "sync_log"

    id = Column(Integer, primary_key=True, index=True)
    tabla = Column(String(30), nullable=False)
    ultimo_sync = Column(DateTime, server_default=func.now(), nullable=False)
    filas_sync = Column(Integer, default=0, nullable=False)
