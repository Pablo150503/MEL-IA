let vistaActual = null;

cambiarVista("modo");


var modoDemo = false; // true: la app funciona sin servidor con los datos simulados de demo.js
var medicoActual = null;
var informeActual = null;
var pacienteActual = null;
var pacienteDetalle = null; // Datos completos del paciente abierto en el seguimiento (para exportar)
var nuevoPaciente = null;
var nuevoDiagnostico = null;

/**
 * Pantalla de selección de modo: "real" (conecta con el servidor) o "demo" (sin conexión).
 */
function elegirModo(modo) {
  modoDemo = (modo === "demo");
  medicoActual = null;
  document.getElementById("errorMensaje").style.display = "none";
  cambiarVista("credenciales");
}

function login() {
  var usuario = document.getElementById("dni").value;
  var contrasenya = document.getElementById("password").value;
  var errorMensaje = document.getElementById("errorMensaje");

  let info = {
      dni: usuario,
      password: contrasenya
  };

  // Hacer una solicitud POST a la API para verificar credenciales
  rest.post("/api/medico/login", info, function(codigo, respuesta) {
      if (codigo === 200) {
          console.log("Has iniciado sesión correctamente, ID Médico:", respuesta.idMedico);
          errorMensaje.style.display = "none"; // Ocultar error si el login es exitoso

          // Obtener los datos del médico
          rest.get("/api/medico/" + respuesta.idMedico, function(codigo, medico) {
              if (codigo === 200) {
                  medicoActual = medico;
                  actualizarHeader();
                  cambiarVista("inicio");

                  // Limpiar los campos del formulario
                  document.getElementById("dni").value = "";
                  document.getElementById("password").value = "";
              } else {
                  console.log("Médico no encontrado");
              }
          });

      } else if (codigo === 401) {
          // 🔴 Mostrar mensaje de error en rojo
          errorMensaje.textContent = "User or password incorrect";
          errorMensaje.style.display = "block";
          document.getElementById("dni").value = "";
          document.getElementById("password").value = "";
      } else {
          console.log("Error inesperado:", respuesta);
      }
  });
}

function registrarUsuario() {
  const nombreInput = document.getElementById("nombreRegistro");
  const nombreInput2 = document.getElementById("nombreRegistro2");
  const apellidosInput = document.getElementById("apellidosRegistro");
  const dniInput = document.getElementById("dniRegistro");
  const passwordInput = document.getElementById("passwordRegistro");
  const especialidadElement = document.querySelector(".custom-select");
  const errorMensaje = document.getElementById("errorRegistro");

  const nombre = nombreInput.value.trim();
  const nombre2 = nombreInput2.value.trim();
  const apellidos = apellidosInput.value.trim();
  const dni = dniInput.value.trim();
  const password = passwordInput.value.trim();
  let especialidad = especialidadElement ? especialidadElement.textContent.trim() : "";

  // Validación básica
  if (!nombre || !apellidos || !dni || !password || especialidad === "Select your specialty") {
      errorMensaje.textContent = "Please fill in all the fields.";
      errorMensaje.style.display = "block";
      return;
  }
  if(especialidad == "Primary Care"){
    especialidad = "At. Primaria"
  }else if(especialidad == "Dermatology"){
    especialidad = "Dermatología"
  }
  let info = {
      nombre,
      nombre2,
      apellidos,
      dni,
      password,
      especialidad
  };


  // Enviar la solicitud POST al servidor
  rest.post("/api/medico/registro", info, function(codigo, respuesta) {
      if (codigo === 201) {
          errorMensaje.style.display = "none";
          rest.get("/api/medico/" + respuesta.idMedico, function(codigo, medico) {
            if (codigo === 200) {
                medicoActual = medico;
                actualizarHeader()
            } else {
                console.log("Médico no encontrado");
            }
        });
        
          // 🔹 Limpiar los campos después del registro exitoso
          nombreInput.value = "";
          nombreInput2.value = "";
          apellidosInput.value = "";
          dniInput.value = "";
          passwordInput.value = "";
          especialidadElement.textContent = "Select your specialty"; // Reiniciar el selector
          errorMensaje.style.display = "block";

          cambiarVista("inicio"); // Ir a la pantalla de inicio de sesión
      } else if (codigo === 409) { // Error 409: conflicto, el DNI ya está registrado
          errorMensaje.textContent = "The user is already registered.";
          errorMensaje.style.display = "block";

          // 🔹 Solo limpiar el campo del DNI
          dniInput.value = "";
      } else {
          console.log("Error en el registro:", respuesta);
          errorMensaje.textContent = "Registration error. Please try again.";
          errorMensaje.style.display = "block";
      }
  });
}

function actualizarHeader() {
  if (medicoActual) {
      // Obtener todos los elementos <header> con la clase "header-sip"
      document.querySelectorAll(".header-sip").forEach(header => {
          header.querySelector("#userNombre").textContent = medicoActual.Nombre;
          if (medicoActual.Especialidad == "At. Primaria"){
            header.querySelector("#userEspecialidad").textContent = "Primary Care";
          }else{
            header.querySelector("#userEspecialidad").textContent = "Dermatology";
          }
          header.querySelector("#userDNI").textContent = medicoActual.DNI;
      });
  } 
}

function vistaSeguimiento(){
  cargarPacientes()
  cambiarVista('seguimiento')
}

