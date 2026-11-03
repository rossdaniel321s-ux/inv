"use strict";

const CLAVE = "inventario_productos";
const SEMILLA = [
  {
    id: 1,
    codigo_barras: "1234567890123",
    nombre: "Laptop HP Pavilion",
    categoria: "Electrónicos",
    descripcion: 'Laptop HP Pavilion 15" con 8GB RAM',
    stock: 10,
    valor: 599.99,
    stock_minimo: 3,
  },
  {
    id: 2,
    codigo_barras: "2345678901234",
    nombre: "Camiseta Básica",
    categoria: "Ropa",
    descripcion: "Camiseta de alta gama en algodón",
    stock: 50,
    valor: 29.99,
    stock_minimo: 10,
  },
  {
    id: 3,
    codigo_barras: "3456789012345",
    nombre: "Silla Oficina",
    categoria: "Hogar",
    descripcion: "Silla ergonómica para oficina",
    stock: 8,
    valor: 199.99,
    stock_minimo: 3,
  },
];

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dinero = (n) =>
  Number(n).toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function cargarDatos() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE));
    if (Array.isArray(d)) {
      return d
        .filter((p) => p && typeof p === "object")
        .map((p, i) => ({
          id: Number(p.id) || i + 1,
          codigo_barras: String(p.codigo_barras || ""),
          nombre: String(p.nombre || "Sin nombre"),
          categoria: String(p.categoria || "Accesorios"),
          descripcion: String(p.descripcion || ""),
          stock: Math.max(0, parseInt(p.stock) || 0),
          valor: Math.max(0, parseFloat(p.valor) || 0),
          stock_minimo: Math.max(0, parseInt(p.stock_minimo) || 0),
          proveedor: String(p.proveedor || ""),
          ubicacion: String(p.ubicacion || ""),
          vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(p.vencimiento)
            ? p.vencimiento
            : "",
        }));
    }
  } catch (e) {
    /* datos corruptos: se usan los de ejemplo */
  }
  return JSON.parse(JSON.stringify(SEMILLA));
}

let productos = cargarDatos();
let proximoId = productos.reduce((m, p) => Math.max(m, p.id), 0) + 1;
let html5QrCode = null;
let html5QrCodeModal = null;
let idAEliminar = null;

function guardarEnLocalStorage() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(productos));
  } catch (e) {
    mostrarNotificacion(
      "No se pudo guardar (almacenamiento lleno o bloqueado)",
      "error",
    );
  }
}

function mostrarNotificacion(mensaje, tipo, accion) {
  const div = document.createElement("div");
  div.className = `notificacion ${tipo}`;
  div.textContent = mensaje;
  if (accion) {
    const b = document.createElement("button");
    b.textContent = accion.texto;
    b.onclick = () => {
      accion.fn();
      div.remove();
    };
    div.appendChild(b);
  }
  document.body.appendChild(div);
  const n = document.querySelectorAll(".notificacion").length - 1;
  div.style.top = 20 + n * 52 + "px";
  setTimeout(() => div.remove(), accion ? 7000 : 3000);
}

// ---------- Navegación ----------
function mostrarTab(tab) {
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelectorAll(".tab-button")
    .forEach((t) => t.classList.remove("active"));
  $(`content-${tab}`).classList.add("active");
  $(`tab-${tab}`).classList.add("active");
  if (tab !== "scanner") detenerScanner();
  if (tab === "productos") cargarProductos();
  if (tab === "dashboard") renderDashboard();
  if (tab === "movimientos") renderMovimientos();
}

