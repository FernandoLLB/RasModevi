"""Seed the database with demo apps."""
from database import SessionLocal, init_db
from models import App

DEMO_APPS = [
    {
        "id": "clock",
        "name": "Reloj Digital",
        "description": "Un elegante reloj digital con fecha y hora actual. Perfecto para usar tu dispositivo como reloj de escritorio.",
        "icon": "clock",
        "category": "Utilidades",
        "version": "1.0.0",
        "color": "#6366f1",
    },
    {
        "id": "photoframe",
        "name": "Marco de Fotos",
        "description": "Transforma tu pantalla en un marco de fotos digital. Muestra tus imágenes favoritas con transiciones suaves.",
        "icon": "image",
        "category": "Multimedia",
        "version": "1.0.0",
        "color": "#ec4899",
    },
    {
        "id": "sysmonitor",
        "name": "Monitor del Sistema",
        "description": "Dashboard en tiempo real con información de CPU, memoria, temperatura y almacenamiento de tu dispositivo.",
        "icon": "activity",
        "category": "Sistema",
        "version": "1.0.0",
        "color": "#10b981",
    },
    {
        "id": "notes",
        "name": "Tablón de Notas",
        "description": "Un tablón para crear, organizar y fijar notas rápidas. Tus ideas siempre a mano en tu dispositivo.",
        "icon": "sticky-note",
        "category": "Productividad",
        "version": "1.0.0",
        "color": "#f59e0b",
    },
]


def seed():
    init_db()
    db = SessionLocal()
    for app_data in DEMO_APPS:
        existing = db.query(App).filter(App.id == app_data["id"]).first()
        if not existing:
            db.add(App(**app_data))
    db.commit()
    db.close()
    print("Database seeded successfully.")


if __name__ == "__main__":
    seed()