function cargarPacientes() {
  if (!medicoActual) return;

  let url =  `/api/pacientes?medico=${medicoActual.id}`;

  rest.get(url, function(codigo, pacientes) {
    if (codigo === 200) {
      const contenedor = document.getElementById("listaPacientes");
      contenedor.innerHTML = "";
      
      pacientes.forEach(paciente => {
        const div = document.createElement("div");
        div.classList.add("paciente-card");

        div.innerHTML = `
          <div class="paciente-info">
            <span class="paciente-nombre">${paciente.Nombre} ${paciente.Apellidos}</span>
            <span class="paciente-sip">${paciente.SIP}</span>
          </div>
          <div class="botones-paciente">
            <button class="btn-seguimiento" onclick="abrirDetallePaciente(${paciente.Id}, '${paciente.Nombre}', '${paciente.SIP}')">Tracking</button>
            <button class="btn-eliminar" onclick="abrirModal('${paciente.Nombre}', '${paciente.SIP}')">✖</button>
          </div>
        `;

        contenedor.appendChild(div);
      });
    } else {
      console.error("Error al cargar pacientes");
    }
  });
}

function abrirModal(nombre, sip) {
  const modal = document.getElementById("modalEliminar");
  const modalTexto = document.getElementById("modalTexto");
  const btnConfirmar = document.getElementById("btnConfirmarEliminar");

  modalTexto.textContent = `Are you sure that you want to delete the patient with name ${nombre} and SIP ${sip}?`;
  modal.style.display = "flex"; // Mostrar el modal

  // Asigna la función de eliminación al botón de confirmación
  btnConfirmar.onclick = function() {
      eliminarPaciente(sip);
      cerrarModal();
  };
}

function abrirModalCerrarCaso(button, sip, lesionId) {
    // Se asume que en tu HTML has creado un modal para cerrar caso con los siguientes IDs:
    // "modalCerrarCaso", "modalTextoCerrarCaso" y "btnConfirmarCerrarCaso"
    const modal = document.getElementById("modalCerrarCaso");
    const modalTexto = document.getElementById("modalTextoCerrarCaso");
    const btnConfirmar = document.getElementById("btnConfirmarCerrarCaso");
  
    modalTexto.textContent = `Are you sure that you want to close the case of the patient with SIP ${sip}?`;
    modal.style.display = "flex"; // Muestra el modal
  
    // Asigna la función de cierre al botón de confirmación
    btnConfirmar.onclick = function() {
        cerrarCaso(button, sip, lesionId); // Llama a la función existente para cerrar el caso
        cerrarModalCerrarCaso(); // Cierra el modal después de confirmar
    };
}
  
function cerrarModalCerrarCaso() {
    document.getElementById("modalCerrarCaso").style.display = "none";
}

function eliminarPaciente(sip) {
  rest.delete(`/api/pacientes/sip/${sip}`, function(codigo, respuesta) {
      if (codigo === 200) {
          document.querySelectorAll(".paciente-card").forEach(paciente => {
              if (paciente.querySelector(".paciente-sip").textContent === sip) {
                  paciente.remove();
              }
          });
          console.log(`Paciente con SIP ${sip} eliminado correctamente.`);
      } else {
          console.error(`Error al eliminar el paciente con SIP ${sip}.`);
      }
  });
}

function cerrarModal() {
  document.getElementById("modalEliminar").style.display = "none";
}

function cerrarCaso(button, sip, lesionId) {
    if (!button) {
        console.error("Error: El botón no fue proporcionado correctamente.");
        return;
    }

    // Encontrar la tarjeta de la lesión asociada al botón
    const lesionCard = button.closest(".lesion-card");

    if (!lesionCard) {
        console.error("Error: No se encontró la tarjeta de la lesión.");
        return;
    }

    // Llamar a la API para cerrar el caso en la base de datos
    rest.post(`/api/cerrar-caso/${sip}/${lesionId}`, {}, function (codigo, respuesta) {
        if (codigo === 200) {
            console.log("✅ Caso cerrado en la base de datos.");

            // Eliminar el botón "Cerrar Caso"
            button.remove();

            // Aplicar estilo de caso cerrado
            lesionCard.classList.add("lesion-cerrada");

            // Cambiar el texto del botón de seguimiento a "Consulta del caso"
            const botonSeguimiento = lesionCard.querySelector(".btn-informe");
            if (botonSeguimiento) {
                botonSeguimiento.textContent = "Case consultation";
            }

            // Guardar en localStorage para persistencia tras recarga
            localStorage.setItem(`lesionCerrada_${lesionId}`, "true");

            // Actualizar las listas: mover la tarjeta de casos activos a casos cerrados
            const containerActivos = document.getElementById("containerActivos");
            const containerCerrados = document.getElementById("containerCerrados");
            if (containerActivos && containerCerrados) {
                // Remover la tarjeta de la lista de casos activos (si está ahí)
                if (lesionCard.parentNode === containerActivos) {
                    containerActivos.removeChild(lesionCard);
                }
                // Agregar la tarjeta a la lista de casos cerrados
                containerCerrados.appendChild(lesionCard);

                // Si no quedan más tarjetas en casos activos, mostrar mensaje
                if (containerActivos.children.length === 0) {
                    containerActivos.innerHTML = "<p>There are not active cases</p>";
                }
            }
        } else {
            console.error("❌ Error al cerrar el caso.");
        }
    });
}

