from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()


def get_environment_variable(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        raise EnvironmentError(f"Environment variable '{name}' not found.")
    return value


ODOO_API_KEY = get_environment_variable("ODOO_API_KEY")
ODOO_URL = get_environment_variable("ODOO_URL")
ODOO_DATABASE = get_environment_variable("ODOO_DATABASE")
ODOO_USERNAME = get_environment_variable("ODOO_USERNAME")

LEBONCOIN_IDENTIFIER = get_environment_variable("LEBONCOIN_IDENTIFIER")

FILE_PATH = Path(f"{LEBONCOIN_IDENTIFIER}.json")
