// ============================================================
// Reseñas de fotos del colegio — versión en línea (Supabase)
// Las fotos, votos y comentarios se guardan en la nube y
// todos los visitantes ven lo mismo.
// ============================================================

// ---------- 1. TUS DATOS DE SUPABASE ----------
// Los encuentras en Supabase: botón "Connect" del proyecto.
// Usa la "publishable key". NUNCA pegues aquí la "secret key".
const SUPABASE_URL = "PEGA_AQUI_TU_PROJECT_URL";
const SUPABASE_KEY = "PEGA_AQUI_TU_PUBLISHABLE_KEY";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Palabras que se tapan con *** (agrega las que quieras)
const PALABRAS_PROHIBIDAS = ["idiota", "estúpido", "estupido", "imbécil", "imbecil", "tonto"];

// ---------- 2. Identificar este navegador ----------
// Un número al azar que se guarda en el navegador.
// Sirve para permitir un solo voto por foto.
function obtenerVotante() {
  try {
    let id = localStorage.getItem("votante");
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem("votante", id);
    }
    return id;
  } catch (error) {
    return "anonimo-" + Math.random().toString(36).slice(2);
  }
}

const votante = obtenerVotante();
let fotos = [];

// ---------- 3. Elementos de la página ----------
const formularioFoto = document.getElementById("formulario-foto");
const campoArchivo = document.getElementById("archivo");
const campoTitulo = document.getElementById("titulo");
const botonSubir = document.getElementById("boton-subir");
const galeria = document.getElementById("galeria");
const mensajeVacio = document.getElementById("vacio");
const estado = document.getElementById("estado");

// ---------- 4. Utilidades ----------
function mostrarEstado(mensaje) {
  estado.textContent = mensaje;
}

function limpiarTexto(texto) {
  let resultado = texto;
  PALABRAS_PROHIBIDAS.forEach(function (palabra) {
    resultado = resultado.replace(new RegExp(palabra, "gi"), "***");
  });
  return resultado;
}

// Crea un elemento HTML. Usamos textContent (no innerHTML)
// para que nadie pueda meter código malicioso en un comentario.
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto) elemento.textContent = texto;
  return elemento;
}

// Reduce la foto antes de enviarla (más rápido y ocupa menos).
function reducirImagen(archivo, ladoMaximo, cuandoTermine) {
  const lector = new FileReader();
  lector.onload = function () {
    const imagen = new Image();
    imagen.onload = function () {
      const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(imagen.width * escala);
      lienzo.height = Math.round(imagen.height * escala);
      lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      cuandoTermine(lienzo.toDataURL("image/jpeg", 0.7));
    };
    imagen.src = lector.result;
  };
  lector.readAsDataURL(archivo);
}

// ---------- 5. Leer datos de la nube ----------
async function cargarFotos() {
  // Pide las fotos junto con sus comentarios y votos.
  const respuesta = await db
    .from("fotos")
    .select("*, comentarios(*), votos(*)")
    .order("creada", { ascending: false });

  if (respuesta.error) {
    console.error(respuesta.error);
    mostrarEstado("No se pudieron cargar las fotos. Revisa tu conexión.");
    return;
  }

  fotos = respuesta.data;
  dibujar();
}

// ---------- 6. Dibujar la galería ----------
function dibujar() {
  galeria.replaceChildren();
  mensajeVacio.hidden = fotos.length > 0;

  fotos.forEach(function (foto) {
    galeria.appendChild(crearTarjeta(foto));
  });
}