function abrirModalSeguimiento(sip, lesionId) {
    const modal = document.getElementById("modalSeguimiento");
    document.getElementById("seguimientoNombre").textContent = `Tracking of the Injury ${lesionId}`;
    const listaInformes = document.getElementById("listaInformes");
    listaInformes.innerHTML = "<p>Loading reports...</p>";

    // 🔥 Guardar el paciente actual para usarlo después
    pacienteActual = { SIP: sip, lesionId: lesionId };


    rest.get(`/api/informes/${sip}/${lesionId}`, function (codigo, datos) {
        if (codigo === 200) {
            listaInformes.innerHTML = "";

            if (datos.length === 0) {
                listaInformes.innerHTML = "<p>There are no reports for this injury.</p>";
                return;
            }

            // Verificar si la lesión está cerrada
            const esCerrada = datos.some(informe => String(informe.abierto).trim().toLowerCase() === "no");

            const botonDiagnostico = document.querySelector(".btn-diagnostico");
            if (botonDiagnostico) {
                botonDiagnostico.style.display = esCerrada ? "none" : "inline-block";
            } else {
                console.error("No se encontró el botón de diagnóstico en el DOM.");
            }

            datos.forEach(informe => {
                const li = document.createElement("li");
                li.style.padding = "15px";
                li.style.margin = "8px 0";
                li.style.borderRadius = "8px";
                li.style.fontSize = "16px";
                li.style.fontWeight = "bold";
                li.style.lineHeight = "1.6";

                li.style.background = informe.Diagnostico ? "#d4edda" : "#fff3cd"; // Verde si tiene diagnóstico, amarillo si no
                li.style.color = informe.Diagnostico ? "#155724" : "#856404";

                let fechaFormateada = "Date not available";
                if (informe.Fecha) {
                    let fecha = new Date(informe.Fecha);
                    if (!isNaN(fecha.getTime())) {
                        fechaFormateada = fecha.toLocaleDateString();
                    }
                }

                li.innerHTML = `
                    <strong>${fechaFormateada}</strong>
                    <br>
                    <span>Diagnosis: ${informe.Diagnostico || "Pending"}</span>
                    <br>
                    <span>IA: ${informe.DiagnosticoIA || "Not Allowed"}</span>
                    <br>
                    <div style="display: flex; justify-content: center; gap: 10px; margin-top: -10px;">
                        <button onclick='verImagen(${JSON.stringify(informe)})' class="btn-ver">See the Report</button>
                    </div>
                `;
                listaInformes.appendChild(li);
            });
        } else {
            listaInformes.innerHTML = "<p>Error loading the reports.</p>";
        }
    });

    modal.style.display = "flex"; // Mostrar modal
}

function verImagen(informe) {
    if (!informe || typeof informe !== "object") {
        console.error("Error: Informe inválido o no es un objeto.");
        return;
    }

    rest.get(`/api/paciente/${informe.PacientesId}`, function (codigo, data) {
        if (codigo === 200 && data.paciente) {
            document.getElementById("informePaciente").textContent = `${data.paciente.Nombre} ${data.paciente.Apellidos}`;
        } else {
            document.getElementById("informePaciente").textContent = `Patient ID: ${informe.PacientesId}`;
        }
    });

    document.getElementById("informeDiagnostico").textContent = informe.Diagnostico || "Not diagnosed";

    // Mostrar el botón "Diagnosticar" solo si el informe no tiene diagnóstico
    const botonDiagnostico = document.getElementById("btnDiagnosticar");
    if (!informe.Diagnostico || informe.Diagnostico.trim() === "No diagnosticado") {
        botonDiagnostico.style.display = "block";
    } else {
        botonDiagnostico.style.display = "none";
    }

    document.getElementById("informeDiagnosticoIA").textContent = informe.DiagnosticoIA || "Not available";
    document.getElementById("informeFecha").textContent = new Date(informe.Fecha).toLocaleDateString();
    document.getElementById("imagenInforme").src = informe.Imagen;
    informeActual = informe.id;
    cargarNotas(informe.id);
    cambiarVista("pantallaInforme");
}

function guardarNotaInforme() {
    const nota = document.getElementById("notaInforme").value.trim();
    if (!nota) {
        alert("The note cannot be empty.");
        return;
    }
    InformeId = informeActual;
    const datosNota = { InformeId, medicoId: medicoActual.id, nota };
    rest.post("/api/notas", datosNota, function (codigo, respuesta) {
        if (codigo === 201) {
            document.getElementById("notaInforme").value = ""; // Limpiar textarea
            cargarNotas(InformeId); // 🔄 Recargar notas
        } else {
            console.error("Error al guardar la nota:", respuesta);
            alert("Error saving the note.");
        }
    });
}

function cargarNotas(informeId) {
    rest.get(`/api/notas/${informeId}`, function (codigo, notas) {
        const listaNotas = document.getElementById("listaNotas");
        listaNotas.innerHTML = "";

        if (codigo !== 200 || !notas || notas.length === 0) {
            listaNotas.innerHTML = "<p>This report have not notes yet.</p>";
            return;
        }

        notas.forEach(nota => {
            const li = document.createElement("li");
            li.classList.add("nota-item");
            li.innerHTML = `
                <strong>${nota.Nombre} ${nota.Apellidos}</strong> - 
                <span class="nota-fecha">${new Date(nota.FechaNota).toLocaleString()}</span>
                <p>${nota.Nota}</p>
            `;
            listaNotas.appendChild(li);
        });
    });
}

