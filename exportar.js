/*
---------------------------------------------------------------------------------------------
Exportación de resultados de MEL-IA
---------------------------------------------------------------------------------------------
Genera el informe del último diagnóstico en HL7 v2.5 (ORU^R01), DICOM (Secondary Capture,
Explicit VR Little Endian), PDF (jsPDF), JSON y XML. El archivo se descarga; en iOS se abre
el menú de compartir (Guardar en Archivos, Mail...), porque las descargas desde una app
instalada en la pantalla de inicio no funcionan bien allí.
---------------------------------------------------------------------------------------------
*/

var resultadoExportar = null; // Datos del último diagnóstico, se rellenan en prepararExportacion()

const PRECISION_MODELO = 88;       // Igual que el texto "Accuracy of the model" de los resultados
const MAX_LADO_IMAGEN = 1024;      // px: las fotos del móvil se reducen para DICOM/PDF/HL7
const UID_IMPLEMENTACION_DICOM = "2.25.151465506173029910815581177905818549581";
const SOP_CLASS_SECONDARY_CAPTURE = "1.2.840.10008.5.1.4.1.1.7";
const TRANSFER_SYNTAX_EXPLICIT_LE = "1.2.840.10008.1.2.1";

const CODIGOS_CLASE = {
  "Nevus": "NEV",
  "Melanocytic Nevus": "NEV",
  "Melanoma": "MEL",
  "Basal Cell Carcinoma": "BCC",
  "Actinic Keratosis": "AK",
  "Squamous Cell Carcinoma": "SCC"
};

/**
 * Se llama al mostrar los resultados. Reúne los datos del diagnóstico y prepara la imagen
 * (JPEG y píxeles RGB) para que luego cada exportación sea inmediata al pulsar el icono.
 */
function prepararExportacion(categorias) {
  const ahora = new Date();
  const principal = [...categorias].sort((a, b) => b.percentage - a.percentage)[0];
  const sitio = document.getElementById("textoSitio").textContent.trim();

  const resultado = {
    id: `MELIA-${fechaCompacta(ahora)}-${Math.floor(1000 + Math.random() * 9000)}`,
    fecha: ahora,
    paciente: datosPacienteExportar(),
    medico: datosMedicoExportar(),
    sitioAnatomico: sitio && sitio !== "None" ? sitio : "Not specified",
    clases: categorias.map(c => ({ nombre: c.name, codigo: CODIGOS_CLASE[c.name] || "OTH", probabilidad: c.percentage, color: c.color })),
    diagnosticoIA: principal.name,
    probabilidadIA: principal.percentage,
    precisionModelo: PRECISION_MODELO,
    imagen: null,
    logo: null,
    preparado: false
  };

  const imagenPrevia = document.querySelector("#vistaPrevia img");
  resultado.listo = Promise.all([
    cargarImagenExportar(imagenPrevia ? imagenPrevia.src : "", MAX_LADO_IMAGEN, "image/jpeg").then(img => { resultado.imagen = img; }),
    cargarImagenExportar("logo.png", 600, "image/png").then(img => { resultado.logo = img; })
  ]).then(() => { resultado.preparado = true; });

  resultadoExportar = resultado;
}

function datosPacienteExportar() {
  // Paciente nuevo (formulario) o paciente abierto desde el seguimiento
  const p = (pacienteActual && pacienteActual.nombre)
    ? { Nombre: pacienteActual.nombre, Apellidos: pacienteActual.apellidos, Edad: pacienteActual.edad, Sexo: pacienteActual.sexo, SIP: pacienteActual.sip }
    : (pacienteDetalle || {});
  const sexo = p.Sexo === "Masculino" ? "Male" : (p.Sexo === "Femenino" ? "Female" : (p.Sexo || ""));
  return {
    nombre: p.Nombre || "",
    apellidos: p.Apellidos || "",
    edad: p.Edad !== undefined && p.Edad !== null && p.Edad !== "" ? Number(p.Edad) : null,
    sexo,
    sip: p.SIP || (pacienteActual && pacienteActual.SIP) || ""
  };
}

