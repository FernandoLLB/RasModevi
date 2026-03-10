"""Backward-compat re-export. Import directly from models_platform / models_device instead."""
from models_platform import (  # noqa: F401
    User,
    Category,
    HardwareTag,
    StoreApp,
    AppRating,
    store_app_hardware,
)
from models_device import (  # noqa: F401
    InstalledApp,
    AppData,
    ActivityLog,
    Note,
    DeviceSetting,
    RegisteredSensor,
)
