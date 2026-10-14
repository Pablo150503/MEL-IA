"""
procesadoIMG.py - Canal IMG de Mirth Connect
---------------------------------------------------------------------------------------------
Preprocesa la foto de la lesión con los mismos filtros que se aplicaron al dataset de
entrenamiento de la IA (DullRazor + CLAHE + normalización de color).

Lo lanza el canal IMG:   python procesadoIMG.py <ruta del JSON temporal>

Entrada (JSON que la app envía a :8092/api/imagen):
    {"id": "17", "idPaciente": "10293847", "imagen": "<JPEG/PNG en base64>"}

Salida (stdout, JSON). Mirth la reenvía tal cual al canal RIS:
    {"id", "idPaciente", "imagenOriginal", "imagenProcesada"}   (imágenes en JPEG base64)
---------------------------------------------------------------------------------------------
"""

import base64
import json
import sys
import warnings

import cv2
import numpy as np

warnings.filterwarnings("ignore")  # Mirth junta stderr con stdout: solo debe salir el JSON


# 1. Eliminación de vello con DullRazor
def remove_hair(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 17))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
    _, thresh = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)
    return cv2.inpaint(image, thresh, 1, cv2.INPAINT_TELEA)


# 2. Realce de contraste con CLAHE sobre la luminancia
def enhance_image(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


# 3. Normalización de color (ecualización del canal de luminancia)
def normalize_color(image):
    image = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    image[:, :, 0] = cv2.equalizeHist(image[:, :, 0])
    return cv2.cvtColor(image, cv2.COLOR_LAB2BGR)


def decodificar_imagen(texto):
    # Acepta base64 "puro" o un data URL (data:image/jpeg;base64,...)
    if texto.startswith("data:"):
        texto = texto.split(",", 1)[1]
    datos = np.frombuffer(base64.b64decode(texto), np.uint8)
    imagen = cv2.imdecode(datos, cv2.IMREAD_COLOR)
    if imagen is None:
        raise ValueError("No se ha podido decodificar la imagen")
    return imagen


def codificar_jpeg(imagen):
    ok, buffer = cv2.imencode(".jpg", imagen, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not ok:
        raise ValueError("No se ha podido codificar la imagen en JPEG")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        msg = json.load(f)

    original = decodificar_imagen(msg["imagen"])
    procesada = normalize_color(enhance_image(remove_hair(original)))

    print(json.dumps({
        "id": str(msg["id"]),
        "idPaciente": str(msg.get("idPaciente") or msg.get("sip") or ""),
        "imagenOriginal": codificar_jpeg(original),
        "imagenProcesada": codificar_jpeg(procesada),
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": f"procesadoIMG: {e}"}))
        sys.exit(1)
