"""
probar_circuito.py - Ejecuta el circuito de Mirth en local, sin Mirth
---------------------------------------------------------------------------------------------
Llama a los scripts de mirth/scripts igual que lo hacen los canales (mismos argumentos y
mismos ficheros temporales) y escribe lo que escribirían los File Writer de Mirth en una
carpeta de salida con la misma estructura que el servidor:

    salida_prueba/MIRTH/JSON-POST/<id>-<fecha>.json        canal MT
    salida_prueba/MIRTH/IMG-POST/<id>-<fecha>.jpg          canal RIS
    salida_prueba/PACS/<idPaciente>/<citaKey>/...          canales RIS y DICOM
    salida_prueba/ris.db                                   citas del RIS

Uso:
    python probar_circuito.py <foto.jpg> [--id 17] [--paciente 10293847]
                              [--edad 45] [--sexo Male] [--sitio 5]
---------------------------------------------------------------------------------------------
"""

import argparse
import base64
import json
import os
import subprocess
import sys
from datetime import datetime

CARPETA = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(CARPETA, "scripts")


def ejecutar(script, argumento, entorno):
    # Igual que el ProcessBuilder de los canales: stderr junto a stdout
    proceso = subprocess.run(
        [sys.executable, os.path.join(SCRIPTS, script), argumento],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=entorno,
    )
    salida = proceso.stdout.strip()
    respuesta = json.loads(salida)
    if proceso.returncode != 0 or "error" in respuesta:
        raise SystemExit(f"{script} ha fallado: {salida}")
    return respuesta


def escribir_json_temporal(carpeta, nombre, datos):
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, f"{nombre}.json")
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f)
    return ruta


def guardar_binario(carpeta, nombre, texto_base64):
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, nombre)
    with open(ruta, "wb") as f:
        f.write(base64.b64decode(texto_base64))
    return ruta


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("foto")
    parser.add_argument("--id", default="1")
    parser.add_argument("--paciente", default="10293847")
    parser.add_argument("--edad", default="45")
    parser.add_argument("--sexo", default="Male")
    parser.add_argument("--sitio", default="5")
    parser.add_argument("--salida", default=os.path.join(CARPETA, "salida_prueba"))
    args = parser.parse_args()

    salida = os.path.abspath(args.salida)
    mirth = os.path.join(salida, "MIRTH")
    pacs = os.path.join(salida, "PACS")
    entorno = {**os.environ, "PACS_DIR": pacs, "RIS_DB": os.path.join(salida, "ris.db")}
    fecha = datetime.now().strftime("%Y%m%d%H%M%S")

    # Canal MT (:8091/api/diagnostico): el JSON del formulario va como argumento
    formulario = {"id": args.id, "idPaciente": args.paciente, "edad": args.edad,
                  "sexo": args.sexo, "sitioAnatomico": args.sitio}
    metadatos = ejecutar("procesadoMT.py", json.dumps(formulario), entorno)
    ruta_mt = os.path.join(mirth, "JSON-POST", f"{args.id}-{fecha}.json")
    os.makedirs(os.path.dirname(ruta_mt), exist_ok=True)
    with open(ruta_mt, "w", encoding="utf-8") as f:
        json.dump(metadatos, f, ensure_ascii=False)
    print(f"[MT]    {ruta_mt}")

    # Canal IMG (:8092/api/imagen) -> Channel Writer al canal RIS
    with open(args.foto, "rb") as f:
        peticion = {"id": args.id, "idPaciente": args.paciente,
                    "imagen": base64.b64encode(f.read()).decode("ascii")}
    imagenes = ejecutar("procesadoIMG.py",
                        escribir_json_temporal(os.path.join(mirth, "IMG-POST", "TEMP"), args.id, peticion), entorno)
    print(f"[IMG]   imagen procesada ({len(imagenes['imagenProcesada'])} caracteres en base64)")

    # Canal RIS: cita, IMG-POST y carpeta del PACS -> Channel Writer al canal DICOM
    cita = ejecutar("citaRIS.py",
                    escribir_json_temporal(os.path.join(mirth, "RIS", "TEMP1"), args.id, imagenes), entorno)
    ruta_img = guardar_binario(os.path.join(mirth, "IMG-POST"), f"{args.id}-{fecha}.jpg", cita["imagen"])
    os.makedirs(os.path.join(pacs, imagenes["idPaciente"], cita["citaKey"]), exist_ok=True)
    print(f"[RIS]   cita {cita['citaKey']} -> {ruta_img}")

    # Canal DICOM: DICOM + JPEG original y procesada en el PACS
    archivo = ejecutar("Dicomizador.py",
                       escribir_json_temporal(os.path.join(mirth, "RIS", "TEMP2"), args.id,
                                              {"Cita": cita, "Dicom": imagenes, "Id": args.id}), entorno)
    carpeta_pacs = os.path.join(pacs, archivo["idPaciente"], archivo["citaKey"])
    guardar_binario(carpeta_pacs, f"PROCESADA_{fecha}.jpg", archivo["imagenProcesada"])
    guardar_binario(carpeta_pacs, f"ORIGINAL_{fecha}.jpg", archivo["imagenOriginal"])
    print(f"[DICOM] {carpeta_pacs}")
    for nombre in sorted(os.listdir(carpeta_pacs)):
        print(f"          {nombre}")


if __name__ == "__main__":
    main()