// ---------- Tabla ----------
function cargarProductos() {
  const termino = $("buscarProducto").value.trim().toLowerCase();
  const cat = $("filtroCategoria").value;
  const orden = $("ordenProductos").value;

  let lista = productos.filter(
    (p) =>
      (!cat || p.categoria === cat) &&
      (!termino ||
        [
          p.id,
          p.codigo_barras,
          p.nombre,
          p.categoria,
          p.descripcion,
          p.proveedor,
          p.ubicacion,
        ]
          .join(" ")
          .toLowerCase()
          .includes(termino)),
  );

  const ord =
    {
      id: (a, b) => a.id - b.id,
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
      stock: (a, b) => a.stock - b.stock,
      valor: (a, b) => b.valor - a.valor,
    }[orden] || ((a, b) => a.id - b.id);
  lista.sort(ord);

  const tbody = $("tablaProductos");
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${productos.length ? "Sin resultados para el filtro actual" : "No hay productos. Agrega el primero."}</td></tr>`;
  } else {
    tbody.innerHTML = lista
      .map((p) => {
        const bajo = p.stock <= p.stock_minimo;
        return `<tr>
                <td>${p.id}</td>
                <td class="mono">${esc(p.codigo_barras) || "N/A"}</td>
                <td title="${esc(p.descripcion)}">${esc(p.nombre)}${p.proveedor || p.ubicacion ? `<small class="sub">${esc(p.proveedor)}${p.proveedor && p.ubicacion ? " · " : ""}${p.ubicacion ? "📍" + esc(p.ubicacion) : ""}</small>` : ""}${vencHtml(p)}</td>
                <td>${esc(p.categoria)}</td>
                <td class="${bajo ? "stock-low" : ""}">
                    <span class="stock-ctrl">
                        <button class="btn-mini" data-accion="menos" data-id="${p.id}" aria-label="Restar 1">−</button>
                        <span>${p.stock}</span>
                        <button class="btn-mini" data-accion="mas" data-id="${p.id}" aria-label="Sumar 1">+</button>
                    </span>${bajo ? " <small>⚠ bajo</small>" : ""}
                </td>
                <td>$${dinero(p.valor)}</td>
                <td>
                    <button data-accion="etiqueta" data-id="${p.id}" class="btn btn-secondary btn-sm" title="Imprimir etiqueta" aria-label="Imprimir etiqueta">&#x1F3F7;</button>
                    <button data-accion="mov" data-id="${p.id}" class="btn btn-warning btn-sm">&#x21C5; Mov.</button>
                    <button data-accion="editar" data-id="${p.id}" class="btn btn-primary btn-sm">&#x1F4DD; Editar</button>
                    <button data-accion="eliminar" data-id="${p.id}" class="btn btn-danger btn-sm">&#x274C; Eliminar</button>
                </td></tr>`;
      })
      .join("");
  }
  actualizarEstadisticas();
}

function buscarProductos() {
  cargarProductos();
}

function actualizarEstadisticas() {
  $("totalProductos").textContent = productos.length;
  $("valorTotal").textContent = dinero(
    productos.reduce((t, p) => t + p.stock * p.valor, 0),
  );
  $("totalBajo").textContent = productos.filter(
    (p) => p.stock <= p.stock_minimo,
  ).length;
}

function ajustarStock(id, delta) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  const nuevo = Math.max(0, p.stock + delta);
  if (nuevo === p.stock) return;
  const antes = p.stock;
  p.stock = nuevo;
  registrarMov(p, "ajuste", nuevo - antes, "Ajuste rápido");
  guardarEnLocalStorage();
  cargarProductos();
}

// ---------- Validación ----------
function validar(d, idIgnorar) {
  if (!d.nombre) return "El nombre es obligatorio";
  if (!Number.isInteger(d.stock) || d.stock < 0)
    return "El stock debe ser un entero mayor o igual a 0";
  if (!Number.isFinite(d.valor) || d.valor < 0)
    return "El precio debe ser mayor o igual a 0";
  if (!Number.isInteger(d.stock_minimo) || d.stock_minimo < 0)
    return "El stock mínimo no es válido";
  if (
    d.codigo_barras &&
    productos.some(
      (p) => p.codigo_barras === d.codigo_barras && p.id !== idIgnorar,
    )
  )
    return "El código de barras ya existe";
  return null;
}

// ---------- Agregar ----------
$("formProducto").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = {
    id: proximoId,
    codigo_barras: $("codigoBarras").value.trim(),
    nombre: $("nombreProducto").value.trim(),
    categoria: $("categoriaProducto").value,
    descripcion: $("descripcionProducto").value.trim(),
    stock: Number($("stockProducto").value),
    valor: Number($("precioProducto").value),
    stock_minimo: Number(
      $("stockMinimo").value === "" ? 0 : $("stockMinimo").value,
    ),
    proveedor: $("proveedorProducto").value.trim(),
    ubicacion: $("ubicacionProducto").value.trim(),
    vencimiento: $("vencimientoProducto").value,
  };
  const error = validar(d, null);
  if (error) return mostrarNotificacion(error, "error");
  proximoId++;
  productos.push(d);
  registrarMov(d, "inicial", d.stock, "Stock inicial");
  guardarEnLocalStorage();
  mostrarNotificacion("Producto agregado correctamente", "success");
  limpiarFormulario();
  mostrarTab("productos");
});

function limpiarFormulario() {
  $("formProducto").reset();
  $("stockMinimo").value = 5;
}

// ---------- Editar / Eliminar ----------
function editarProducto(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  $("editarId").value = p.id;
  $("editarCodigo").value = p.codigo_barras;
  $("editarNombre").value = p.nombre;
  $("editarCategoria").value = p.categoria;
  $("editarStock").value = p.stock;
  $("editarPrecio").value = p.valor;
  $("editarMinimo").value = p.stock_minimo;
  $("editarDescripcion").value = p.descripcion;
  $("editarProveedor").value = p.proveedor;
  $("editarUbicacion").value = p.ubicacion;
  $("editarVencimiento").value = p.vencimiento;
  $("modalEditar").classList.add("show");
}

function guardarEdicion() {
  const id = parseInt($("editarId").value);
  const p = productos.find((x) => x.id === id);
  if (!p) return cerrarModal();
  const d = {
    codigo_barras: $("editarCodigo").value.trim(),
    nombre: $("editarNombre").value.trim(),
    categoria: $("editarCategoria").value,
    descripcion: $("editarDescripcion").value.trim(),
    stock: Number($("editarStock").value),
    valor: Number($("editarPrecio").value),
    stock_minimo: Number(
      $("editarMinimo").value === "" ? 0 : $("editarMinimo").value,
    ),
    proveedor: $("editarProveedor").value.trim(),
    ubicacion: $("editarUbicacion").value.trim(),
    vencimiento: $("editarVencimiento").value,
  };
  const error = validar(d, id);
  if (error) return mostrarNotificacion(error, "error");
  const antes = p.stock;
  Object.assign(p, d);
  if (antes !== p.stock)
    registrarMov(p, "ajuste", p.stock - antes, "Edición manual");
  guardarEnLocalStorage();
  cerrarModal();
  cargarProductos();
  mostrarNotificacion("Producto actualizado", "success");
}

function cerrarModal() {
  $("modalEditar").classList.remove("show");
}

function eliminarProducto(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  idAEliminar = id;
  $("textoEliminar").textContent = `¿Seguro que deseas eliminar "${p.nombre}"?`;
  $("modalEliminar").classList.add("show");
}

function confirmarEliminar() {
  if (idAEliminar === null) return;
  const borrado = productos.find((p) => p.id === idAEliminar);
  productos = productos.filter((p) => p.id !== idAEliminar);
  guardarEnLocalStorage();
  cerrarModalEliminar();
  cargarProductos();
  mostrarNotificacion("Producto eliminado", "success", {
    texto: "Deshacer",
    fn: () => {
      if (!borrado || productos.some((p) => p.id === borrado.id)) return;
      productos.push(borrado);
      guardarEnLocalStorage();
      cargarProductos();
    },
  });
}

function cerrarModalEliminar() {
  idAEliminar = null;
  $("modalEliminar").classList.remove("show");
}

// ---------- Exportar CSV ----------
function exportarCSV() {
  if (!productos.length)
    return mostrarNotificacion("No hay productos para exportar", "error");
  const cab = [
    "ID",
    "Código",
    "Nombre",
    "Categoría",
    "Descripción",
    "Stock",
    "Stock mínimo",
    "Precio",
    "Valor total",
    "Proveedor",
    "Ubicación",
    "Vencimiento",
  ];
  const celda = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const filas = productos.map((p) =>
    [
      p.id,
      p.codigo_barras,
      p.nombre,
      p.categoria,
      p.descripcion,
      p.stock,
      p.stock_minimo,
      p.valor,
      (p.stock * p.valor).toFixed(2),
      p.proveedor,
      p.ubicacion,
      p.vencimiento,
    ]
      .map(celda)
      .join(","),
  );
  const blob = new Blob(
    ["\uFEFF" + [cab.map(celda).join(","), ...filas].join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Escáner ----------
function escanerDisponible() {
  if (typeof Html5Qrcode === "undefined") {
    mostrarNotificacion(
      "El escáner no se pudo cargar (revisa tu conexión)",
      "error",
    );
    return false;
  }
  return true;
}

function buscarProductoPorCodigo() {
  const codigo = $("codigoEscaneado").textContent.trim();
  if (!codigo) return mostrarNotificacion("Primero escanea un código", "error");
  if (productos.some((p) => p.codigo_barras === codigo)) {
    $("filtroCategoria").value = "";
    $("buscarProducto").value = codigo;
    mostrarTab("productos");
    mostrarNotificacion("Producto encontrado", "success");
  } else {
    mostrarNotificacion(
      "Producto no encontrado. Puedes agregarlo ahora",
      "error",
    );
    $("codigoBarras").value = codigo;
    mostrarTab("agregar");
  }
}

function iniciarScanner() {
  if (html5QrCode || !escanerDisponible()) return;
  const lector = new Html5Qrcode("reader");
  html5QrCode = lector;
  lector
    .start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (codigo) => {
      $("codigoEscaneado").textContent = codigo;
      detenerScanner();
      buscarProductoPorCodigo();
    })
    .catch(() => {
      if (html5QrCode === lector) html5QrCode = null;
      mostrarNotificacion("No se pudo acceder a la cámara", "error");
    });
}

function detenerScanner() {
  if (!html5QrCode) return;
  const s = html5QrCode;
  html5QrCode = null;
  Promise.resolve()
    .then(() => s.stop())
    .then(() => s.clear())
    .catch(() => {});
}

function abrirScannerRapido() {
  if (html5QrCodeModal || !escanerDisponible()) return;
  $("modalScanner").classList.add("show");
  const lector = new Html5Qrcode("readerModal");
  html5QrCodeModal = lector;
  lector
    .start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (codigo) => {
      $("codigoBarras").value = codigo;
      cerrarScannerRapido();
    })
    .catch(() => {
      if (html5QrCodeModal === lector) html5QrCodeModal = null;
      $("modalScanner").classList.remove("show");
      mostrarNotificacion("No se pudo acceder a la cámara", "error");
    });
}

function cerrarScannerRapido() {
  $("modalScanner").classList.remove("show");
  if (!html5QrCodeModal) return;
  const s = html5QrCodeModal;
  html5QrCodeModal = null;
  Promise.resolve()
    .then(() => s.stop())
    .then(() => s.clear())
    .catch(() => {});
}

// ---------- Movimientos (kardex) ----------
const CLAVE_MOV = "inventario_movimientos";
const ETIQ = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  inicial: "Inicial",
};
let movimientos = (() => {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_MOV));
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
})();

function registrarMov(p, tipo, cant, motivo) {
  movimientos.unshift({
    fecha: new Date().toISOString(),
    id: p.id,
    nombre: p.nombre,
    tipo,
    cantidad: cant,
    resultante: p.stock,
    motivo: motivo || "",
  });
  movimientos.length = Math.min(movimientos.length, 500);
  try {
    localStorage.setItem(CLAVE_MOV, JSON.stringify(movimientos));
  } catch (e) {}
}

function abrirMov(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  $("movId").value = id;
  $("movTitulo").textContent = `Movimiento: ${p.nombre} (stock ${p.stock})`;
  $("movTipo").value = "entrada";
  $("movCantidad").value = 1;
  $("movMotivo").value = "";
  $("modalMov").classList.add("show");
}

function aplicarMov() {
  const p = productos.find((x) => x.id === parseInt($("movId").value));
  if (!p) return cerrarMov();
  const cant = Number($("movCantidad").value);
  const tipo = $("movTipo").value;
  if (!Number.isInteger(cant) || cant <= 0)
    return mostrarNotificacion(
      "La cantidad debe ser un entero mayor a 0",
      "error",
    );
  if (tipo === "salida" && cant > p.stock)
    return mostrarNotificacion(
      "No hay stock suficiente para esa salida",
      "error",
    );
  const delta = tipo === "entrada" ? cant : -cant;
  p.stock += delta;
  registrarMov(p, tipo, delta, $("movMotivo").value.trim());
  guardarEnLocalStorage();
  cerrarMov();
  cargarProductos();
  mostrarNotificacion("Movimiento registrado", "success");
}

function cerrarMov() {
  $("modalMov").classList.remove("show");
}

function renderMovimientos() {
  $("tablaMovimientos").innerHTML = movimientos.length
    ? movimientos
        .map((m) => {
          const c = Number(m.cantidad) || 0;
          return `<tr><td>${esc(new Date(m.fecha).toLocaleString("es-CO"))}</td><td>${esc(m.nombre)}</td>
            <td><span class="badge ${esc(m.tipo)}">${esc(ETIQ[m.tipo] || m.tipo)}</span></td>
            <td class="${c < 0 ? "stock-low" : "ok"}">${c > 0 ? "+" : ""}${c}</td><td>${Number(m.resultante) || 0}</td><td>${esc(m.motivo) || "—"}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="6" class="empty">Aún no hay movimientos</td></tr>';
}