function datosMedicoExportar() {
  const m = medicoActual || {};
  return {
    nombre: m.Nombre || "",
    apellidos: m.Apellidos || "",
    especialidad: m.Especialidad === "At. Primaria" ? "Primary Care" : "Dermatology",
    usuario: m.DNI || ""
  };
}

/**
 * Dibuja la imagen en un canvas (reducida a ladoMaximo) y devuelve la versión codificada
 * (data URL) y los píxeles RGB sin alfa, que son los que se guardan en el DICOM.
 */
function cargarImagenExportar(src, ladoMaximo, formato) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
      const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
      const alto = Math.max(1, Math.round(img.naturalHeight * escala));
      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (formato === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ancho, alto);
      }
      ctx.drawImage(img, 0, 0, ancho, alto);

      const dataUrl = canvas.toDataURL(formato, 0.9);
      const rgba = ctx.getImageData(0, 0, ancho, alto).data;
      const rgb = new Uint8Array(ancho * alto * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4) {
        rgb[j++] = rgba[i];
        rgb[j++] = rgba[i + 1];
        rgb[j++] = rgba[i + 2];
      }
      resolve({ dataUrl, base64: dataUrl.split(",")[1], ancho, alto, rgb });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ------------------------------------------------------------------------------------------
// Botones de exportación (los usa generarCirculos en script.js)
// ------------------------------------------------------------------------------------------

function exportHL7() { exportar("HL7", generarHL7, "hl7", "text/plain"); }
function exportDICOM() { exportar("DICOM", generarDICOM, "dcm", "application/dicom"); }
function exportPDF() { exportar("PDF", generarPDF, "pdf", "application/pdf"); }
function exportJSON() { exportar("JSON", generarJSON, "json", "application/json"); }
function exportXML() { exportar("XML", generarXML, "xml", "application/xml"); }

function exportar(formato, generar, extension, tipo) {
  const resultado = resultadoExportar;
  if (!resultado) return;

  const hacer = () => {
    try {
      const contenido = generar(resultado);
      if (!contenido) return;
      guardarArchivo(contenido, nombreArchivo(resultado, extension), tipo);
      mostrarAvisoExportacion(`${formato} report exported`);
    } catch (error) {
      console.error(`Error al exportar ${formato}:`, error);
      mostrarAvisoExportacion(`Could not export ${formato}`);
    }
  };

  // Normalmente ya está preparado; si no, se espera a que termine de procesar la imagen
  if (resultado.preparado) hacer();
  else resultado.listo.then(hacer);
}

function nombreArchivo(resultado, extension) {
  const sip = (resultado.paciente.sip || "patient").replace(/[^\w-]/g, "");
  return `MEL-IA_${sip}_${fechaCompacta(resultado.fecha).slice(0, 8)}-${fechaCompacta(resultado.fecha).slice(8)}.${extension}`;
}

function esIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) ||
    (!/Android/.test(ua) && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function guardarArchivo(contenido, nombre, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });

  if (esIOS() && navigator.canShare) {
    const archivo = new File([blob], nombre, { type: tipo });
    if (navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: nombre }).catch(() => {});
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function mostrarAvisoExportacion(texto) {
  let aviso = document.getElementById("avisoExportacion");
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.id = "avisoExportacion";
    aviso.className = "aviso-exportacion";
    document.body.appendChild(aviso);
  }
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(aviso.temporizador);
  aviso.temporizador = setTimeout(() => aviso.classList.remove("visible"), 2200);
}

// ------------------------------------------------------------------------------------------
// Utilidades de formato
// ------------------------------------------------------------------------------------------

function dosCifras(n) {
  return String(n).padStart(2, "0");
}

// AAAAMMDDhhmmss (HL7 y nombres de archivo)
function fechaCompacta(fecha) {
  return `${fecha.getFullYear()}${dosCifras(fecha.getMonth() + 1)}${dosCifras(fecha.getDate())}` +
    `${dosCifras(fecha.getHours())}${dosCifras(fecha.getMinutes())}${dosCifras(fecha.getSeconds())}`;
}

