import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


def get_db_connection():
    host = os.getenv("DB_HOST")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    database = os.getenv("DB_NAME")

    # Aiven
    ssl_ca = os.getenv("DB_SSL_CA")
    ssl_ca_path = BASE_DIR / ssl_ca

    connection = mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        # Aiven
        ssl_ca=str(ssl_ca_path),
        ssl_verify_cert=True,
        ssl_verify_identity=True,
    )
    print("DB", connection)
    return connection


def test_db_connection():
    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        cursor.close()

        return {
            "connected": result == (1,),
            "message": "Database connection successful",
        }

    except mysql.connector.Error as error:
        return {
            "connected": False,
            "message": str(error),
        }

    finally:
        if connection and connection.is_connected():
            connection.close()