function limpiarMovimientos() {
  if (
    !movimientos.length ||
    !confirm("¿Borrar todo el historial de movimientos?")
  )
    return;
  movimientos = [];
  try {
    localStorage.setItem(CLAVE_MOV, "[]");
  } catch (e) {}
  renderMovimientos();
}

// ---------- Resumen ----------
function renderDashboard() {
  const unidades = productos.reduce((t, p) => t + p.stock, 0);
  const valor = productos.reduce((t, p) => t + p.stock * p.valor, 0);
  const reponer = productos.filter((p) => p.stock <= p.stock_minimo);
  const agotados = productos.filter((p) => p.stock === 0).length;
  const porVencer = productos
    .filter((p) => p.vencimiento && diasPara(p.vencimiento) <= 30)
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const porCat = {};
  productos.forEach((p) => {
    porCat[p.categoria] = (porCat[p.categoria] || 0) + p.stock * p.valor;
  });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...cats.map((c) => c[1]), 1);
  const tarj = (t, v, c = "") =>
    `<div class="stat-card ${c}"><span>${t}</span><strong>${v}</strong></div>`;
  const barras = cats
    .map(
      ([c, v]) =>
        `<div class="bar-row"><span>${esc(c)}</span><div class="bar"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></div><b>$${dinero(v)}</b></div>`,
    )
    .join("");
  const filas = reponer
    .slice(0, 10)
    .map(
      (p) =>
        `<tr><td>${esc(p.nombre)}</td><td class="stock-low">${p.stock}</td><td>${p.stock_minimo}</td><td>${Math.max(p.stock_minimo * 2 - p.stock, 1)}</td></tr>`,
    )
    .join("");
  $("dashboard").innerHTML =
    `<div class="cards">${tarj("Productos", productos.length)}${tarj("Unidades en stock", unidades)}${tarj("Valor del inventario", "$" + dinero(valor))}${tarj("Por reponer", reponer.length, reponer.length ? "warn" : "")}${tarj("Agotados", agotados, agotados ? "danger" : "")}${tarj("Por vencer (30 d)", porVencer.length, porVencer.length ? "warn" : "")}</div>
        <div class="dash-grid">
            <div><h3>Valor por categoría</h3>${barras || '<p class="empty">Sin datos</p>'}</div>
            <div><h3>Reposición sugerida</h3>${reponer.length ? `<table class="table"><thead><tr><th>Producto</th><th>Stock</th><th>Mín.</th><th>Pedir</th></tr></thead><tbody>${filas}</tbody></table>` : '<p class="empty">Todo el stock está en niveles correctos ✔</p>'}</div>
            <div><h3>Vencimientos próximos</h3>${
              porVencer.length
                ? `<table class="table"><thead><tr><th>Producto</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${porVencer
                    .slice(0, 10)
                    .map(
                      (p) =>
                        `<tr><td>${esc(p.nombre)}</td><td>${esc(p.vencimiento)}</td><td>${vencHtml(p)}</td></tr>`,
                    )
                    .join("")}</tbody></table>`
                : '<p class="empty">Sin vencimientos en los próximos 30 días ✔</p>'
            }</div>
        </div>`;
}