function cerrarModalSeguimiento() {
    document.getElementById("modalSeguimiento").style.display = "none";
}
  
function filtrarPacientes() {
  let input = document.getElementById("buscadorPacientes").value.toLowerCase();
  let pacientes = document.querySelectorAll(".paciente-card");

  pacientes.forEach(paciente => {
      let nombre = paciente.querySelector(".paciente-nombre").textContent.toLowerCase();
      let sip = paciente.querySelector(".paciente-sip").textContent.toLowerCase();

      if (nombre.includes(input) || sip.includes(input)) {
          paciente.style.display = "flex"; // Muestra los que coincidan
      } else {
          paciente.style.display = "none"; // Oculta los que no coincidan
      }
  });
}

function abrirDetallePaciente(id, nombre, sip) {
    cambiarVista("detallePaciente");
    // Se asignan los títulos estáticos a los divs correspondientes
    document.getElementById('tituloActivos').innerHTML = "<h3>Active Cases</h3>";
    document.getElementById('tituloCerrados').innerHTML = "<h3>Closed Cases</h3>";
  
    document.getElementById("detalleNombre").textContent = nombre;
    document.getElementById("detalleSIP").textContent = sip;
    
    // Obtener detalles del paciente
    rest.get(`/api/paciente/${id}`, function (codigo, paciente) {
      if (codigo === 200) {
        pacienteDetalle = paciente.paciente;
        document.getElementById("detalleEdad").textContent = paciente.paciente.Edad;
        document.getElementById("detalleSexo").textContent = paciente.paciente.Sexo;
        
        // Obtener las lesiones del paciente
        rest.get(`/api/lesiones/${id}`, function (codigo, lesiones) {
          if (codigo === 200) {
            // Limpiar los contenedores de los casos
            const containerActivos = document.getElementById("containerActivos");
            const containerCerrados = document.getElementById("containerCerrados");
            containerActivos.innerHTML = "";
            containerCerrados.innerHTML = "";
    
            // Arrays para los casos activos y cerrados
            const casosActivos = [];
            const casosCerrados = [];
    
            // Separar las lesiones según su estado
            lesiones.forEach((lesion, index) => {
              const esCerrada = (lesion.abierto === "No");
              
              // Crear la tarjeta para la lesión
              const lesionCard = document.createElement("div");
              lesionCard.classList.add("lesion-card");
              lesionCard.setAttribute("data-lesion-id", lesion.LesionId);
    
              lesionCard.innerHTML = `
                <div class="lesion-info">
                    <span class="lesion-texto">
                        Injury ${index + 1}
                    </span>
                    <div class="botones-lesion">
                        <button class="btn-informe" onclick="abrirModalSeguimiento('${sip}', ${lesion.LesionId})">
                            ${esCerrada ? "Case Consultation" : "Tracking"}
                        </button>
                        ${
                          !esCerrada
                            ? `<button class="btn-cerrar" onclick="abrirModalCerrarCaso(this, '${sip}', ${lesion.LesionId})">
                                 Close Case
                               </button>`
                            : ""
                        }
                    </div>
                </div>
              `;
    
              // Agregar la tarjeta al array correspondiente
              if (esCerrada) {
                lesionCard.classList.add("lesion-cerrada");
                casosCerrados.push(lesionCard);
              } else {
                casosActivos.push(lesionCard);
              }
            });
    
            // Llenar el contenedor de casos activos
            if (casosActivos.length > 0) {
              casosActivos.forEach(card => {
                containerActivos.appendChild(card);
              });
            } else {
              containerActivos.innerHTML = "<p>There are no active cases</p>";
            }
    
            // Llenar el contenedor de casos cerrados
            if (casosCerrados.length > 0) {
              casosCerrados.forEach(card => {
                containerCerrados.appendChild(card);
              });
            } else {
              containerCerrados.innerHTML = "<p>There are no closed cases</p>";
            }
          } else {
            console.error("Error al obtener las lesiones.");
          }
        });
      } else {
        console.error("Error al obtener los datos del paciente.");
      }
    });
}

function resetModalDiagnostico() {
    const selectContainer = document.querySelector("#modalDiagnostico .select-container");
    if (selectContainer) {
      // Limpiar el dataset y atributo data-selected
      selectContainer.dataset.selected = "";
      selectContainer.removeAttribute("data-selected");
      // Volver al texto por defecto
      selectContainer.querySelector(".custom-select").textContent = "Possible Diagnoses";
    }
}
  
  
function abrirModalDiagnostico() {
    const selectContainer = document.querySelector(".select-container");

    // Si ya hay un diagnóstico seleccionado, asegurarse de que se mantenga en el select
    if (selectContainer.dataset.selected) {
        selectContainer.querySelector(".custom-select").textContent = selectContainer.dataset.selected;
    }

    document.getElementById("modalDiagnostico").style.display = "flex";
}

function cerrarModalDiagnostico() {
    document.getElementById("modalDiagnostico").style.display = "none";
}

