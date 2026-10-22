from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ITHRAA_", extra="ignore")

    database_url: str = "postgresql+psycopg://ithraa:ithraa@localhost:5432/ithraa"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0000"
    jwt_ttl_hours: int = 12
    cors_origins: str = "http://localhost:5173"
    upload_dir: Path = Path("uploads")

    # Demo mode exposes one-click "view as" logins and freezes the clock so the
    # seeded school year reads the way the prototype does.
    demo_mode: bool = True
    demo_now: datetime | None = datetime(2026, 10, 21, 18, 30)

    # School calendar: week 1 starts on this Monday; the year has 28 program weeks.
    year_label: str = "2026–27"
    week1_monday: date = date(2026, 9, 14)
    total_weeks: int = 28


@lru_cache
def get_settings() -> Settings:
    return Settings()