function crearTarjeta(foto) {
  const tarjeta = crear("article", "tarjeta");

  const imagen = document.createElement("img");
  imagen.src = foto.imagen;
  imagen.alt = foto.titulo;
  tarjeta.appendChild(imagen);

  tarjeta.appendChild(crear("h3", "", foto.titulo));

  // --- Estrellas ---
  const cantidad = foto.votos.length;
  const suma = foto.votos.reduce(function (total, voto) {
    return total + voto.estrellas;
  }, 0);
  const promedio = cantidad > 0 ? suma / cantidad : 0;
  const miVoto = foto.votos.find(function (voto) {
    return voto.votante === votante;
  });

  const filaEstrellas = crear("div", "estrellas");
  for (let numero = 1; numero <= 5; numero++) {
    const boton = crear("button", "estrella", "★");
    boton.type = "button";
    boton.setAttribute("aria-label", "Calificar con " + numero + " estrellas");
    if (numero <= Math.round(promedio)) boton.classList.add("llena");
    boton.addEventListener("click", function () {
      votar(foto, numero, miVoto);
    });
    filaEstrellas.appendChild(boton);
  }
  tarjeta.appendChild(filaEstrellas);

  let textoResumen = "Aún sin calificaciones";
  if (cantidad > 0) {
    textoResumen = "Promedio " + promedio.toFixed(1) + " (" + cantidad + " votos)";
    if (miVoto) textoResumen += " · Tu voto: " + miVoto.estrellas;
  }
  tarjeta.appendChild(crear("p", "resumen", textoResumen));

  // --- Comentarios (los más antiguos primero) ---
  const lista = crear("ul", "comentarios");
  foto.comentarios
    .slice()
    .sort(function (a, b) {
      return a.creado.localeCompare(b.creado);
    })
    .forEach(function (comentario) {
      const item = document.createElement("li");
      item.appendChild(crear("strong", "", comentario.nombre));
      item.appendChild(document.createTextNode(comentario.texto));
      lista.appendChild(item);
    });
  tarjeta.appendChild(lista);

  // --- Formulario para comentar ---
  const formulario = crear("form", "form-comentario");

  const campoNombre = document.createElement("input");
  campoNombre.type = "text";
  campoNombre.placeholder = "Tu nombre o apodo";
  campoNombre.maxLength = 20;
  campoNombre.required = true;
  campoNombre.setAttribute("aria-label", "Tu nombre");

  const campoTexto = document.createElement("input");
  campoTexto.type = "text";
  campoTexto.placeholder = "Escribe tu reseña";
  campoTexto.maxLength = 150;
  campoTexto.required = true;
  campoTexto.setAttribute("aria-label", "Tu reseña");

  const botonEnviar = crear("button", "", "Comentar");
  botonEnviar.type = "submit";

  formulario.append(campoNombre, campoTexto, botonEnviar);
  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();
    comentar(foto, campoNombre.value.trim(), campoTexto.value.trim(), botonEnviar);
  });
  tarjeta.appendChild(formulario);

  return tarjeta;
}

// ---------- 7. Escribir datos en la nube ----------
async function votar(foto, estrellas, miVoto) {
  if (miVoto) {
    mostrarEstado("Ya calificaste esta foto.");
    return;
  }

  const respuesta = await db.from("votos").insert({
    foto_id: foto.id,
    votante: votante,
    estrellas: estrellas
  });

  if (respuesta.error) {
    console.error(respuesta.error);
    mostrarEstado("No se pudo guardar tu voto. Intenta de nuevo.");
    return;
  }

  mostrarEstado("");
  cargarFotos();
}

async function comentar(foto, nombre, texto, boton) {
  if (!nombre || !texto) return;

  boton.disabled = true;
  const respuesta = await db.from("comentarios").insert({
    foto_id: foto.id,
    nombre: limpiarTexto(nombre),
    texto: limpiarTexto(texto)
  });
  boton.disabled = false;

  if (respuesta.error) {
    console.error(respuesta.error);
    mostrarEstado("No se pudo enviar tu comentario. Intenta de nuevo.");
    return;
  }

  mostrarEstado("");
  cargarFotos();
}

formularioFoto.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const archivo = campoArchivo.files[0];
  const titulo = limpiarTexto(campoTitulo.value.trim());
  if (!archivo || !titulo) return;

  botonSubir.disabled = true;
  mostrarEstado("Enviando foto...");

  reducirImagen(archivo, 800, async function (imagenReducida) {
    const respuesta = await db.from("fotos").insert({
      titulo: titulo,
      imagen: imagenReducida
    });
    botonSubir.disabled = false;

    if (respuesta.error) {
      console.error(respuesta.error);
      mostrarEstado("No se pudo enviar la foto. Intenta con otra más pequeña.");
      return;
    }

    formularioFoto.reset();
    mostrarEstado("¡Foto enviada! Aparecerá cuando un profesor la apruebe.");
  });
});

// ---------- 8. Arranque ----------
cargarFotos();