function toggleSelect(container) {
    // Cerrar otros selects abiertos
    document.querySelectorAll(".select-container").forEach(select => {
        if (select !== container) {
            select.classList.remove("active");
            select.querySelector(".select-options").classList.remove("show");
        }
    });

    // Alternar el estado del select actual
    container.classList.toggle("active");
    const options = container.querySelector(".select-options");
    
    if (options) {
        options.classList.toggle("show");
    }
}

function setOption(element) {
    const selectContainer = element.closest(".select-container");

    if (!selectContainer) {
        console.error("❌ Error: No se encontró el selectContainer.");
        return;
    }

    const selectedText = element.textContent.trim();

    // Guardar en dataset y en un atributo HTML
    selectContainer.dataset.selected = selectedText;
    selectContainer.setAttribute("data-selected", selectedText);

    // Actualizar el texto visible del select
    selectContainer.querySelector(".custom-select").textContent = selectedText;

    // Cerrar las opciones
    selectContainer.querySelector(".select-options").classList.remove("show");

    console.log("✅ Opción seleccionada y guardada:", selectedText);
}

function guardarDiagnostico() {
    const selectContainer = document.querySelector("#modalDiagnostico .select-container");
    if (!selectContainer) {
      console.error("❌ Error: No se encontró el selectContainer dentro del modal.");
      return;
    }
  
    const selectedOption = selectContainer.dataset.selected || "";
    const opcionesValidas = ["Nevus", "Melanoma", "Basal Cell Carcinoma", "Squamous Cell Carcinoma", "Actinic Keratosis"];
  
    if (!opcionesValidas.includes(selectedOption)) {
      alert("Please select a valid diagnosis.");
      return;
    }
  
    if (!informeActual) {
      alert("No report has been selected.");
      return;
    }
  
    const datosDiagnostico = { informeId: informeActual, diagnostico: selectedOption };
  
    rest.post("/api/diagnostico", datosDiagnostico, function (codigo, respuesta) {
      if (codigo === 200) {
        document.getElementById("informeDiagnostico").textContent = selectedOption;
  
        // Actualizar el select con el diagnóstico seleccionado
        selectContainer.querySelector(".custom-select").textContent = selectedOption;
        selectContainer.dataset.selected = selectedOption;
  
        cerrarModalDiagnostico();
        
        // Reiniciar el modal para la próxima vez
        resetModalDiagnostico();
  
        // Actualizar el modal de seguimiento, etc.
        if (pacienteActual) {
          setTimeout(() => {
            abrirModalSeguimiento(pacienteActual.SIP, pacienteActual.lesionId);
          }, 500);
        }
  
        document.getElementById("btnDiagnosticar").style.display = "none"; // Ocultar botón tras diagnóstico
      } else {
        alert("Error updating the diagnosis.");
      }
    });
  }
  

function abrirEvolucionLesion() {
    const sip = pacienteActual?.SIP;
    const lesionId = pacienteActual?.lesionId;
    
    if (!sip || !lesionId) {
        console.error("❌ Error: SIP o Lesión ID no definidos.", sip, lesionId);
        return;
    }


    cambiarVista("evolucionLesion");

    const contenedorImagenes = document.getElementById("contenedorImagenes");
    contenedorImagenes.innerHTML = "<p>Loading images...</p>";

    // Asegurar que la URL está bien formada
    const url = `/api/informes/${encodeURIComponent(sip)}/${encodeURIComponent(lesionId)}`;

    rest.get(url, function (codigo, datos) {
        if (codigo === 200) {
            contenedorImagenes.innerHTML = "";

            if (datos.length === 0) {
                contenedorImagenes.innerHTML = "<p>There are no images for this injury.</p>";
                return;
            }

            // Ordenar imágenes cronológicamente
            datos.sort((a, b) => new Date(a.Fecha) - new Date(b.Fecha));

            datos.forEach(informe => {
                let fechaFormateada = new Date(informe.Fecha).toLocaleDateString();

                const imgElemento = document.createElement("div");
                imgElemento.classList.add("imagen-evolucion");
                imgElemento.innerHTML = `
                    <p><strong>${fechaFormateada}</strong></p>
                    <img src="${informe.ImagenURL}" alt="Evolución lesión">
                `;
                contenedorImagenes.appendChild(imgElemento);
            });
        } else {
            console.error("❌ Error en la respuesta de la API:", datos);
            contenedorImagenes.innerHTML = "<p>Error loading the images.</p>";
        }
    });
}