// ---------- Respaldo y tema ----------
function respaldar() {
  const blob = new Blob(
    [
      JSON.stringify(
        { version: 1, fecha: new Date().toISOString(), productos, movimientos },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `respaldo_inventario_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function restaurar(input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.productos)) throw new Error("formato");
      if (!confirm("Esto reemplazará todos los datos actuales. ¿Continuar?"))
        return;
      localStorage.setItem(CLAVE, JSON.stringify(d.productos));
      localStorage.setItem(
        CLAVE_MOV,
        JSON.stringify(Array.isArray(d.movimientos) ? d.movimientos : []),
      );
      location.reload();
    } catch (e) {
      mostrarNotificacion("Archivo de respaldo no válido", "error");
    } finally {
      input.value = "";
    }
  };
  r.onerror = () => mostrarNotificacion("No se pudo leer el archivo", "error");
  r.readAsText(f);
}

function toggleTema() {
  const t = document.documentElement.dataset.tema === "dark" ? "light" : "dark";
  document.documentElement.dataset.tema = t;
  try {
    localStorage.setItem("inventario_tema", t);
  } catch (e) {}
}

// ---------- Vencimientos, etiquetas, CSV, atajos, sincronización ----------
function diasPara(f) {
  return Math.ceil(
    (new Date(f + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 864e5,
  );
}

function vencHtml(p) {
  if (!p.vencimiento) return "";
  const d = diasPara(p.vencimiento);
  const cls = d < 0 ? "vencido" : d <= 30 ? "por-vencer" : "";
  const txt = d < 0 ? "Vencido" : d <= 30 ? `Vence en ${d} d` : p.vencimiento;
  return `<small class="sub ${cls}">⏳ ${esc(txt)}</small>`;
}

function generarCodigo() {
  let c;
  do {
    const base =
      "2" +
      Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
    const suma = [...base].reduce(
      (t, n, i) => t + Number(n) * (i % 2 ? 3 : 1),
      0,
    );
    c = base + ((10 - (suma % 10)) % 10);
  } while (productos.some((p) => p.codigo_barras === c));
  $("codigoBarras").value = c;
}

function imprimirEtiqueta(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  if (!p.codigo_barras)
    return mostrarNotificacion(
      "Este producto no tiene código de barras",
      "error",
    );
  if (typeof JsBarcode === "undefined")
    return mostrarNotificacion(
      "Generador de etiquetas no disponible (sin conexión)",
      "error",
    );
  const z = $("zonaImpresion");
  z.innerHTML = `<div class="etiqueta"><b>${esc(p.nombre)}</b><svg></svg><span>$${dinero(p.valor)}</span></div>`;
  const formatos = /^\d{13}$/.test(p.codigo_barras)
    ? ["EAN13", "CODE128"]
    : ["CODE128"];
  const ok = formatos.some((f) => {
    try {
      JsBarcode(z.querySelector("svg"), p.codigo_barras, {
        format: f,
        height: 50,
        fontSize: 14,
        margin: 0,
      });
      return true;
    } catch (e) {
      return false;
    }
  });
  if (!ok)
    return mostrarNotificacion("Código no válido para etiqueta", "error");
  document.body.classList.add("imprimiendo-etiqueta");
  window.print();
}
window.addEventListener("afterprint", () =>
  document.body.classList.remove("imprimiendo-etiqueta"),
);

function parsearCSV(t) {
  const filas = [];
  let f = [],
    c = "",
    q = false;
  const cerrar = () => {
    f.push(c);
    c = "";
    if (f.some((x) => x.trim() !== "")) filas.push(f);
    f = [];
  };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          c += '"';
          i++;
        } else q = false;
      } else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";") {
      f.push(c);
      c = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      cerrar();
    } else c += ch;
  }
  cerrar();
  return filas;
}

function importarCSV(input) {
  const archivo = input.files[0];
  if (!archivo) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const norm = (s) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
      const MAPA = {
        codigo: "codigo_barras",
        "codigo de barras": "codigo_barras",
        nombre: "nombre",
        categoria: "categoria",
        descripcion: "descripcion",
        stock: "stock",
        "stock minimo": "stock_minimo",
        precio: "valor",
        valor: "valor",
        proveedor: "proveedor",
        ubicacion: "ubicacion",
        vencimiento: "vencimiento",
      };
      const filas = parsearCSV(String(r.result).replace(/^\uFEFF/, ""));
      if (filas.length < 2) throw new Error("vacío");
      const cols = filas[0].map((h) => MAPA[norm(h)] || null);
      if (!cols.includes("nombre")) throw new Error("sin columna nombre");
      const cats = [...$("categoriaProducto").options].map((o) => o.value);
      let ok = 0,
        omitidos = 0;
      filas.slice(1, 5001).forEach((fila) => {
        const o = {};
        cols.forEach((k, i) => {
          if (k)
            o[k] = String(fila[i] ?? "")
              .trim()
              .replace(/^'(?=[=+\-@])/, "");
        });
        const d = {
          id: proximoId,
          codigo_barras: o.codigo_barras || "",
          nombre: o.nombre || "",
          categoria: cats.includes(o.categoria) ? o.categoria : "Accesorios",
          descripcion: o.descripcion || "",
          stock: Number(o.stock || 0),
          valor: Number((o.valor || "0").replace(",", ".")),
          stock_minimo: Number(o.stock_minimo || 5),
          proveedor: o.proveedor || "",
          ubicacion: o.ubicacion || "",
          vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(o.vencimiento || "")
            ? o.vencimiento
            : "",
        };
        if (validar(d, null)) return omitidos++;
        proximoId++;
        productos.push(d);
        registrarMov(d, "inicial", d.stock, "Importación CSV");
        ok++;
      });
      guardarEnLocalStorage();
      cargarProductos();
      mostrarNotificacion(
        `Importados: ${ok}. Omitidos (inválidos o duplicados): ${omitidos}`,
        ok ? "success" : "error",
      );
    } catch (e) {
      mostrarNotificacion(
        'CSV no válido: necesita una fila de encabezados con "Nombre"',
        "error",
      );
    } finally {
      input.value = "";
    }
  };
  r.onerror = () => mostrarNotificacion("No se pudo leer el archivo", "error");
  r.readAsText(archivo);
}

function iniciarAtajos() {
  const tabs = ["productos", "agregar", "scanner", "dashboard", "movimientos"];
  document.addEventListener("keydown", (e) => {
    if (
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      document.querySelector(".modal.show")
    )
      return;
    if (e.key === "/") {
      e.preventDefault();
      mostrarTab("productos");
      $("buscarProducto").focus();
    } else if (e.key === "n") {
      e.preventDefault();
      mostrarTab("agregar");
      $("nombreProducto").focus();
    } else if (e.key === "d") toggleTema();
    else if (/^[1-5]$/.test(e.key)) mostrarTab(tabs[e.key - 1]);
  });
}

function iniciarSincronizacion() {
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== CLAVE && e.key !== CLAVE_MOV) return;
    productos = cargarDatos();
    proximoId = productos.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE_MOV));
      movimientos = Array.isArray(d) ? d : [];
    } catch (err) {
      movimientos = [];
    }
    const act = document
      .querySelector(".tab-button.active")
      .id.replace("tab-", "");
    if (act !== "scanner" && act !== "agregar") mostrarTab(act);
    mostrarNotificacion("Datos actualizados desde otra pestaña", "success");
  });
}

function registrarSW() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Inicialización ----------
document.addEventListener("DOMContentLoaded", () => {
  // Reutiliza las categorías del formulario en edición y filtro
  const opciones = $("categoriaProducto").innerHTML;
  $("editarCategoria").innerHTML = opciones;
  $("filtroCategoria").innerHTML =
    '<option value="">Todas las categorías</option>' + opciones;

  $("buscarProducto").addEventListener("input", cargarProductos);
  $("filtroCategoria").addEventListener("change", cargarProductos);
  $("ordenProductos").addEventListener("change", cargarProductos);

  $("tablaProductos").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-accion]");
    if (!b) return;
    const id = Number(b.dataset.id);
    ({
      editar: editarProducto,
      eliminar: eliminarProducto,
      mov: abrirMov,
      etiqueta: imprimirEtiqueta,
      mas: (i) => ajustarStock(i, 1),
      menos: (i) => ajustarStock(i, -1),
    })[b.dataset.accion](id);
  });

  // Cerrar modales con clic fuera o Escape
  const cierres = {
    modalEditar: cerrarModal,
    modalEliminar: cerrarModalEliminar,
    modalScanner: cerrarScannerRapido,
    modalMov: cerrarMov,
  };
  Object.entries(cierres).forEach(([id, fn]) =>
    $(id).addEventListener("click", (e) => {
      if (e.target === $(id)) fn();
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") Object.values(cierres).forEach((fn) => fn());
  });

  let tema = null;
  try {
    tema = localStorage.getItem("inventario_tema");
  } catch (e) {}
  document.documentElement.dataset.tema =
    tema ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  iniciarAtajos();
  iniciarSincronizacion();
  registrarSW();
  cargarProductos();
});

window.addEventListener("beforeunload", () => {
  detenerScanner();
  cerrarScannerRapido();
});
