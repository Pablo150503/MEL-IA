"""
citaRIS.py - Canal RIS de Mirth Connect
---------------------------------------------------------------------------------------------
Da de alta la cita de la prueba en el RIS: genera su identificador (citaKey) y la registra
en la base de datos del RIS (SQLite). La citaKey es la subcarpeta del PACS donde se guardan
las imágenes de esa cita: PACS/<idPaciente>/<citaKey>/

Lo lanza el canal RIS:   python citaRIS.py <ruta del JSON temporal>

Entrada (JSON): la salida de procesadoIMG.py
    {"id", "idPaciente", "imagenOriginal", "imagenProcesada"}

Salida (stdout, JSON):
    {"citaKey", "idPaciente", "idImagen", "fecha", "imagen"}
    "imagen" es la imagen procesada; Mirth la guarda en MIRTH/IMG-POST/<id>-<fecha>.jpg

Base de datos: ris.db junto a este script (o la ruta de la variable de entorno RIS_DB).
---------------------------------------------------------------------------------------------
"""

import json
import os
import re
import sqlite3
import sys
from datetime import datetime

RIS_DB = os.environ.get("RIS_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ris.db"))


def registrar_cita(cita):
    with sqlite3.connect(RIS_DB) as conexion:
        conexion.execute(
            """CREATE TABLE IF NOT EXISTS citas (
                   citaKey    TEXT PRIMARY KEY,
                   idPaciente TEXT NOT NULL,
                   idImagen   TEXT NOT NULL,
                   fecha      TEXT NOT NULL,
                   estado     TEXT NOT NULL DEFAULT 'PENDIENTE_INFORME'
               )"""
        )
        conexion.execute(
            "INSERT INTO citas (citaKey, idPaciente, idImagen, fecha) VALUES (?, ?, ?, ?)",
            (cita["citaKey"], cita["idPaciente"], cita["idImagen"], cita["fecha"]),
        )


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        msg = json.load(f)

    ahora = datetime.now()
    id_imagen = str(msg["id"])
    # Se usa como nombre de carpeta: solo letras, números, "-" y "_"
    cita_key = re.sub(r"[^A-Za-z0-9_-]", "_", f"{ahora:%Y%m%d%H%M%S}-{id_imagen}")

    cita = {
        "citaKey": cita_key,
        "idPaciente": str(msg.get("idPaciente", "")),
        "idImagen": id_imagen,
        "fecha": ahora.isoformat(timespec="seconds"),
    }
    registrar_cita(cita)

    print(json.dumps({**cita, "imagen": msg["imagenProcesada"]}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": f"citaRIS: {e}"}))
        sys.exit(1)
