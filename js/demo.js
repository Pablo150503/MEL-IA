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

	function haceDias(dias) {
		return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
	}

	// "Base de datos" en memoria con las mismas columnas que devuelve servidor.js.
	// Las imágenes son nevus reales del ISIC Archive (ver assets/casos/CREDITOS.txt)
	const db = {
		medicos: [
			{ id: 1, Nombre: "Javier", Nombre2: "", Apellidos: "Ruiz Molina", DNI: "", Password: "", Especialidad: "Dermatología" }
		],
		pacientes: [
			{ Id: 1, Nombre: "Laura", Apellidos: "García López", Edad: 34, Sexo: "Femenino", SIP: "10293847", idMedico: 1 },
			{ Id: 2, Nombre: "Carlos", Apellidos: "Martínez Ruiz", Edad: 52, Sexo: "Masculino", SIP: "20394857", idMedico: 1 },
			{ Id: 3, Nombre: "Ana", Apellidos: "Pérez Soler", Edad: 41, Sexo: "Femenino", SIP: "30495867", idMedico: 1 },
			{ Id: 4, Nombre: "Miguel", Apellidos: "Torres Vidal", Edad: 27, Sexo: "Masculino", SIP: "40586972", idMedico: 1 }
		],
		informes: [
			{ id: 1, PacientesId: 1, LesionId: 1, Diagnostico: "Nevus", DiagnosticoIA: "Nevus", Fecha: haceDias(90), Imagen: "assets/casos/caso-1a.jpg", abierto: "Si" },
			{ id: 2, PacientesId: 1, LesionId: 1, Diagnostico: null, DiagnosticoIA: "Nevus", Fecha: haceDias(7), Imagen: "assets/casos/caso-1b.jpg", abierto: "Si" },
			{ id: 3, PacientesId: 1, LesionId: 2, Diagnostico: "Nevus", DiagnosticoIA: "Nevus", Fecha: haceDias(200), Imagen: "assets/casos/caso-2.jpg", abierto: "No" },
			{ id: 4, PacientesId: 2, LesionId: 1, Diagnostico: null, DiagnosticoIA: "Nevus", Fecha: haceDias(3), Imagen: "assets/casos/caso-3.jpg", abierto: "Si" },
			{ id: 5, PacientesId: 3, LesionId: 1, Diagnostico: "Nevus", DiagnosticoIA: "Nevus", Fecha: haceDias(30), Imagen: "assets/casos/caso-4.jpg", abierto: "Si" },
			{ id: 6, PacientesId: 4, LesionId: 1, Diagnostico: null, DiagnosticoIA: "Nevus", Fecha: haceDias(12), Imagen: "assets/casos/caso-5.jpg", abierto: "Si" }
		],
		notas: [
			{ id: 1, InformeId: 1, MedicoNota: 1, Nota: "Regular borders and homogeneous color. Follow-up in 3 months.", FechaNota: haceDias(90) },
			{ id: 2, InformeId: 3, MedicoNota: 1, Nota: "Stable lesion after 6 months. Case closed.", FechaNota: haceDias(15) }
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
			const dni = (datos.dni || "").trim();
			const password = datos.password || "";
			if (!dni || !password) return [401, { error: "DNI o contraseña incorrectos" }];
			// Un médico registrado en la demo entra con sus datos; cualquier otro usuario
			// entra como el médico por defecto, mostrando el usuario que ha escrito
			let medico = db.medicos.find(m => m.DNI === dni && m.Password === password);
			if (!medico) {
				medico = db.medicos[0];
				medico.DNI = dni;
				medico.Password = password;
			}
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
		let resultado = [404, { error: "Ruta no encontrada" }];
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
			DiagnosticoIA: lesionDemo,
			Fecha: new Date().toISOString(),
			Imagen: imagen,
			abierto: "Si"
		});
	}

	// Las cinco lesiones que clasifica la IA. En la demo se elige cuál "detecta" al entrar
	// en el modo demo (ver abrirSelectorLesion en script.js)
	const LESIONES_DEMO = ["Nevus", "Melanoma", "Basal Cell Carcinoma", "Actinic Keratosis", "Squamous Cell Carcinoma"];
	// El color va por posición: el resultado principal siempre en el azul más intenso
	const COLORES_POR_POSICION = ["#137DC5", "#2199ea", "#0f5f96", "#50aeee", "#9fb8cc"];
	let lesionDemo = "Nevus";

	function demoElegirLesion(nombre) {
		if (LESIONES_DEMO.includes(nombre)) lesionDemo = nombre;
	}

	/**
	 * Probabilidades del resultado en modo demo: la lesión elegida es siempre la más
	 * probable (84,0-94,9 %) y el resto se reparte entre las otras cuatro, con valores
	 * que varían un poco en cada diagnóstico.
	 */
	function demoCategorias() {
		// Se trabaja en décimas para que los cinco valores sumen exactamente 100,0 %
		const principal = 840 + Math.floor(Math.random() * 110);
		let resto = 1000 - principal;
		const segunda = Math.round(resto * (0.4 + Math.random() * 0.2));
		resto -= segunda;
		const tercera = Math.round(resto * (0.4 + Math.random() * 0.15));
		resto -= tercera;
		const cuarta = Math.round(resto * (0.55 + Math.random() * 0.15));
		const quinta = resto - cuarta;
		const valores = [principal, segunda, tercera, cuarta, quinta];

		const nombres = [lesionDemo, ...LESIONES_DEMO.filter(nombre => nombre !== lesionDemo)];
		return nombres.map((name, i) => ({ name, percentage: valores[i] / 10, color: COLORES_POR_POSICION[i] }));
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
	window.demoCategorias = demoCategorias;
	window.demoElegirLesion = demoElegirLesion;
	window.demoLesion = () => lesionDemo;
})();