function fechaLegible(fecha) {
  return `${dosCifras(fecha.getDate())}/${dosCifras(fecha.getMonth() + 1)}/${fecha.getFullYear()} ` +
    `${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`;
}

function nombreCompleto(persona) {
  return `${persona.nombre} ${persona.apellidos}`.trim();
}

// ------------------------------------------------------------------------------------------
// JSON
// ------------------------------------------------------------------------------------------

function datosInforme(r) {
  return {
    reportId: r.id,
    generatedAt: r.fecha.toISOString(),
    application: "MEL-IA",
    patient: {
      name: r.paciente.nombre,
      surnames: r.paciente.apellidos,
      age: r.paciente.edad,
      sex: r.paciente.sexo,
      sip: r.paciente.sip
    },
    physician: {
      name: r.medico.nombre,
      surnames: r.medico.apellidos,
      specialty: r.medico.especialidad,
      user: r.medico.usuario
    },
    lesion: {
      anatomicalSite: r.sitioAnatomico
    },
    aiAnalysis: {
      diagnosis: r.diagnosticoIA,
      probability: r.probabilidadIA,
      modelAccuracy: r.precisionModelo,
      unit: "%",
      classes: r.clases.map(c => ({ class: c.nombre, code: c.codigo, probability: c.probabilidad }))
    }
  };
}

function generarJSON(r) {
  const datos = datosInforme(r);
  datos.image = r.imagen
    ? { mediaType: "image/jpeg", width: r.imagen.ancho, height: r.imagen.alto, encoding: "base64", data: r.imagen.base64 }
    : null;
  return JSON.stringify(datos, null, 2);
}

// ------------------------------------------------------------------------------------------
// XML
// ------------------------------------------------------------------------------------------