function diagnostico1() {
    if (!medicoActual || !medicoActual.id) {
        mostrarErrorDiagnostico("Error: the current doctor was not found.");
        return;
    }

    // Obtener valores del formulario
    nuevoPaciente = {
        nombre: document.getElementById("nombre").value.trim(),
        apellidos: document.getElementById("apellidos").value.trim(),
        edad: parseInt(document.getElementById("edad").value.trim()) || null,
        sip: document.getElementById("sip").value.trim(),
        idMedico: medicoActual.id
    };
    let sexoP = null;
    const selectContainer = document.querySelector(".sexo-select");
    if (selectContainer) {
        sexoP = selectContainer.dataset.selected || selectContainer.getAttribute("data-selected") || "No definido";
    } else {
        sexoP = "No definido";
    }
    if(sexoP == "Male"){
        nuevoPaciente.sexo = "Masculino";
    }else{
        nuevoPaciente.sexo = "Femenino";
    }
    // Validar que todos los campos estén llenos
    if (!nuevoPaciente.nombre || !nuevoPaciente.apellidos || !nuevoPaciente.edad || 
        !nuevoPaciente.sip || nuevoPaciente.sexo === "Seleccionar sexo" || nuevoPaciente.sexo === "No definido") {
        mostrarErrorDiagnostico("Please fill in all the fields before continuing.");
        return;
    }

    // 🔹 Enviar datos del paciente al servidor para guardarlo en la base de datos
    rest.post("/api/pacientes", nuevoPaciente, function (codigo, respuesta) {
        if (codigo === 201) {
            pacienteActual = {
                id: respuesta.idPaciente,
                ...nuevoPaciente
            };

            ocultarErrorDiagnostico(); // Ocultar mensaje de error si el registro fue exitoso
            cambiarVista("sitioAnatomico");

        } else {
            console.error("Error al registrar paciente:", respuesta);
            mostrarErrorDiagnostico("There was an error registering the patient. Please try again.");
        }
    });
}

function mostrarErrorDiagnostico(mensaje) {
    let errorMensaje = document.getElementById("errorDiagnostico");
    if (!errorMensaje) {
        errorMensaje = document.createElement("p");
        errorMensaje.id = "errorDiagnostico";
        errorMensaje.style.color = "red";
        errorMensaje.style.fontWeight = "bold";
        errorMensaje.style.textAlign = "center";
        errorMensaje.style.marginTop = "10px";
        document.querySelector("#formulario form").appendChild(errorMensaje);
    }
    errorMensaje.textContent = mensaje;
}

function ocultarErrorDiagnostico() {
    const errorMensaje = document.getElementById("errorDiagnostico");
    if (errorMensaje) {
        errorMensaje.remove();
    }
}

function enviarDiagnostico(){
    var diagnostico = {
        edad: pacienteActual.edad, 
        sexo: pacienteActual.sexo,
        sitioAnatomico: document.getElementById("parteCuerpo").value
    }
    console.log(diagnostico)
    cambiarVista("seleccionImagen"); // Mostrar pantalla de carga

}

/**
 * Cambia la vista visible según el id pasado.
 */
// Modificar la función cambiarVista para detectar cuando se pasa a "sitioAnatomico"
function cambiarVista(id) {
  // Ocultar todas las vistas
  document.querySelectorAll(".vista").forEach((vista) => {
      vista.classList.remove("visible");
      vista.style.display = "none";  
  });

  const nuevaVista = document.getElementById(id);
  if (!nuevaVista) {
      console.error(`Error: La vista '${id}' no existe.`);
      return;
  }

  // Mostrar la nueva vista (el CSS de .vista.visible la coloca como columna adaptable)
  nuevaVista.classList.add("visible");
  nuevaVista.style.display = "";
  window.scrollTo(0, 0);
  vistaActual = id;

  actualizarHeader();
  console.log(id)
  // Si se cambia a "sitioAnatomico", inicializar el modelo 3D
  if (id === "sitioAnatomico") {
      console.log("Detectada vista 'sitioAnatomico', iniciando modelo 3D...");
      iniciarModelo3D();
  }
}
  
/**
 * Abre la cámara del móvil (input con capture). En ordenador abre el selector de archivos.
 */
function tomarFoto() {
  document.getElementById("inputCamara").click();
}

/**
* Maneja la carga de imágenes (cámara o fototeca) y las añade a la vista previa
*/
function cargarImagen(event) {
  const archivo = event.target.files[0];
  if (archivo) {
      const urlImagen = URL.createObjectURL(archivo);
      agregarImagen(urlImagen, archivo.name);
  }
  event.target.value = ""; // Permite volver a elegir la misma foto
}

/**
* Muestra la imagen en la vista previa
*/
function agregarImagen(url, nombre) {
  const vistaPrevia = document.getElementById("vistaPrevia");
  const textoSecundario = vistaPrevia.querySelector(".texto-secundario");
  const btnIniciarDiagnostico = document.getElementById("btnIniciarDiagnostico");

  // Si hay texto de "No hay imagen seleccionada", se elimina
  if (textoSecundario) {
      textoSecundario.remove();
  }

  // Si ya hay una imagen, la reemplazamos
  let img = vistaPrevia.querySelector("img");
  if (!img) {
      img = document.createElement("img");
      vistaPrevia.appendChild(img);
  }

  img.src = url;
  img.style.display = "block";

  // Activar el botón de inicio de diagnóstico
  btnIniciarDiagnostico.removeAttribute("disabled");
}


/**
 * Cierra sesión y vuelve a la pantalla de credenciales.
 */
function logout() {
  cambiarVista("credenciales");
}

