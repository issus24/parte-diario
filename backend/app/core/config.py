from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/parte_diario"
    CORS_ORIGINS: str = "http://localhost:3001,http://127.0.0.1:3001"
    PORT: int = 3001
    GOOGLE_SHEETS_CREDENTIALS: str = "credentials.json"
    GOOGLE_SHEET_ID: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
