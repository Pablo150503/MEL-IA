/*
---------------------------------------------------------------------------------------------
Modo DEMO de MEL-IA
---------------------------------------------------------------------------------------------
Simula el servidor (/api/...) con datos en memoria para que la app funcione sin conectarse
a nada. Se carga después de rest.js y sustituye window.rest por una versión que, si
modoDemo === true, responde con estos datos; si no, usa la librería REST real.
Los datos se pierden al recargar la página.
---------------------------------------------------------------------------------------------
*/

(function () {
	const restReal = window.rest;

	// Imagen de ejemplo de un nevus (SVG generado, sin conexión). Sin comillas simples para
	// que se pueda incrustar en los onclick='...' que genera script.js
	function imagenNevus(radioX, radioY, giro) {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
			<defs>
				<radialGradient id="piel" cx="50%" cy="45%" r="75%">
					<stop offset="0%" stop-color="#f3cfb3"/><stop offset="100%" stop-color="#d9a98a"/>
				</radialGradient>
				<radialGradient id="nevus" cx="45%" cy="45%" r="60%">
					<stop offset="0%" stop-color="#3b2416"/><stop offset="60%" stop-color="#5c3a24"/><stop offset="100%" stop-color="#8a5a3c"/>
				</radialGradient>
				<filter id="borde"><feGaussianBlur stdDeviation="4"/></filter>
			</defs>
			<rect width="400" height="400" fill="url(#piel)"/>
			<ellipse cx="200" cy="200" rx="${radioX}" ry="${radioY}" transform="rotate(${giro} 200 200)" fill="url(#nevus)" filter="url(#borde)"/>
		</svg>`;
		return "data:image/svg+xml," + encodeURIComponent(svg);
	}

	function haceDias(dias) {
		return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
	}

	// "Base de datos" en memoria con las mismas columnas que devuelve servidor.js
	const db = {
		medicos: [
			{ id: 1, Nombre: "Demo", Nombre2: "", Apellidos: "Doctor", DNI: "demo", Password: "demo", Especialidad: "Dermatología" }
		],
		pacientes: [
			{ Id: 1, Nombre: "Laura", Apellidos: "García López", Edad: 34, Sexo: "Femenino", SIP: "10293847", idMedico: 1 },
			{ Id: 2, Nombre: "Carlos", Apellidos: "Martínez Ruiz", Edad: 52, Sexo: "Masculino", SIP: "20394857", idMedico: 1 },
			{ Id: 3, Nombre: "Ana", Apellidos: "Pérez Soler", Edad: 41, Sexo: "Femenino", SIP: "30495867", idMedico: 1 }
		],
		informes: [
			{ id: 1, PacientesId: 1, LesionId: 1, Diagnostico: "Nevus", DiagnosticoIA: "Nevus", Fecha: haceDias(90), Imagen: imagenNevus(52, 44, 10), abierto: "Si" },
			{ id: 2, PacientesId: 1, LesionId: 1, Diagnostico: null, DiagnosticoIA: "Nevus", Fecha: haceDias(7), Imagen: imagenNevus(55, 46, 12), abierto: "Si" },
			{ id: 3, PacientesId: 1, LesionId: 2, Diagnostico: "Nevus", DiagnosticoIA: "Nevus", Fecha: haceDias(200), Imagen: imagenNevus(38, 36, 0), abierto: "No" },
			{ id: 4, PacientesId: 2, LesionId: 1, Diagnostico: null, DiagnosticoIA: "Nevus", Fecha: haceDias(3), Imagen: imagenNevus(60, 40, -20), abierto: "Si" },
			{ id: 5, PacientesId: 3, LesionId: 1, Diagnostico: "Nevus", DiagnosticoIA: "Nevus", Fecha: haceDias(30), Imagen: imagenNevus(45, 45, 0), abierto: "Si" }
		],
		notas: [
			{ id: 1, InformeId: 1, MedicoNota: 1, Nota: "Regular borders and homogeneous color. Follow-up in 3 months.", FechaNota: haceDias(90) }
		]
	};

	function siguienteId(lista, campo) {
		return lista.reduce((max, item) => Math.max(max, item[campo]), 0) + 1;
	}

	function pacientePorSip(sip) {
		return db.pacientes.find(p => p.SIP === sip);
	}

	// Cada ruta: [método, expresión regular de la ruta, función(params, datos, query) => [estado, respuesta]]
	const rutas = [
		["POST", /^\/api\/medico\/login$/, (p, datos) => {
			// En la demo vale cualquier usuario y contraseña
			const medico = db.medicos.find(m => m.DNI === datos.dni && m.Password === datos.password) || db.medicos[0];
			return [200, { idMedico: medico.id }];
		}],
		["GET", /^\/api\/medico\/(\d+)$/, (p) => {
			const medico = db.medicos.find(m => m.id === Number(p[1]));
			if (!medico) return [404, { error: "Médico no encontrado" }];
			const { Password, ...datosMedico } = medico;
			return [200, datosMedico];
		}],
		["POST", /^\/api\/medico\/registro$/, (p, datos) => {
			if (db.medicos.some(m => m.DNI === datos.dni)) return [409, { error: "El DNI ya está registrado" }];
			const id = siguienteId(db.medicos, "id");
			db.medicos.push({ id, Nombre: datos.nombre, Nombre2: datos.nombre2, Apellidos: datos.apellidos, DNI: datos.dni, Password: datos.password, Especialidad: datos.especialidad });
			return [201, { mensaje: "Registro exitoso", idMedico: id }];
		}],
		["POST", /^\/api\/pacientes$/, (p, datos) => {
			let paciente = pacientePorSip(datos.sip);
			if (!paciente) {
				paciente = { Id: siguienteId(db.pacientes, "Id") };
				db.pacientes.push(paciente);
			}
			Object.assign(paciente, { Nombre: datos.nombre, Apellidos: datos.apellidos, Edad: datos.edad, Sexo: datos.sexo, SIP: datos.sip, idMedico: datos.idMedico });
			return [201, { mensaje: "Paciente registrado correctamente", idPaciente: paciente.Id }];
		}],
		["GET", /^\/api\/pacientes$/, () => {
			// En la demo todos los médicos ven a los pacientes de ejemplo
			return [200, db.pacientes];
		}],
		["GET", /^\/api\/paciente\/(\d+)$/, (p) => {
			const paciente = db.pacientes.find(x => x.Id === Number(p[1]));
			if (!paciente) return [404, { error: "Paciente no encontrado" }];
			return [200, { paciente }];
		}],
		["DELETE", /^\/api\/pacientes\/sip\/([^/]+)$/, (p) => {
			const paciente = pacientePorSip(decodeURIComponent(p[1]));
			if (!paciente) return [404, { mensaje: "Paciente no encontrado" }];
			db.pacientes = db.pacientes.filter(x => x !== paciente);
			db.informes = db.informes.filter(i => i.PacientesId !== paciente.Id);
			return [200, { mensaje: "Paciente eliminado correctamente" }];
		}],
		["GET", /^\/api\/informes\/([^/]+)\/(\d+)$/, (p) => {
			const paciente = pacientePorSip(decodeURIComponent(p[1]));
			if (!paciente) return [404, { error: "Paciente no encontrado" }];
			const informes = db.informes
				.filter(i => i.PacientesId === paciente.Id && i.LesionId === Number(p[2]))
				.map(i => ({ ...i, ImagenURL: i.Imagen }));
			return [200, informes];
		}],
		["GET", /^\/api\/lesiones\/(\d+)$/, (p) => {
			const lesiones = [];
			db.informes.filter(i => i.PacientesId === Number(p[1])).forEach(i => {
				if (!lesiones.some(l => l.LesionId === i.LesionId)) {
					lesiones.push({ LesionId: i.LesionId, abierto: i.abierto });
				}
			});
			return [200, lesiones];
		}],
		["POST", /^\/api\/cerrar-caso\/([^/]+)\/(\d+)$/, (p) => {
			const paciente = pacientePorSip(decodeURIComponent(p[1]));
			if (!paciente) return [404, { error: "Paciente no encontrado" }];
			db.informes
				.filter(i => i.PacientesId === paciente.Id && i.LesionId === Number(p[2]))
				.forEach(i => { i.abierto = "No"; });
			return [200, { mensaje: "Caso cerrado correctamente" }];
		}],
		["GET", /^\/api\/notas\/(\d+)$/, (p) => {
			const notas = db.notas
				.filter(n => n.InformeId === Number(p[1]))
				.sort((a, b) => new Date(b.FechaNota) - new Date(a.FechaNota))
				.map(n => {
					const medico = db.medicos.find(m => m.id === n.MedicoNota) || {};
					return { id: n.id, Nota: n.Nota, FechaNota: n.FechaNota, Nombre: medico.Nombre, Apellidos: medico.Apellidos };
				});
			return [200, notas];
		}],
		["POST", /^\/api\/notas$/, (p, datos) => {
			const id = siguienteId(db.notas, "id");
			db.notas.push({ id, InformeId: Number(datos.InformeId), MedicoNota: datos.medicoId, Nota: datos.nota, FechaNota: new Date().toISOString() });
			return [201, { mensaje: "Nota guardada correctamente", idNota: id }];
		}],
		["POST", /^\/api\/diagnostico$/, (p, datos) => {
			const informe = db.informes.find(i => i.id === Number(datos.informeId));
			if (!informe) return [404, { error: "Informe no encontrado" }];
			informe.Diagnostico = datos.diagnostico;
			return [200, { mensaje: "Diagnóstico actualizado correctamente" }];
		}]
	];

	function restDemo(method, url, data, callback) {
		method = method.toUpperCase();
		if (typeof data === "function") {
			callback = data;
			data = null;
		}

		const ruta = url.split("?")[0];
		let resultado = [404, { error: "Ruta no disponible en modo demo" }];
		for (const [metodo, patron, manejador] of rutas) {
			const params = ruta.match(patron);
			if (metodo === method && params) {
				resultado = manejador(params, data || {});
				break;
			}
		}

		// Copia para que la app no modifique la "base de datos" directamente
		const status = resultado[0];
		const response = JSON.parse(JSON.stringify(resultado[1]));

		if (typeof callback !== "function") {
			return { status, response };
		}
		setTimeout(() => callback(status, response), 200); // Simula el tiempo de respuesta del servidor
	}

	/**
	 * Guarda el informe de un nuevo diagnóstico hecho en modo demo (la IA siempre devuelve Nevus).
	 * Si se viene del seguimiento de una lesión se añade a esa lesión; si no, se crea una nueva.
	 */
	function demoGuardarInforme(imagen) {
		if (!pacienteActual) return;

		let paciente = null;
		let lesionId = null;
		if (pacienteActual.lesionId) {
			paciente = pacientePorSip(pacienteActual.SIP);
			lesionId = Number(pacienteActual.lesionId);
		} else {
			paciente = db.pacientes.find(p => p.Id === pacienteActual.id);
			if (paciente) {
				lesionId = db.informes
					.filter(i => i.PacientesId === paciente.Id)
					.reduce((max, i) => Math.max(max, i.LesionId), 0) + 1;
			}
		}
		if (!paciente) return;

		db.informes.push({
			id: siguienteId(db.informes, "id"),
			PacientesId: paciente.Id,
			LesionId: lesionId,
			Diagnostico: null,
			DiagnosticoIA: "Nevus",
			Fecha: new Date().toISOString(),
			Imagen: imagen || imagenNevus(50, 42, 15),
			abierto: "Si"
		});
	}

	// Sustituye la librería REST: modo demo -> datos simulados, modo real -> servidor
	function rest(method, url, data, callback) {
		return (modoDemo ? restDemo : restReal)(method, url, data, callback);
	}
	rest.get = function (url, callback) { return rest("GET", url, callback); };
	rest.post = function (url, data, callback) { return rest("POST", url, data, callback); };
	rest.put = function (url, data, callback) { return rest("PUT", url, data, callback); };
	rest.delete = function (url, callback) { return rest("DELETE", url, callback); };

	window.rest = rest;
	window.demoGuardarInforme = demoGuardarInforme;
})();
