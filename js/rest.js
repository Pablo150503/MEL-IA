/*
---------------------------------------------------------------------------------------------
Librería REST/JSON (Versión: 2024.01)
---------------------------------------------------------------------------------------------
Universidad de Alicante - Ingeniería Biomédica - Sistemas Distribuidos
---------------------------------------------------------------------------------------------

Realiza una petición REST con datos codificados en JSON
Incluir en el HTML con <script src="rest.js"></script>
uso:
	rest (metodo, url, [datosPeticion], [callback])
	rest.get(url, [callback])
	rest.post(url, datosPeticion, [callback])
	rest.put(url, datosPeticion, [callback])
	rest.delete(url, [callback])

Cuando se completa la petición/respuesta se invoca callback con el estado y la respuesta:
	callback(status, response)

Si no se pasa callback, la petición es síncrona y retorna un objeto {status, response}
Para la práctica SIEMPRE utilizar llamadas asíncronas con callback.

Para activar la depuración usar:
	rest.debug = true;

Ejemplos:
	rest.get("http://www.miempresa.com/test", function (status, response) { ... });
	rest.post("http://www.miempresa.com/persona", { nombre: "Luis" }, function (status, response) { ... });

---------------------------------------------------------------------------------------------
*/

(function () {
	function debug(...args) { // función de depuración (muestra mensajes por consola)
		if (rest.debug) console.log("REST", ...args);
	}

	function rest(method, url, data, callback) { // función para realizar peticiones REST/JSON
		method = method.toUpperCase(); // método en mayúsculas
		if (typeof data === "function") { // no se ha indicado data, pero si callback
			callback = data;
			data = null;
		}
		var async = typeof callback === "function"; // es una petición asincrona?
		var xhr = new XMLHttpRequest();
		xhr.open(method, url, async);
		if (data) {
			data = JSON.stringify(data); // datos en texto formato JSON
			xhr.setRequestHeader("Content-type", "application/json;charset=UTF-8"); // el tipo de la petición es JSON
		}
		debug(">>>", method, url, data, async ? "ASYNC" : "SYNC");
		xhr.send(data); // Enviar datos
		function end() {
			debug("<<<", xhr.status, xhr.response);
			var response = xhr.response;
			if (xhr.status >= 200 && xhr.status < 300 && response) {
				try {
					response = JSON.parse(response);
				} catch (e) {
					debug("Error parseando JSON:", response);
				}
			}
			if (async) {
				callback(xhr.status, response);
			} else {
				return { status: xhr.status, response: response };
			}
		}
		if (async) {
			xhr.onload = end;
			xhr.onerror = end;
		} else {
			return end();
		}
	};

	// Métodos
	rest.get = function (url, callback) { return rest("GET", url, callback); };
	rest.post = function (url, data, callback) { return rest("POST", url, data, callback); };
	rest.put = function (url, data, callback) { return rest("PUT", url, data, callback); };
	rest.delete = function (url, callback) { return rest("DELETE", url, callback); };

	window.rest = rest; // acceso global a la librería

	rest.debug = false;
})();