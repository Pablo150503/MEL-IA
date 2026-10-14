"""
Dicomizador.py - Canal DICOM de Mirth Connect
---------------------------------------------------------------------------------------------
Archiva la cita en el PACS: convierte la imagen original y la procesada a DICOM (Secondary
Capture, modalidad XC = fotografía con cámara externa, igual que el exportador de MEL-IA) y
las guarda en PACS/<idPaciente>/<citaKey>/. Las dos imágenes comparten estudio y van en
series distintas.

Lo lanza el canal DICOM:   python Dicomizador.py <ruta del JSON temporal>

Entrada (JSON que monta el canal RIS):
    {"Cita": <salida de citaRIS.py>, "Dicom": <salida de procesadoIMG.py>, "Id": "17"}

Salida (stdout, JSON):
    {"citaKey", "idPaciente", "imagenOriginal", "imagenProcesada", "dicom"}
    El canal guarda además las dos imágenes en JPEG en la misma carpeta del PACS
    (ORIGINAL_<fecha>.jpg y PROCESADA_<fecha>.jpg). "dicom" son las rutas de los .dcm.

Carpeta del PACS: variable de entorno PACS_DIR (por defecto la del servidor de Mirth).
---------------------------------------------------------------------------------------------
"""

import base64
import json
import os
import re
import sys
import warnings
from datetime import datetime

import cv2
import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, SecondaryCaptureImageStorage, generate_uid

warnings.filterwarnings("ignore")  # Mirth junta stderr con stdout: solo debe salir el JSON

PACS_DIR = os.environ.get("PACS_DIR", r"C:\Users\Administrador\Desktop\PACS")


def nombre_seguro(texto):
    return re.sub(r"[^A-Za-z0-9_-]", "_", str(texto)) or "SIN_ID"


def jpeg_a_rgb(texto_base64):
    datos = np.frombuffer(base64.b64decode(texto_base64), np.uint8)
    imagen = cv2.imdecode(datos, cv2.IMREAD_COLOR)
    if imagen is None:
        raise ValueError("No se ha podido decodificar la imagen")
    return cv2.cvtColor(imagen, cv2.COLOR_BGR2RGB)


def crear_dicom(rgb, ruta, id_paciente, cita, study_uid, serie, descripcion):
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian

    ds = FileDataset(ruta, {}, file_meta=meta, preamble=b"\0" * 128)
    ahora = datetime.now()

    # Paciente
    ds.PatientName = "ANONIMO"
    ds.PatientID = id_paciente

    # Estudio = la cita del RIS
    ds.StudyInstanceUID = study_uid
    ds.StudyDate = ds.ContentDate = ahora.strftime("%Y%m%d")
    ds.StudyTime = ds.ContentTime = ahora.strftime("%H%M%S")
    # AccessionNumber y StudyID admiten 16 caracteres: fecha de la cita AAAAMMDDhhmmss
    ds.AccessionNumber = ds.StudyID = re.sub(r"\D", "", cita.get("fecha", ""))[:16] or ahora.strftime("%Y%m%d%H%M%S")
    ds.StudyDescription = f"Cita RIS {cita['citaKey']}"[:64]

    # Serie e instancia
    ds.Modality = "XC"
    ds.SeriesInstanceUID = generate_uid()
    ds.SeriesNumber = serie
    ds.SeriesDescription = descripcion
    ds.InstanceNumber = 1
    ds.SOPClassUID = meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    ds.ConversionType = "DI"  # Imagen digitalizada (foto de la lesión)

    # Píxeles en color
    ds.Rows, ds.Columns = rgb.shape[:2]
    ds.SamplesPerPixel = 3
    ds.PhotometricInterpretation = "RGB"
    ds.PlanarConfiguration = 0
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.PixelData = np.ascontiguousarray(rgb).tobytes()

    pydicom.dcmwrite(ruta, ds, enforce_file_format=True)


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        msg = json.load(f)

    cita = msg["Cita"]
    imagenes = msg["Dicom"]
    id_paciente = str(cita.get("idPaciente") or imagenes.get("idPaciente") or msg.get("Id"))

    carpeta = os.path.join(PACS_DIR, nombre_seguro(id_paciente), nombre_seguro(cita["citaKey"]))
    os.makedirs(carpeta, exist_ok=True)

    study_uid = generate_uid()
    rutas = []
    for serie, (clave, descripcion) in enumerate(
        [("imagenOriginal", "ORIGINAL"), ("imagenProcesada", "PROCESADA")], start=1
    ):
        ruta = os.path.join(carpeta, f"{descripcion}.dcm")
        crear_dicom(jpeg_a_rgb(imagenes[clave]), ruta, id_paciente, cita, study_uid, serie, descripcion)
        rutas.append(ruta)

    print(json.dumps({
        "citaKey": cita["citaKey"],
        "idPaciente": id_paciente,
        "imagenOriginal": imagenes["imagenOriginal"],
        "imagenProcesada": imagenes["imagenProcesada"],
        "dicom": rutas,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": f"Dicomizador: {e}"}))
        sys.exit(1)
