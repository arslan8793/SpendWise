import bcrypt
import json
import base64
import os
from pathlib import Path
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

REQUEST_AES_KEY = os.getenv("REQUEST_AES_KEY")
PASSWORD_AES_KEY = os.getenv("PASSWORD_AES_KEY")

if not PASSWORD_AES_KEY:
    raise RuntimeError("PASSWORD_AES_KEY is not configured")

PASSWORD_AES_KEY = base64.b64decode(PASSWORD_AES_KEY, validate=True)

if len(PASSWORD_AES_KEY) != 32:
    raise RuntimeError("PASSWORD_AES_KEY must be 32 bytes")


if not REQUEST_AES_KEY:
    raise RuntimeError("REQUEST_AES_KEY is not configured")

REQUEST_AES_KEY = REQUEST_AES_KEY.encode("utf-8")


# def hash_password(password: str) -> str:
#     password_bytes = password.encode("utf-8")

#     if len(password_bytes) > 72:
#         raise ValueError("Password exceeds bcrypt's 72-byte limit")

#     return bcrypt.hashpw(
#         password_bytes,
#         bcrypt.gensalt(),
#     ).decode("utf-8")


# def verify_password(password: str, password_hash: str) -> bool:
#     try:
#         return bcrypt.checkpw(
#             password.encode("utf-8"),
#             password_hash.encode("utf-8"),
#         )
#     except (ValueError, TypeError):
#         return False


def encrypt_password(password: str) -> str:
    encrypted = encryptAesText(password, PASSWORD_AES_KEY)
    return json.dumps(encrypted)


def decrypt_password(encrypted_password: str) -> str:
    encrypted = json.loads(encrypted_password)

    return decryptAesText(
        encrypted["ciphertext"],
        encrypted["nonce"],
        PASSWORD_AES_KEY,
    )


def encryptAesText(plain_text: str, aes_key: bytes) -> dict:
    nonce = os.urandom(12)

    ciphertext = AESGCM(aes_key).encrypt(
        nonce,
        plain_text.encode("utf-8"),
        None,
    )

    return {
        "nonce": base64.b64encode(nonce).decode("utf-8"),
        "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
    }


def decryptAesText(ciphertext: str, nonce: str, aes_key: bytes) -> str:
    decrypted_bytes = AESGCM(aes_key).decrypt(
        base64.b64decode(nonce),
        base64.b64decode(ciphertext),
        None,
    )

    return decrypted_bytes.decode("utf-8")


# cc = {"data": {"email": "lonely@givmail.com"}}


# print(encryptAesText(json.dumps(cc), REQUEST_AES_KEY))


car = {
    "data": {
        "token": "44c6cface01b665ba2879aca2b9c8d441b8039f76b28967d85dc50d79bc16a03",
        "new_password": "lonely@1234",
    }
}

# print(decryptAesText(json.dumps(car), REQUEST_AES_KEY))


# encrypted_data = encryptAesText(json.dumps(car), REQUEST_AES_KEY)
# print(json.dumps(encrypted_data, indent=2))


# password = "Admin@1234"

# # Encrypt the password using PASSWORD_AES_KEY
# encrypted_password = encrypt_password(password)
# print("Encrypted password:", encrypted_password)

# # Decrypt the encrypted password
# decrypted_password = decrypt_password(encrypted_password)
# print("Decrypted password:", decrypted_password)

# # Verify the result
# print("Password matched:", password == decrypted_password)
