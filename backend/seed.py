"""Seed the database with initial platform and device data."""
import bcrypt

from database import SessionLocal, init_db
from models import (
    User,
    Category,
    HardwareTag,
    StoreApp,
    InstalledApp,
    ActivityLog,
    DeviceSetting,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

CATEGORIES = [
    {"name": "Utilidades",    "slug": "utilidades",    "icon": "wrench",         "sort_order": 1},
    {"name": "Multimedia",    "slug": "multimedia",    "icon": "play-circle",    "sort_order": 2},
    {"name": "Productividad", "slug": "productividad", "icon": "briefcase",      "sort_order": 3},
    {"name": "Sistema",       "slug": "sistema",       "icon": "monitor",        "sort_order": 4},
    {"name": "Educación",     "slug": "educacion",     "icon": "book-open",      "sort_order": 5},
    {"name": "Juegos",        "slug": "juegos",        "icon": "gamepad-2",      "sort_order": 6},
    {"name": "IoT",           "slug": "iot",           "icon": "cpu",            "sort_order": 7},
    {"name": "Social",        "slug": "social",        "icon": "users",          "sort_order": 8},
]

HARDWARE_TAGS = [
    {"name": "GPIO",     "slug": "gpio",     "interface": "gpio",  "description": "General-purpose I/O pins"},
    {"name": "I2C",      "slug": "i2c",      "interface": "i2c",   "description": "Inter-Integrated Circuit bus"},
    {"name": "SPI",      "slug": "spi",      "interface": "spi",   "description": "Serial Peripheral Interface bus"},
    {"name": "DHT22",    "slug": "dht22",    "interface": "gpio",  "description": "Temperature and humidity sensor"},
    {"name": "BMP280",   "slug": "bmp280",   "interface": "i2c",   "description": "Barometric pressure and temperature sensor"},
    {"name": "HC-SR04",  "slug": "hc-sr04",  "interface": "gpio",  "description": "Ultrasonic distance sensor"},
    {"name": "Camera",   "slug": "camera",   "interface": "other", "description": "Raspberry Pi camera module"},
    {"name": "OLED",     "slug": "oled",     "interface": "i2c",   "description": "OLED display module"},
    {"name": "NeoPixel", "slug": "neopixel", "interface": "gpio",  "description": "WS2812B addressable RGB LED strip"},
]

# (slug, name, description, category_slug, icon_path, permissions, long_description)
DEMO_APPS = [
    {
        "slug": "clock",
        "name": "Reloj Digital",
        "description": "Un elegante reloj digital con fecha y hora actual. Perfecto para usar tu dispositivo como reloj de escritorio.",
        "long_description": (
            "Reloj Digital muestra la hora y fecha actuales con un diseño minimalista "
            "optimizado para pantallas táctiles. Admite múltiples zonas horarias y "
            "formatos de 12/24 horas."
        ),
        "category_slug": "utilidades",
        "icon_path": "/apps/clock/icon.svg",
        "permissions": [],
        "version": "1.0.0",
    },
    {
        "slug": "photoframe",
        "name": "Marco de Fotos",
        "description": "Transforma tu pantalla en un marco de fotos digital. Muestra tus imágenes favoritas con transiciones suaves.",
        "long_description": (
            "Marco de Fotos convierte tu dispositivo en un elegante portafotos digital. "
            "Soporta JPEG y PNG, presentación automática con transiciones configurables "
            "y lectura desde tarjeta microSD o USB."
        ),
        "category_slug": "multimedia",
        "icon_path": "/apps/photoframe/icon.svg",
        "permissions": [],
        "version": "1.0.0",
    },
    {
        "slug": "sysmonitor",
        "name": "Monitor del Sistema",
        "description": "Dashboard en tiempo real con información de CPU, memoria, temperatura y almacenamiento de tu dispositivo.",
        "long_description": (
            "Monitor del Sistema proporciona un panel detallado con métricas de hardware "
            "en tiempo real: uso de CPU por núcleo, temperatura, memoria RAM y SWAP, "
            "ocupación de disco y actividad de red."
        ),
        "category_slug": "sistema",
        "icon_path": "/apps/sysmonitor/icon.svg",
        "permissions": ["sensors"],
        "version": "1.0.0",
    },
    {
        "slug": "notes",
        "name": "Tablón de Notas",
        "description": "Un tablón para crear, organizar y fijar notas rápidas. Tus ideas siempre a mano en tu dispositivo.",
        "long_description": (
            "Tablón de Notas es una pizarra digital para capturar ideas rápidamente. "
            "Admite notas con colores personalizados, anclaje prioritario y sincronización "
            "local con la base de datos del dispositivo."
        ),
        "category_slug": "productividad",
        "icon_path": "/apps/notes/icon.svg",
        "permissions": ["db"],
        "version": "1.0.0",
    },
]

DEVICE_SETTINGS = [
    {
        "key": "display_brightness",
        "value": "80",
        "description": "Pantalla: nivel de brillo (0-100)",
    },
    {
        "key": "timezone",
        "value": "Europe/Madrid",
        "description": "Zona horaria del dispositivo",
    },
    {
        "key": "kiosk_url",
        "value": "http://localhost:8000",
        "description": "URL que abre Chromium en modo kiosk al arrancar",
    },
]


# ---------------------------------------------------------------------------
# Seed function
# ---------------------------------------------------------------------------


def seed():
    init_db()
    db = SessionLocal()

    try:
        # ---- Users ----------------------------------------------------------
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@modevi.local",
                hashed_password=_hash("admin123"),
                role="admin",
                bio="Platform administrator",
            )
            db.add(admin)

        devuser = db.query(User).filter(User.username == "devuser").first()
        if not devuser:
            devuser = User(
                username="devuser",
                email="dev@modevi.local",
                hashed_password=_hash("dev123"),
                role="developer",
                bio="ModevI built-in developer account",
                website="https://modevi.local",
            )
            db.add(devuser)

        db.flush()  # get IDs before referencing them

        # ---- Categories -----------------------------------------------------
        cat_map: dict[str, Category] = {}
        for cat_data in CATEGORIES:
            cat = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
            if not cat:
                cat = Category(**cat_data)
                db.add(cat)
                db.flush()
            cat_map[cat.slug] = cat

        # ---- Hardware tags --------------------------------------------------
        for ht_data in HARDWARE_TAGS:
            exists = db.query(HardwareTag).filter(HardwareTag.slug == ht_data["slug"]).first()
            if not exists:
                db.add(HardwareTag(**ht_data))

        db.flush()

        # ---- Store apps (4 demo apps) ----------------------------------------
        for app_data in DEMO_APPS:
            existing = db.query(StoreApp).filter(StoreApp.slug == app_data["slug"]).first()
            if not existing:
                category = cat_map.get(app_data["category_slug"])
                store_app = StoreApp(
                    developer_id=devuser.id,
                    category_id=category.id if category else None,
                    name=app_data["name"],
                    slug=app_data["slug"],
                    description=app_data["description"],
                    long_description=app_data.get("long_description"),
                    icon_path=app_data.get("icon_path"),
                    permissions=app_data.get("permissions", []),
                    required_hardware=[],
                    version=app_data["version"],
                    status="published",
                )
                db.add(store_app)
                db.flush()

                # Auto-install the demo apps on the device
                installed = InstalledApp(
                    store_app_id=store_app.id,
                    is_active=False,
                    install_path=f"apps/{app_data['slug']}",
                )
                db.add(installed)
                db.flush()

                db.add(
                    ActivityLog(
                        installed_app_id=installed.id,
                        action="install",
                        details=f"Demo app '{app_data['name']}' seeded on first boot",
                    )
                )

        # ---- Device settings ------------------------------------------------
        for setting_data in DEVICE_SETTINGS:
            exists = db.query(DeviceSetting).filter(
                DeviceSetting.key == setting_data["key"]
            ).first()
            if not exists:
                db.add(DeviceSetting(**setting_data))

        db.commit()
        print("Database seeded successfully.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
