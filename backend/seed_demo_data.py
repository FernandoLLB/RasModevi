"""Seed realistic demo ratings, downloads and users into the platform DB."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import bcrypt
from database import PlatformSession, init_db
from models_platform import User, StoreApp, AppRating

def _hash(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

FAKE_USERS = [
    ("maria_garcia",   "maria@example.com",    "user"),
    ("carlos_lopez",   "carlos@example.com",   "user"),
    ("ana_martinez",   "ana@example.com",       "user"),
    ("pedro_sanchez",  "pedro@example.com",     "user"),
    ("lucia_fernandez","lucia@example.com",     "user"),
    ("javier_ruiz",    "javier@example.com",    "user"),
    ("sofia_torres",   "sofia@example.com",     "user"),
    ("miguel_diaz",    "miguel@example.com",    "user"),
    ("elena_moreno",   "elena@example.com",     "user"),
    ("david_jimenez",  "david@example.com",     "developer"),
    ("laura_romero",   "laura@example.com",     "developer"),
]

# (store_app_slug, username, rating, comment)
RATINGS = [
    ("clock", "maria_garcia",    5, "Perfecto para tener en el escritorio, muy limpio."),
    ("clock", "carlos_lopez",    4, "Funciona bien, podría tener más temas de color."),
    ("clock", "ana_martinez",    5, "Exactamente lo que necesitaba para mi Pi."),
    ("clock", "pedro_sanchez",   4, "Muy bueno, interfaz sencilla y elegante."),
    ("clock", "lucia_fernandez", 5, "El mejor reloj digital que he probado en Pi."),
    ("clock", "javier_ruiz",     3, "Cumple su función pero le falta alarma."),
    ("clock", "sofia_torres",    5, "Ideal para modo kiosk en el salón."),

    ("photoframe", "maria_garcia",    4, "Bonito marco, las transiciones son suaves."),
    ("photoframe", "miguel_diaz",     5, "Perfecto para mostrar fotos de familia."),
    ("photoframe", "elena_moreno",    4, "Muy fácil de usar, buen resultado visual."),
    ("photoframe", "david_jimenez",   3, "Le falta soporte para más formatos de imagen."),
    ("photoframe", "carlos_lopez",    5, "Mi familia lo usa a diario, funciona genial."),

    ("sysmonitor", "david_jimenez",   5, "Imprescindible para monitorizar la Pi. Muy completo."),
    ("sysmonitor", "javier_ruiz",     5, "Las gráficas en tiempo real son muy útiles."),
    ("sysmonitor", "miguel_diaz",     4, "Buena app, echo de menos métricas de red."),
    ("sysmonitor", "laura_romero",    5, "Uso esto cada vez que hago pruebas de carga."),
    ("sysmonitor", "pedro_sanchez",   4, "Muy informativo, la temperatura de CPU es clave."),
    ("sysmonitor", "carlos_lopez",    3, "Bien pero consume algo de CPU él mismo."),

    ("notes", "ana_martinez",    5, "El tablón de notas es perfecto para el día a día."),
    ("notes", "lucia_fernandez", 4, "Me encanta poder fijar notas importantes."),
    ("notes", "sofia_torres",    5, "Lo uso para listas de la compra, funciona genial."),
    ("notes", "elena_moreno",    4, "Muy útil, le añadiría sincronización en la nube."),
    ("notes", "maria_garcia",    5, "Simple y efectivo, justo lo que necesitaba."),
]

DOWNLOADS = {
    "clock":       247,
    "photoframe":  183,
    "sysmonitor":  312,
    "notes":       198,
}

def seed_demo():
    init_db()
    db = PlatformSession()
    try:
        # Create fake users
        user_map = {}
        for username, email, role in FAKE_USERS:
            u = db.query(User).filter(User.username == username).first()
            if not u:
                u = User(username=username, email=email,
                         hashed_password=_hash("demo123"), role=role, is_active=True)
                db.add(u)
                db.flush()
                print(f"  + user: {username}")
            user_map[username] = u

        # Update downloads
        for slug, count in DOWNLOADS.items():
            app = db.query(StoreApp).filter(StoreApp.slug == slug).first()
            if app:
                app.downloads_count = count

        db.flush()

        # Create ratings
        app_map = {a.slug: a for a in db.query(StoreApp).all()}
        for slug, username, rating, comment in RATINGS:
            app = app_map.get(slug)
            user = user_map.get(username)
            if not app or not user:
                continue
            exists = db.query(AppRating).filter(
                AppRating.store_app_id == app.id,
                AppRating.user_id == user.id
            ).first()
            if not exists:
                db.add(AppRating(store_app_id=app.id, user_id=user.id,
                                 rating=rating, comment=comment))
                print(f"  + rating: {username} → {slug} ({rating}★)")

        db.flush()

        # Recalculate avg_rating and ratings_count
        from sqlalchemy import func
        for app in db.query(StoreApp).all():
            result = db.query(
                func.avg(AppRating.rating), func.count(AppRating.id)
            ).filter(AppRating.store_app_id == app.id).first()
            app.avg_rating = round(float(result[0]), 2) if result[0] else 0.0
            app.ratings_count = result[1] or 0
            print(f"  ★ {app.slug}: {app.avg_rating} ({app.ratings_count} ratings, {app.downloads_count} downloads)")

        db.commit()
        print("\nDemo data seeded successfully.")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo()