function iniciarModelo3D() {
    console.log("Iniciando carga del modelo 3D...");
  
    const canvasContainer = document.getElementById("canvas3D");
    if (!canvasContainer) {
      console.error("Error: No se encontró el contenedor del canvas (#canvas3D)");
      return;
    }
    // El tamaño del contenedor lo marca styles.css (se adapta al alto del móvil)

    // Crear escena, cámara y renderizador.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      canvasContainer.clientWidth / canvasContainer.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // nítido en pantallas retina
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    canvasContainer.innerHTML = "";
    canvasContainer.appendChild(renderer.domElement);
    console.log("Renderer y escena creados.");
  
    // Luces.
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    console.log("Luces añadidas a la escena.");
  
    // Controles de órbita.
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.enableZoom = true;
    console.log("Controles de órbita inicializados.");
  
    // Cargar el modelo 3D del cuerpo exportado a glTF (assets/pablo.glb).
const loader = new THREE.GLTFLoader();
    console.log("Cargando modelo 3D desde 'assets/pablo.glb'...");
    loader.load(
      'assets/pablo.glb',
      function (gltf) {
        console.log("Modelo 3D cargado correctamente.");
        const object = gltf.scene;
        // Recorrer el modelo para asignar material y hacerlo clicable.
        object.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x137DC5 });
            child.userData.clickable = true;
            console.log("Parte detectable encontrada:", child.name || "Sin nombre");
          }
        });
        object.scale.set(30, 30, 30);
        object.position.set(0, 0, 0);
        scene.add(object);
        animate();
      },
      function (xhr) {
        console.log(`Progreso de carga: ${((xhr.loaded / xhr.total) * 100).toFixed(2)}%`);
      },
      function (error) {
        console.error("Error al cargar el modelo 3D:", error);
      }
    );
  
    // Posicionar la cámara.
    camera.position.set(0, 0, 85);
    renderer.domElement.addEventListener("pointerdown", (event) => detectarClicEnModelo(event, camera, scene));
  
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
}
  
