# MEL-IA

Teledermatología asistida por inteligencia artificial. Es la app del médico del TFG
(Ingeniería Biomédica, Universidad de Alicante): gestiona pacientes y lesiones, hace una foto
de la lesión, marca el sitio anatómico sobre un modelo 3D del cuerpo, muestra la predicción
de la IA y exporta el informe en DICOM, HL7, PDF, JSON y XML.

Es una PWA estática (HTML + CSS + JS, sin compilación) que se puede instalar en el móvil y
funciona sin conexión.

## Estructura

```
MEL-IA/
├── index.html              Todas las pantallas de la app
├── manifest.webmanifest    Manifiesto de la PWA (nombre, iconos, colores)
├── sw.js                   Service worker: caché offline y actualizaciones
├── vercel.json             Cabeceras para el despliegue en Vercel
├── .vercelignore           Lo que no se publica en la web (mirth/, documentación)
│
├── css/
│   └── styles.css          Estilos de toda la app
├── js/
│   ├── script.js           Lógica de la app: login, pacientes, informes, modelo 3D, resultados
│   ├── rest.js             Librería REST/JSON (asignatura de Sistemas Distribuidos, UA)
│   ├── demo.js             Modo demo: simula el servidor con datos en memoria
│   ├── exportar.js         Exportación del informe a DICOM, HL7, PDF, JSON y XML
│   └── pwa.js              Instalación de la PWA y aviso de nueva versión
├── assets/
│   ├── logo.png            Logo que usa la app y los PDF exportados
│   ├── pablo.glb           Modelo 3D del cuerpo para elegir el sitio anatómico
│   ├── icons/              Iconos de la PWA y favicons
│   ├── casos/              Imágenes de los pacientes del modo demo (ISIC, ver CREDITOS.txt)
│   ├── animaciones/        Animaciones Lottie de la pantalla de análisis (ver CREDITOS.txt)
│   └── marca/              Logos originales en SVG/PNG de los que salen logo.png y los iconos
│
└── mirth/                  Circuito de integración con Mirth Connect (ver mirth/README.md)
    ├── canales/TFG.xml     Canales de Mirth (IMG, MT, RIS, DICOM, IA)
    ├── scripts/            Scripts de Python que ejecutan los canales
    └── probar_circuito.py  Ejecuta el circuito completo en local, sin Mirth
```

## Ejecutar en local

No hace falta instalar nada: basta con servir la carpeta.

```bash
python3 -m http.server 8000
```

Abrir <http://localhost:8000> y elegir **Demo Mode**. El modo real necesita el servidor de
DermaNet (Node.js + MySQL, `/api/...`), que no está en este repositorio.

## Despliegue

Cada push a `main` se publica automáticamente en Vercel. Si cambian los ficheros que se
guardan en caché, hay que subir `SW_VERSION` en `sw.js` para que las apps instaladas se
actualicen.

## Circuito de integración (Mirth Connect)

Los datos de la consulta (formulario + foto) entran en Mirth Connect, que los reparte entre
el preprocesado de la imagen, los metadatos para la IA, la cita del RIS y el archivo en el PACS:

```
App ──POST :8092/api/imagen──────► IMG ──► RIS ──► DICOM ──► PACS/<paciente>/<cita>/
App ──POST :8091/api/diagnostico─► MT  ──► JSON-POST/
                                   IA  (lee JSON-POST + IMG-POST, clasifica y devuelve el resultado)
```

Todo el detalle está en [mirth/README.md](mirth/README.md).
