"""
procesadoMT.py - Canal MT de Mirth Connect
---------------------------------------------------------------------------------------------
Convierte los metadatos del formulario (edad, sexo y sitio anatómico) a la codificación con
la que se entrenó el modelo multimodal (ProcesamientoMT.py sobre ISIC 2019).

Lo lanza el canal MT:   python procesadoMT.py <JSON del formulario>
(Mirth pasa el JSON como argumento, no como fichero. Al pasar por "cmd /c" Windows puede
quitarle las comillas, por eso también se acepta {id:17,edad:45,sexo:Male,...}.)

Entrada (JSON que la app envía a :8091/api/diagnostico):
    {"id": "17", "idPaciente": "10293847", "edad": 45, "sexo": "Male", "sitioAnatomico": "5"}

Salida (stdout, JSON). Mirth la guarda en MIRTH/JSON-POST/<id>-<fecha>.json:
    {"id", "idPaciente", "edad", "sexo", "sitioAnatomico",
     "age_approx", "sex_num", "anatom_site_code", "imputados"}
---------------------------------------------------------------------------------------------
"""

import json
import os
import sys

# Codificación del entrenamiento: LabelEncoder ordena las clases alfabéticamente
SITIOS_ISIC = [
    "anterior torso", "head/neck", "lateral torso", "lower extremity",
    "oral/genital", "palms/soles", "posterior torso", "upper extremity",
]
SEXOS_ISIC = ["female", "male"]

# Orden del desplegable de la app (value 0-7 del <select id="parteCuerpo">)
SITIOS_APP = [
    "anterior torso", "upper extremity", "posterior torso", "lower extremity",
    "lateral torso", "head/neck", "palms/soles", "oral/genital",
]

SEXOS = {
    "male": "male", "m": "male", "masculino": "male", "hombre": "male", "1": "male",
    "female": "female", "f": "female", "femenino": "female", "mujer": "female", "0": "female",
}

# Valores para imputar un dato que falte: mediana de la edad y moda del sexo y del sitio
# en el conjunto de entrenamiento procesado (datos_procesados.csv, 21452 imágenes)
EDAD_POR_DEFECTO = 55
SEXO_POR_DEFECTO = "male"
SITIO_POR_DEFECTO = "anterior torso"


def leer_entrada(argumento):
    if os.path.isfile(argumento):
        with open(argumento, encoding="utf-8") as f:
            return json.load(f)
    try:
        return json.loads(argumento)
    except json.JSONDecodeError:
        # JSON sin comillas: {id:17,edad:45,sexo:Male,sitioAnatomico:5}
        datos = {}
        for par in argumento.strip().strip("{}").split(","):
            if ":" in par:
                clave, valor = par.split(":", 1)
                datos[clave.strip().strip("'\"")] = valor.strip().strip("'\"")
        return datos


def normalizar_edad(valor):
    try:
        edad = float(valor)
    except (TypeError, ValueError):
        return None
    if not 0 <= edad <= 120:
        return None
    return int(edad) if edad.is_integer() else edad


def normalizar_sexo(valor):
    return SEXOS.get(str(valor).strip().lower()) if valor is not None else None


def normalizar_sitio(valor):
    if valor is None:
        return None
    texto = str(valor).strip().lower().replace("_", " ")
    if texto.isdigit() and int(texto) < len(SITIOS_APP):
        return SITIOS_APP[int(texto)]
    return texto if texto in SITIOS_ISIC else None


def main():
    msg = leer_entrada(sys.argv[1])
    imputados = []

    edad = normalizar_edad(msg.get("edad"))
    if edad is None:
        edad = EDAD_POR_DEFECTO
        imputados.append("edad")
    sexo = normalizar_sexo(msg.get("sexo"))
    if sexo is None:
        sexo = SEXO_POR_DEFECTO
        imputados.append("sexo")
    sitio = normalizar_sitio(msg.get("sitioAnatomico"))
    if sitio is None:
        sitio = SITIO_POR_DEFECTO
        imputados.append("sitioAnatomico")

    print(json.dumps({
        "id": str(msg.get("id", "")),
        "idPaciente": str(msg.get("idPaciente") or msg.get("sip") or ""),
        "edad": edad,
        "sexo": sexo,
        "sitioAnatomico": sitio,
        # Variables tal y como las recibe el modelo (age_approx va de 5 en 5 en ISIC)
        "age_approx": int(5 * round(edad / 5)),
        "sex_num": SEXOS_ISIC.index(sexo),
        "anatom_site_code": SITIOS_ISIC.index(sitio),
        "imputados": imputados,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": f"procesadoMT: {e}"}))
        sys.exit(1)