function detectarClicEnModelo(event, camera, scene) {
    console.log("Detectando clic...");
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
  
    // Convertir coordenadas del dedo/ratón a rango [-1, 1] respecto al canvas del modelo
    const rect = event.currentTarget.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
  
    if (intersects.length > 0) {
      console.log("Objeto clicado detectado");
      const clickedObject = intersects[0].object;
      if (clickedObject.userData.clickable) {
        console.log("Parte clickeada:", clickedObject.name || "Sin nombre");
        if (window.selectedPart) {
          window.selectedPart.material.color.set(0x137DC5);
        }
        clickedObject.material.color.set(0x0d4f7c);
        window.selectedPart = clickedObject;
        const selectedName = clickedObject.name || (clickedObject.parent ? clickedObject.parent.name : "Desconocido");
        document.getElementById("textoSitio").textContent = selectedName;
        console.log("Parte seleccionada:", selectedName);
      } else {
        console.log("No es una parte clickeable");
      }
    } else {
      console.log("No se detectó ninguna intersección");
    }
}
  

  /**
   * Botón "Start Diagnostics": muestra la animación de análisis y después los resultados.
   * En modo demo además se guarda el informe en los datos simulados.
   */
  function iniciarDiagnostico() {
    const imagen = document.querySelector("#vistaPrevia img");
    if (modoDemo) {
      demoGuardarInforme(imagen ? imagen.src : "");
    }
    mostrarCarga(generarCirculos);
  }

  const PASOS_CARGA = [
    "Preprocessing the image",
    "Detecting the lesion",
    "Running the AI model",
    "Generating the report"
  ];
  const DURACION_PASO_CARGA = 1400; // ms por paso

  // Fase 1 (pasos 1-2): análisis de la imagen de la piel. Fase 2 (pasos 3-4): la IA.
  const FASES_CARGA = [
    { animacion: 0, texto: "Analyzing the lesion image..." },
    { animacion: 1, texto: "The AI is generating the diagnosis..." }
  ];
  let animacionesCarga = null;

  /**
   * Crea (una sola vez) las dos animaciones Lottie de la pantalla de carga.
   */
  function prepararAnimacionesCarga() {
    if (animacionesCarga || typeof lottie === "undefined") return animacionesCarga;
    const crear = (id, ruta) => lottie.loadAnimation({
      container: document.getElementById(id),
      renderer: "svg",
      loop: true,
      autoplay: false,
      path: ruta
    });
    animacionesCarga = [
      crear("animacionPiel", "assets/animaciones/analisis-piel.json"),
      crear("animacionIA", "assets/animaciones/analisis-ia.json")
    ];
    return animacionesCarga;
  }
  window.addEventListener("load", prepararAnimacionesCarga); // se precargan al abrir la app

  function mostrarFaseCarga(indice) {
    const fase = FASES_CARGA[indice];
    document.getElementById("textoCarga").textContent = fase.texto;
    ["animacionPiel", "animacionIA"].forEach((id, i) => {
      document.getElementById(id).classList.toggle("activa", i === fase.animacion);
    });
    const animaciones = prepararAnimacionesCarga();
    if (animaciones) {
      animaciones.forEach((animacion, i) => {
        if (i === fase.animacion) animacion.goToAndPlay(0, true);
        else animacion.pause();
      });
    }
  }

  /**
   * Pantalla de carga: dos animaciones Lottie, pasos del análisis y barra de progreso.
   */
  function mostrarCarga(alTerminar) {
    const lista = document.getElementById("pasosCarga");
    const barra = document.getElementById("barraCarga");
    const porcentaje = document.getElementById("porcentajeCarga");
    lista.innerHTML = PASOS_CARGA.map(paso => `<li><i></i><span>${paso}</span></li>`).join("");
    cambiarVista("pantallaCarga");

    const duracion = PASOS_CARGA.length * DURACION_PASO_CARGA;
    const inicio = performance.now();
    let faseActual = -1;

    function pintar(ahora) {
      const progreso = Math.min((ahora - inicio) / duracion, 1);
      const pasoActual = Math.min(Math.floor(progreso * PASOS_CARGA.length), PASOS_CARGA.length);
      const fase = pasoActual < 2 ? 0 : 1;
      if (fase !== faseActual) {
        faseActual = fase;
        mostrarFaseCarga(fase);
      }
      [...lista.children].forEach((li, i) => {
        const hecho = i < pasoActual || progreso === 1;
        li.className = hecho ? "hecho" : (i === pasoActual ? "activo" : "");
        li.firstElementChild.className = hecho ? "fas fa-check-circle" : (i === pasoActual ? "fas fa-circle-notch fa-spin" : "fas fa-circle");
      });
      barra.style.width = `${(progreso * 100).toFixed(1)}%`;
      porcentaje.textContent = `${Math.floor(progreso * 100)}%`;

      if (progreso < 1) {
        requestAnimationFrame(pintar);
      } else {
        setTimeout(() => {
          (animacionesCarga || []).forEach(animacion => animacion.pause()); // no gastar batería en segundo plano
          alTerminar();
        }, 400);
      }
    }
    requestAnimationFrame(pintar);
  }

  function generarCirculos() {
    // Mostrar la vista "resultados"
    cambiarVista("resultados");

    // Tus categorías de diagnóstico (en modo demo el resultado siempre es Nevus)
    const categories = modoDemo ? demoCategorias() : [
      { name: "Melanocytic Nevus", percentage: 75.3, color: "#137DC5" },
      { name: "Melanoma", percentage: 14.8, color: "#2199ea" },
      { name: "Basal Cell Carcinoma", percentage: 5.2, color: "#0f5f96" },
      { name: "Actinic Keratosis", percentage: 2.9, color: "#50aeee" },
      { name: "Squamous Cell Carcinoma", percentage: 1.8, color: "#9fb8cc" }
    ];

    const container = document.getElementById("circle-container");
    container.innerHTML = ""; // Limpiar contenido previo

    // Genera cada círculo con su etiqueta (el tamaño se ajusta después a la pantalla)
    categories.forEach((category) => {
      const circleItem = document.createElement("div");
      circleItem.classList.add("circle-item");

      const circle = document.createElement("div");
      circle.classList.add("circle");
      circle.dataset.percentage = category.percentage;
      circle.style.backgroundColor = category.color;
      circle.textContent = `${category.percentage.toFixed(1)}%`;

      const label = document.createElement("span");
      label.classList.add("circle-label");
      label.textContent = category.name;
      label.style.color = category.color;

      circleItem.appendChild(circle);
      circleItem.appendChild(label);
      container.appendChild(circleItem);
    });
  
    // Agrega el texto de precisión debajo de los círculos
    const precisionText = document.createElement("p");
    precisionText.classList.add("precision-text");
    precisionText.textContent = "Accuracy of the model: 88%";
    container.appendChild(precisionText);
  
    // Agrega los iconos de exportación con su etiqueta
    const exportContainer = document.createElement("div");
    exportContainer.classList.add("export-container");
  
    // Define los tipos de exportación y el icono de FontAwesome
    const exportOptions = [
      { type: "HL7",   iconClass: "fas fa-file-medical",     callback: exportHL7 },
      { type: "DICOM", iconClass: "fas fa-file-medical-alt", callback: exportDICOM },
      { type: "PDF",   iconClass: "fas fa-file-pdf",         callback: exportPDF },
      { type: "JSON",  iconClass: "fas fa-code",             callback: exportJSON },
      { type: "XML",   iconClass: "fas fa-code-branch",      callback: exportXML },
    ];
  
    exportOptions.forEach(opt => {
      // Contenedor para el icono y su etiqueta (todo él es pulsable)
      const optionContainer = document.createElement("div");
      optionContainer.classList.add("export-option");
      optionContainer.addEventListener("click", opt.callback);

      const icon = document.createElement("i");
      icon.className = opt.iconClass + " export-icon";

      const label = document.createElement("span");
      label.classList.add("export-label");
      label.textContent = opt.type;

      optionContainer.appendChild(icon);
      optionContainer.appendChild(label);
      exportContainer.appendChild(optionContainer);
    });

    container.appendChild(exportContainer);

    ajustarCirculos();
    prepararExportacion(categories); // exportar.js
  }

  /**
   * Da tamaño a los círculos según el alto de la pantalla para que los resultados
   * quepan sin scroll vertical. Si aun así no caben, los va reduciendo.
   */
  function ajustarCirculos() {
    const pantalla = document.getElementById("resultados");
    const circulos = pantalla.querySelectorAll(".circle");
    const alto = window.innerHeight;
    let escala = 1;

    for (let intento = 0; intento < 12; intento++) {
      const minimo = Math.max(30, Math.min(50, alto * 0.055)) * escala;
      const extra = Math.max(50, Math.min(150, alto * 0.17)) * escala;
      circulos.forEach(circulo => {
        const size = (Number(circulo.dataset.percentage) / 100) * extra + minimo;
        circulo.style.width = `${size}px`;
        circulo.style.height = `${size}px`;
        circulo.style.fontSize = `${Math.max(11, Math.min(18, size * 0.2))}px`;
      });
      if (pantalla.scrollHeight <= pantalla.clientHeight) break;
      escala *= 0.9;
    }
  }
