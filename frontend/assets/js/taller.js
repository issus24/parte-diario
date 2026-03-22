import { getPartes, getParte, getEstados, actualizarEstadoDesperfecto } from './api.js';

let fechaSeleccionada = new Date();
let estadosDisponibles = [];
let partesDelDia = [];
let otrosPendientes = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        estadosDisponibles = await getEstados();
    } catch (err) {
        console.error('Error cargando estados:', err);
    }
    actualizarFechaDisplay();
    cargarDatos();
});

function formatFecha(date) {
    return date.toISOString().split('T')[0];
}

function formatFechaDisplay(date) {
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let texto = date.toLocaleDateString('es-AR', opciones);
    // Capitalizar primera letra
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function actualizarFechaDisplay() {
    const hoy = formatFecha(new Date());
    const sel = formatFecha(fechaSeleccionada);
    let texto = formatFechaDisplay(fechaSeleccionada);
    if (sel === hoy) texto += ' (Hoy)';
    document.getElementById('fecha-display').textContent = texto;
}

window.cambiarFecha = function(delta) {
    fechaSeleccionada.setDate(fechaSeleccionada.getDate() + delta);
    actualizarFechaDisplay();
    cargarDatos();
};

window.irAHoy = function() {
    fechaSeleccionada = new Date();
    actualizarFechaDisplay();
    cargarDatos();
};

async function cargarDatos() {
    const container = document.getElementById('vehiculos-container');
    container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

    try {
        const fecha = formatFecha(fechaSeleccionada);

        // Cargar partes del dia y pendientes en paralelo
        const [delDia, pendientes] = await Promise.all([
            getPartes({ fecha_citacion: fecha }),
            getPartes({ alta: false })
        ]);

        // Obtener detalle completo de cada parte del dia
        partesDelDia = await Promise.all(delDia.map(p => getParte(p.id)));

        // Otros pendientes = no del dia actual y sin alta
        otrosPendientes = pendientes.filter(p =>
            p.fecha_citacion !== fecha && !p.alta
        );

        actualizarStatsTaller();
        renderVehiculos();
        renderOtrosPendientes();
    } catch (err) {
        console.error('Error cargando datos:', err);
        container.innerHTML = '<div class="empty-state"><p>Error al cargar datos</p></div>';
    }
}

function actualizarStatsTaller() {
    const totalDesp = partesDelDia.reduce((sum, p) => sum + p.desperfectos.length, 0);
    const resueltos = partesDelDia.reduce((sum, p) =>
        sum + p.desperfectos.filter(d => esResolutivo(d.estado)).length, 0);
    const altas = partesDelDia.filter(p => p.alta).length;

    document.getElementById('stat-vehiculos').textContent = partesDelDia.length;
    document.getElementById('stat-desperfectos').textContent = totalDesp;
    document.getElementById('stat-resueltos').textContent = resueltos;
    document.getElementById('stat-altas').textContent = altas;
}

function esResolutivo(estadoNombre) {
    const estado = estadosDisponibles.find(e => e.nombre === estadoNombre);
    return estado ? estado.es_resolutivo : false;
}

function getColorEstado(estadoNombre) {
    const estado = estadosDisponibles.find(e => e.nombre === estadoNombre);
    return estado ? estado.color : 'muted';
}

function renderVehiculos() {
    const container = document.getElementById('vehiculos-container');

    if (partesDelDia.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>&#128197; No hay vehiculos citados para este dia</p>
            </div>`;
        return;
    }

    container.innerHTML = partesDelDia.map(parte => {
        const altaClass = parte.alta ? ' alta' : '';
        const despHtml = parte.desperfectos.map(d => renderDesperfectoItem(d)).join('');

        return `
            <div class="vehiculo-card${altaClass}">
                <div class="vehiculo-header">
                    <div>
                        <span class="patente">${parte.patente}</span>
                        ${parte.alta ? '<span class="badge badge-success" style="margin-left:0.5rem;">ALTA</span>' : ''}
                    </div>
                    <div class="info">
                        ${parte.chofer} | ${parte.km ? parte.km + ' km' : ''} | ${parte.n_parte}
                    </div>
                </div>
                <ul class="desperfecto-list">
                    ${despHtml}
                </ul>
            </div>`;
    }).join('');
}

function renderDesperfectoItem(desp) {
    const sectorClass = desp.sector.toLowerCase();
    const colorEstado = getColorEstado(desp.estado);
    const selectOptions = estadosDisponibles.map(e =>
        `<option value="${e.nombre}" ${e.nombre === desp.estado ? 'selected' : ''}>${e.nombre}</option>`
    ).join('');

    return `
        <li class="desperfecto-item" id="desp-${desp.id}">
            <div class="desperfecto-info">
                <span class="badge badge-${sectorClass}">${desp.sector}</span>
                <span class="badge badge-${colorEstado}" style="margin-left:0.25rem;">${desp.estado}</span>
                <div class="descripcion">${desp.descripcion}</div>
                ${desp.notas ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.2rem;">&#128221; ${desp.notas}</div>` : ''}
            </div>
            <div class="desperfecto-actions">
                <select class="form-control" onchange="cambiarEstado(${desp.id}, this.value)" style="min-width:160px;">
                    ${selectOptions}
                </select>
                <button class="btn btn-outline btn-sm" onclick="agregarNota(${desp.id})" title="Agregar nota">&#128221;</button>
            </div>
        </li>`;
}

window.cambiarEstado = async function(desperfectoId, nuevoEstado) {
    try {
        await actualizarEstadoDesperfecto(desperfectoId, nuevoEstado);
        await cargarDatos(); // Recargar para ver cambios y auto-alta
    } catch (err) {
        alert('Error al actualizar: ' + err.message);
    }
};

window.agregarNota = async function(desperfectoId) {
    const nota = prompt('Nota para este desperfecto:');
    if (nota === null) return;

    try {
        // Buscar el estado actual
        let estadoActual = 'Pendiente';
        for (const parte of partesDelDia) {
            const desp = parte.desperfectos.find(d => d.id === desperfectoId);
            if (desp) { estadoActual = desp.estado; break; }
        }
        await actualizarEstadoDesperfecto(desperfectoId, estadoActual, nota);
        await cargarDatos();
    } catch (err) {
        alert('Error al guardar nota: ' + err.message);
    }
};

// --- OTROS PENDIENTES ---
function renderOtrosPendientes() {
    const btnPendientes = document.getElementById('btn-pendientes');
    const container = document.getElementById('otros-pendientes');

    if (otrosPendientes.length === 0) {
        btnPendientes.style.display = 'none';
        container.style.display = 'none';
        return;
    }

    btnPendientes.style.display = 'inline-flex';
    btnPendientes.textContent = `▼ Ver otros partes pendientes (${otrosPendientes.length})`;

    container.innerHTML = `
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>N Parte</th>
                            <th>Patente</th>
                            <th>Chofer</th>
                            <th>Desp.</th>
                            <th>Citado para</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${otrosPendientes.map(p => `
                            <tr>
                                <td>${p.n_parte}</td>
                                <td style="font-family:monospace; font-weight:600;">${p.patente}</td>
                                <td>${p.chofer}</td>
                                <td>${p.cant_resueltos}/${p.cant_desperfectos}</td>
                                <td>${p.fecha_citacion ? new Date(p.fecha_citacion + 'T12:00:00').toLocaleDateString('es-AR') : 'Sin citar'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

window.togglePendientes = function() {
    const container = document.getElementById('otros-pendientes');
    const visible = container.style.display !== 'none';
    container.style.display = visible ? 'none' : 'block';
};
