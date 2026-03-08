from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float
from sqlalchemy.sql import func
from database import Base


class App(Base):
    __tablename__ = "apps"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    icon = Column(String)
    category = Column(String)
    version = Column(String, default="1.0.0")
    author = Column(String, default="ModevI")
    installed = Column(Boolean, default=False)
    active = Column(Boolean, default=False)
    install_date = Column(DateTime, nullable=True)
    color = Column(String, default="#6366f1")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    color = Column(String, default="#fef08a")
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_id = Column(String, nullable=False)
    key = Column(String, nullable=False)
    value = Column(Text)


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_id = Column(String, nullable=False)
    action = Column(String, nullable=False)  # installed, uninstalled, activated, deactivated
    timestamp = Column(DateTime, server_default=func.now())