function xmlEscapar(texto) {
  return String(texto === null || texto === undefined ? "" : texto)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function generarXML(r) {
  const d = datosInforme(r);
  const lineas = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<DermatologyReport id="${xmlEscapar(d.reportId)}" generatedAt="${xmlEscapar(d.generatedAt)}" application="MEL-IA">`,
    "  <Patient>",
    `    <Name>${xmlEscapar(d.patient.name)}</Name>`,
    `    <Surnames>${xmlEscapar(d.patient.surnames)}</Surnames>`,
    `    <Age unit="years">${xmlEscapar(d.patient.age)}</Age>`,
    `    <Sex>${xmlEscapar(d.patient.sex)}</Sex>`,
    `    <SIP>${xmlEscapar(d.patient.sip)}</SIP>`,
    "  </Patient>",
    "  <Physician>",
    `    <Name>${xmlEscapar(d.physician.name)}</Name>`,
    `    <Surnames>${xmlEscapar(d.physician.surnames)}</Surnames>`,
    `    <Specialty>${xmlEscapar(d.physician.specialty)}</Specialty>`,
    `    <User>${xmlEscapar(d.physician.user)}</User>`,
    "  </Physician>",
    "  <Lesion>",
    `    <AnatomicalSite>${xmlEscapar(d.lesion.anatomicalSite)}</AnatomicalSite>`,
    "  </Lesion>",
    `  <AIAnalysis modelAccuracy="${d.aiAnalysis.modelAccuracy}" unit="%">`,
    `    <Diagnosis probability="${d.aiAnalysis.probability.toFixed(1)}">${xmlEscapar(d.aiAnalysis.diagnosis)}</Diagnosis>`,
    "    <Classes>",
    ...d.aiAnalysis.classes.map(c =>
      `      <Class code="${xmlEscapar(c.code)}" probability="${c.probability.toFixed(1)}">${xmlEscapar(c.class)}</Class>`),
    "    </Classes>",
    "  </AIAnalysis>"
  ];
  if (r.imagen) {
    lineas.push(`  <Image mediaType="image/jpeg" width="${r.imagen.ancho}" height="${r.imagen.alto}" encoding="base64">${r.imagen.base64}</Image>`);
  }
  lineas.push("</DermatologyReport>", "");
  return lineas.join("\n");
}

// ------------------------------------------------------------------------------------------
// HL7 v2.5 - ORU^R01 (resultado de observación)
// ------------------------------------------------------------------------------------------

function hl7Escapar(texto) {
  return String(texto === null || texto === undefined ? "" : texto)
    .replace(/\\/g, "\\E\\").replace(/\|/g, "\\F\\").replace(/\^/g, "\\S\\")
    .replace(/~/g, "\\R\\").replace(/&/g, "\\T\\").replace(/[\r\n]+/g, " ");
}

// Une los campos de un segmento: campos[1] es el campo 1
function hl7Segmento(nombre, campos) {
  return [nombre, ...campos.slice(1)].join("|");
}

function generarHL7(r) {
  const hora = fechaCompacta(r.fecha);
  const sexo = r.paciente.sexo === "Male" ? "M" : (r.paciente.sexo === "Female" ? "F" : "U");
  const segmentos = [];

  const idMensaje = r.id.replace(/\D/g, "").slice(-20); // MSH-10 admite 20 caracteres
  segmentos.push(`MSH|^~\\&|MEL-IA|MEL-IA|HIS|HOSPITAL|${hora}||ORU^R01^ORU_R01|${idMensaje}|P|2.5|||AL|NE|ESP|UNICODE UTF-8`);

  const pid = [];
  pid[1] = "1";
  pid[3] = `${hl7Escapar(r.paciente.sip)}^^^SIP^PI`;
  pid[5] = `${hl7Escapar(r.paciente.apellidos)}^${hl7Escapar(r.paciente.nombre)}`;
  pid[8] = sexo;
  segmentos.push(hl7Segmento("PID", pid));

  segmentos.push("PV1|1|O");

  const obr = [];
  obr[1] = "1";
  obr[2] = hl7Escapar(r.id);
  obr[3] = hl7Escapar(r.id);
  obr[4] = "MELIA^Skin lesion AI analysis^L";
  obr[7] = hora;
  obr[16] = `${hl7Escapar(r.medico.usuario)}^${hl7Escapar(r.medico.apellidos)}^${hl7Escapar(r.medico.nombre)}`;
  obr[22] = hora;
  obr[25] = "F";
  segmentos.push(hl7Segmento("OBR", obr));

  // Observaciones: datos clínicos, resultado de la IA, probabilidad de cada clase e imagen
  const observaciones = [];
  if (r.paciente.edad !== null) {
    observaciones.push(["NM", "AGE^Patient age^L", r.paciente.edad, "a^year^UCUM"]);
  }
  observaciones.push(["ST", "SITE^Anatomical site^L", hl7Escapar(r.sitioAnatomico), ""]);
  observaciones.push(["ST", "AIDX^AI diagnosis^L", hl7Escapar(r.diagnosticoIA), ""]);
  r.clases.forEach(c => {
    observaciones.push(["NM", `PROB-${c.codigo}^${hl7Escapar(c.nombre)} probability^L`, c.probabilidad.toFixed(1), "%^percent^UCUM"]);
  });
  observaciones.push(["NM", "ACC^Model accuracy^L", r.precisionModelo, "%^percent^UCUM"]);
  if (r.imagen) {
    observaciones.push(["ED", "IMG^Lesion image^L", `MEL-IA^IM^JPEG^Base64^${r.imagen.base64}`, ""]);
  }

  observaciones.forEach(([tipo, identificador, valor, unidades], i) => {
    const obx = [];
    obx[1] = String(i + 1);
    obx[2] = tipo;
    obx[3] = identificador;
    obx[5] = valor;
    obx[6] = unidades;
    obx[11] = "F";
    obx[14] = hora;
    segmentos.push(hl7Segmento("OBX", obx));
  });

  return segmentos.join("\r") + "\r";
}

// ------------------------------------------------------------------------------------------
// DICOM - Secondary Capture con la foto en RGB sin comprimir
// ------------------------------------------------------------------------------------------

const VR_LONGITUD_LARGA = ["OB", "OW", "OF", "SQ", "UT", "UN", "UC", "UR"];

function dicomElemento(grupo, elemento, vr, valor) {
  let datos;
  if (valor instanceof Uint8Array) {
    datos = valor;
  } else if (vr === "US") {
    datos = new Uint8Array(2);
    new DataView(datos.buffer).setUint16(0, valor, true);
  } else if (vr === "UL") {
    datos = new Uint8Array(4);
    new DataView(datos.buffer).setUint32(0, valor, true);
  } else {
    datos = new TextEncoder().encode(valor === null || valor === undefined ? "" : String(valor));
  }

  // Los valores deben tener longitud par: UI y OB se rellenan con 0, el texto con espacio
  if (datos.length % 2) {
    const relleno = new Uint8Array(datos.length + 1);
    relleno.set(datos);
    relleno[datos.length] = (vr === "UI" || vr === "OB") ? 0x00 : 0x20;
    datos = relleno;
  }

  const largo = VR_LONGITUD_LARGA.includes(vr);
  const cabecera = new Uint8Array(largo ? 12 : 8);
  const vista = new DataView(cabecera.buffer);
  vista.setUint16(0, grupo, true);
  vista.setUint16(2, elemento, true);
  cabecera[4] = vr.charCodeAt(0);
  cabecera[5] = vr.charCodeAt(1);
  if (largo) {
    vista.setUint32(8, datos.length, true);
  } else {
    vista.setUint16(6, datos.length, true);
  }
  return unirBytes([cabecera, datos]);
}

function unirBytes(partes) {
  const total = partes.reduce((suma, p) => suma + p.length, 0);
  const resultado = new Uint8Array(total);
  let posicion = 0;
  partes.forEach(p => {
    resultado.set(p, posicion);
    posicion += p.length;
  });
  return resultado;
}

function uidAleatorio() {
  // UID derivado de un UUID (raíz 2.25), como recomienda DICOM PS3.5 B.2
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let numero = BigInt(0);
  bytes.forEach(b => { numero = (numero << BigInt(8)) | BigInt(b); });
  return "2.25." + numero.toString();
}

function generarDICOM(r) {
  if (!r.imagen) {
    mostrarAvisoExportacion("No image available for DICOM");
    return null;
  }
  const fecha = fechaCompacta(r.fecha);
  const sopInstancia = uidAleatorio();
  const edad = r.paciente.edad !== null && r.paciente.edad >= 0 && r.paciente.edad < 1000
    ? `${String(Math.round(r.paciente.edad)).padStart(3, "0")}Y` : "";
  const sexo = r.paciente.sexo === "Male" ? "M" : (r.paciente.sexo === "Female" ? "F" : "O");
  const probabilidades = r.clases.map(c => `${c.nombre} ${c.probabilidad.toFixed(1)}%`).join(", ");

  const meta = [
    dicomElemento(0x0002, 0x0001, "OB", new Uint8Array([0x00, 0x01])),
    dicomElemento(0x0002, 0x0002, "UI", SOP_CLASS_SECONDARY_CAPTURE),
    dicomElemento(0x0002, 0x0003, "UI", sopInstancia),
    dicomElemento(0x0002, 0x0010, "UI", TRANSFER_SYNTAX_EXPLICIT_LE),
    dicomElemento(0x0002, 0x0012, "UI", UID_IMPLEMENTACION_DICOM),
    dicomElemento(0x0002, 0x0013, "SH", "MELIA_1_0")
  ];
  const longitudMeta = meta.reduce((suma, e) => suma + e.length, 0);

  // Los elementos tienen que ir en orden creciente de etiqueta
  const conjunto = [
    dicomElemento(0x0008, 0x0005, "CS", "ISO_IR 192"),
    dicomElemento(0x0008, 0x0016, "UI", SOP_CLASS_SECONDARY_CAPTURE),
    dicomElemento(0x0008, 0x0018, "UI", sopInstancia),
    dicomElemento(0x0008, 0x0020, "DA", fecha.slice(0, 8)),
    dicomElemento(0x0008, 0x0023, "DA", fecha.slice(0, 8)),
    dicomElemento(0x0008, 0x0030, "TM", fecha.slice(8)),
    dicomElemento(0x0008, 0x0033, "TM", fecha.slice(8)),
    dicomElemento(0x0008, 0x0050, "SH", ""),
    dicomElemento(0x0008, 0x0060, "CS", "XC"),
    dicomElemento(0x0008, 0x0064, "CS", "WSD"),
    dicomElemento(0x0008, 0x0070, "LO", "MEL-IA"),
    dicomElemento(0x0008, 0x0090, "PN", `${r.medico.apellidos}^${r.medico.nombre}`),
    dicomElemento(0x0008, 0x1030, "LO", "Dermatology - AI skin lesion analysis"),
    dicomElemento(0x0010, 0x0010, "PN", `${r.paciente.apellidos}^${r.paciente.nombre}`),
    dicomElemento(0x0010, 0x0020, "LO", r.paciente.sip),
    dicomElemento(0x0010, 0x0030, "DA", ""),
    dicomElemento(0x0010, 0x0040, "CS", sexo),
    dicomElemento(0x0010, 0x1010, "AS", edad),
    dicomElemento(0x0020, 0x000D, "UI", uidAleatorio()),
    dicomElemento(0x0020, 0x000E, "UI", uidAleatorio()),
    dicomElemento(0x0020, 0x0010, "SH", r.id.slice(-16)),
    dicomElemento(0x0020, 0x0011, "IS", "1"),
    dicomElemento(0x0020, 0x0013, "IS", "1"),
    dicomElemento(0x0020, 0x0020, "CS", ""),
    dicomElemento(0x0020, 0x4000, "LT",
      `AI diagnosis: ${r.diagnosticoIA} (${r.probabilidadIA.toFixed(1)}%). Anatomical site: ${r.sitioAnatomico}. ` +
      `Model accuracy: ${r.precisionModelo}%. Probabilities: ${probabilidades}. Report ${r.id}.`),
    dicomElemento(0x0028, 0x0002, "US", 3),
    dicomElemento(0x0028, 0x0004, "CS", "RGB"),
    dicomElemento(0x0028, 0x0006, "US", 0),
    dicomElemento(0x0028, 0x0010, "US", r.imagen.alto),
    dicomElemento(0x0028, 0x0011, "US", r.imagen.ancho),
    dicomElemento(0x0028, 0x0100, "US", 8),
    dicomElemento(0x0028, 0x0101, "US", 8),
    dicomElemento(0x0028, 0x0102, "US", 7),
    dicomElemento(0x0028, 0x0103, "US", 0),
    dicomElemento(0x7FE0, 0x0010, "OB", r.imagen.rgb)
  ];

  const preambulo = new Uint8Array(132);
  preambulo.set([0x44, 0x49, 0x43, 0x4D], 128); // "DICM"

  return new Blob([unirBytes([
    preambulo,
    dicomElemento(0x0002, 0x0000, "UL", longitudMeta),
    ...meta,
    ...conjunto
  ])], { type: "application/dicom" });
}

// ------------------------------------------------------------------------------------------
// PDF
// ------------------------------------------------------------------------------------------

function hexARgb(hex) {
  const valor = parseInt(hex.replace("#", ""), 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}

function generarPDF(r) {
  if (!window.jspdf) {
    mostrarAvisoExportacion("PDF library not available");
    return null;
  }
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const azul = [19, 125, 197];
  const azulOscuro = [0, 64, 106];
  const gris = [95, 99, 104];
  const margen = 15;
  const derecha = 195;

  // Cabecera
  if (r.logo) {
    doc.addImage(r.logo.dataUrl, "PNG", margen, 12, 48, 48 * r.logo.alto / r.logo.ancho);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...azulOscuro);
  doc.text("Skin Lesion AI Report", derecha, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gris);
  doc.text(`Report ID: ${r.id}`, derecha, 23, { align: "right" });
  doc.text(`Date: ${fechaLegible(r.fecha)}`, derecha, 28, { align: "right" });
  doc.setDrawColor(...azul);
  doc.setLineWidth(0.8);
  doc.line(margen, 33, derecha, 33);

  // Datos del paciente y del médico en dos columnas
  function bloque(titulo, filas, x, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...azul);
    doc.text(titulo, x, y);
    doc.setFontSize(10);
    filas.forEach(([etiqueta, valor], i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...azulOscuro);
      doc.text(`${etiqueta}:`, x, y + 7 + i * 6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(String(valor === null || valor === "" ? "-" : valor), x + 24, y + 7 + i * 6);
    });
  }
  bloque("Patient", [
    ["Name", nombreCompleto(r.paciente)],
    ["Age", r.paciente.edad !== null ? `${r.paciente.edad} years` : ""],
    ["Sex", r.paciente.sexo],
    ["SIP", r.paciente.sip]
  ], margen, 42);
  bloque("Physician", [
    ["Name", nombreCompleto(r.medico)],
    ["Specialty", r.medico.especialidad],
    ["User", r.medico.usuario]
  ], 110, 42);

  // Imagen de la lesión y resultado principal
  let y = 74;
  let altoImagen = 0;
  if (r.imagen) {
    const anchoImagen = 85;
    altoImagen = Math.min(70, anchoImagen * r.imagen.alto / r.imagen.ancho);
    const anchoFinal = altoImagen * r.imagen.ancho / r.imagen.alto;
    doc.addImage(r.imagen.dataUrl, "JPEG", margen, y, anchoFinal, altoImagen);
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.4);
    doc.rect(margen, y, anchoFinal, altoImagen);
  }
  const xResultado = 110;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...gris);
  doc.text("AI diagnosis", xResultado, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...azul);
  doc.text(r.diagnosticoIA, xResultado, y + 17);
  doc.setFontSize(12);
  doc.setTextColor(...azulOscuro);
  doc.text(`Probability: ${r.probabilidadIA.toFixed(1)} %`, xResultado, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`Anatomical site: ${r.sitioAnatomico}`, xResultado, y + 36);
  doc.text(`Model accuracy: ${r.precisionModelo} %`, xResultado, y + 42);

  // Probabilidad de cada clase con barra
  y += Math.max(altoImagen, 48) + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...azul);
  doc.text("Class probabilities", margen, y);
  y += 8;
  const xBarra = 75;
  const anchoBarra = 100;
  r.clases.forEach(c => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(c.nombre, margen, y);
    doc.setFillColor(227, 242, 253);
    doc.roundedRect(xBarra, y - 3.5, anchoBarra, 4.5, 1.5, 1.5, "F");
    doc.setFillColor(...hexARgb(c.color));
    doc.roundedRect(xBarra, y - 3.5, Math.max(1.5, anchoBarra * c.probabilidad / 100), 4.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${c.probabilidad.toFixed(1)} %`, derecha, y, { align: "right" });
    y += 9;
  });

  // Revisión del médico
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...azul);
  doc.text("Physician review", margen, y);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  for (let i = 1; i <= 3; i++) {
    doc.line(margen, y + i * 8, derecha, y + i * 8);
  }

  // Pie
  doc.setDrawColor(...azul);
  doc.setLineWidth(0.4);
  doc.line(margen, 276, derecha, 276);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gris);
  doc.text(doc.splitTextToSize(
    "This report was generated by the MEL-IA artificial intelligence decision-support system. " +
    "The result must be reviewed and confirmed by a qualified dermatologist.", derecha - margen), margen, 281);
  doc.text(`MEL-IA · ${r.id}`, derecha, 291, { align: "right" });

  return doc.output("blob");
}
