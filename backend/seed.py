"""Seed the database with initial platform and device data."""
import bcrypt

from database import PlatformSession, DeviceSession, init_db
from models_platform import User, Category, HardwareTag, StoreApp
from models_device import InstalledApp, ActivityLog, DeviceSetting


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# Seed data
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
    {"key": "display_brightness", "value": "80",               "description": "Pantalla: nivel de brillo (0-100)"},
    {"key": "timezone",           "value": "Europe/Madrid",    "description": "Zona horaria del dispositivo"},
    {"key": "kiosk_url",          "value": "http://localhost:8000", "description": "URL que abre Chromium en modo kiosk al arrancar"},
]


# ---------------------------------------------------------------------------
# Seed function
# ---------------------------------------------------------------------------


def seed():
    init_db()
    platform_db = PlatformSession()
    device_db = DeviceSession()

    try:
        # ---- Users (platform) -----------------------------------------------
        admin = platform_db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@modevi.local",
                hashed_password=_hash("admin123"),
                role="admin",
                bio="Platform administrator",
            )
            platform_db.add(admin)

        devuser = platform_db.query(User).filter(User.username == "devuser").first()
        if not devuser:
            devuser = User(
                username="devuser",
                email="dev@modevi.local",
                hashed_password=_hash("dev123"),
                role="developer",
                bio="ModevI built-in developer account",
                website="https://modevi.local",
            )
            platform_db.add(devuser)

        platform_db.flush()

        # ---- Categories (platform) ------------------------------------------
        cat_map: dict[str, Category] = {}
        for cat_data in CATEGORIES:
            cat = platform_db.query(Category).filter(Category.slug == cat_data["slug"]).first()
            if not cat:
                cat = Category(**cat_data)
                platform_db.add(cat)
                platform_db.flush()
            cat_map[cat.slug] = cat

        # ---- Hardware tags (platform) ----------------------------------------
        for ht_data in HARDWARE_TAGS:
            if not platform_db.query(HardwareTag).filter(HardwareTag.slug == ht_data["slug"]).first():
                platform_db.add(HardwareTag(**ht_data))

        platform_db.flush()

        # ---- Demo store apps (platform) + auto-install (device) -------------
        for app_data in DEMO_APPS:
            existing = platform_db.query(StoreApp).filter(StoreApp.slug == app_data["slug"]).first()
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
                platform_db.add(store_app)
                platform_db.flush()

                # Auto-install only default apps on device DB
                DEFAULT_APPS = {"clock", "sysmonitor", "notes"}
                if app_data["slug"] in DEFAULT_APPS:
                    already_installed = device_db.query(InstalledApp).filter(
                        InstalledApp.store_app_id == store_app.id
                    ).first()
                    if not already_installed:
                        installed = InstalledApp(
                            store_app_id=store_app.id,
                            is_active=False,
                            install_path=f"apps/{app_data['slug']}",
                        )
                        device_db.add(installed)
                        device_db.flush()

                        device_db.add(ActivityLog(
                            installed_app_id=installed.id,
                            action="install",
                            details=f"App '{app_data['name']}' preinstalada en el dispositivo",
                        ))

        # ---- Device settings (device) ----------------------------------------
        for setting_data in DEVICE_SETTINGS:
            if not device_db.query(DeviceSetting).filter(
                DeviceSetting.key == setting_data["key"]
            ).first():
                device_db.add(DeviceSetting(**setting_data))

        platform_db.commit()
        device_db.commit()
        print("Database seeded successfully.")

    except Exception:
        platform_db.rollback()
        device_db.rollback()
        raise
    finally:
        platform_db.close()
        device_db.close()


if __name__ == "__main__":
    seed()
