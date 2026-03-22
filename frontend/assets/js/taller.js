import { getPartes, getParte, getEstados, actualizarParte, actualizarEstadoDesperfecto } from './api.js';

let estadosDisponibles = [];
let partesActivas = [];
let partesOperativas = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        estadosDisponibles = await getEstados();
    } catch (err) {
        console.error('Error cargando estados:', err);
    }

    document.getElementById('filtro-dominio').addEventListener('input', renderUnidades);
    document.getElementById('filtro-taller-box').addEventListener('change', renderUnidades);

    cargarDatos();
});

async function cargarDatos() {
    const container = document.getElementById('unidades-container');
    container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

    try {
        const todas = await getPartes();

        // Separar activas vs operativas
        partesActivas = todas.filter(p => p.estado !== 'Operativo');
        partesOperativas = todas.filter(p => p.estado === 'Operativo');

        // Cargar detalle completo de las activas
        partesActivas = await Promise.all(partesActivas.map(p => getParte(p.id)));

        actualizarStats();
        renderUnidades();
        renderOperativos();
    } catch (err) {
        console.error('Error cargando datos:', err);
        container.innerHTML = '<div class="empty-state"><p>Error al cargar datos</p></div>';
    }
}

function actualizarStats() {
    const total = partesActivas.length;
    const pendientes = partesActivas.filter(p => p.estado === 'Pendiente').length;
    const enProceso = partesActivas.filter(p => p.estado === 'En Proceso').length;
    const operativos = partesOperativas.length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pendientes').textContent = pendientes;
    document.getElementById('stat-en-proceso').textContent = enProceso;
    document.getElementById('stat-operativos').textContent = operativos;
}

function getColorEstado(estadoNombre) {
    const estado = estadosDisponibles.find(e => e.nombre === estadoNombre);
    return estado ? estado.color : 'muted';
}

function renderUnidades() {
    const filtroDominio = document.getElementById('filtro-dominio').value.toUpperCase();
    const filtroBox = document.getElementById('filtro-taller-box').value;
    const container = document.getElementById('unidades-container');

    let datos = partesActivas;
    if (filtroDominio) datos = datos.filter(p => p.dominio.toUpperCase().includes(filtroDominio));
    if (filtroBox) datos = datos.filter(p => p.taller_box === filtroBox);

    if (datos.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay unidades activas en taller</p></div>';
        return;
    }

    container.innerHTML = datos.map(parte => {
        const colorEstado = getColorEstado(parte.estado);
        const tipoRepBadge = parte.tipo_reparacion === 'PROFUNDA' ? 'danger'
            : parte.tipo_reparacion === 'LENTA' ? 'warning' : 'info';
        const tallerDisplay = parte.tipo_taller === 'EXTERNO' && parte.taller_externo
            ? `EXTERNO - ${parte.taller_externo}` : (parte.taller_box || '-');

        const selectEstado = estadosDisponibles.map(e =>
            `<option value="${e.nombre}" ${e.nombre === parte.estado ? 'selected' : ''}>${e.nombre}</option>`
        ).join('');

        // Desperfectos si los tiene
        const despHtml = parte.desperfectos && parte.desperfectos.length > 0
            ? `<div class="desperfectos-section">
                <div style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); padding:0.5rem 1.25rem; text-transform:uppercase;">Desperfectos</div>
                <ul class="desperfecto-list">${parte.desperfectos.map(d => renderDesperfecto(d)).join('')}</ul>
               </div>`
            : '';

        return `
            <div class="vehiculo-card">
                <div class="vehiculo-header">
                    <div>
                        <span class="patente">${parte.dominio}</span>
                        <span class="badge badge-${tipoRepBadge}" style="margin-left:0.5rem;">${parte.tipo_reparacion}</span>
                        <span class="badge badge-${colorEstado}" style="margin-left:0.25rem;">${parte.estado}</span>
                    </div>
                    <div class="info">
                        ${parte.operacion} | ${tallerDisplay} | ${parte.n_parte}
                    </div>
                </div>
                <div style="padding:0.75rem 1.25rem;">
                    <div style="font-size:0.9rem; margin-bottom:0.5rem;">${parte.novedad}</div>
                    ${parte.observaciones ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.5rem;">&#128221; ${parte.observaciones}</div>` : ''}
                    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                        <select class="form-control" onchange="cambiarEstadoParte(${parte.id}, this.value)" style="width:180px; font-size:0.85rem;">
                            ${selectEstado}
                        </select>
                        <button class="btn btn-outline btn-sm" onclick="editarObservaciones(${parte.id})">&#128221; Observaciones</button>
                    </div>
                </div>
                ${despHtml}
            </div>`;
    }).join('');
}

function renderDesperfecto(desp) {
    const sectorClass = desp.sector.toLowerCase().replace('/', '-');
    const colorEstado = getColorEstado(desp.estado);
    const selectOptions = estadosDisponibles.map(e =>
        `<option value="${e.nombre}" ${e.nombre === desp.estado ? 'selected' : ''}>${e.nombre}</option>`
    ).join('');

    return `
        <li class="desperfecto-item">
            <div class="desperfecto-info">
                <span class="badge badge-${sectorClass}">${desp.sector}</span>
                <span class="badge badge-${colorEstado}" style="margin-left:0.25rem;">${desp.estado}</span>
                <div class="descripcion">${desp.descripcion}</div>
                ${desp.notas ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.2rem;">&#128221; ${desp.notas}</div>` : ''}
            </div>
            <div class="desperfecto-actions">
                <select class="form-control" onchange="cambiarEstadoDesp(${desp.id}, this.value)" style="min-width:150px;">
                    ${selectOptions}
                </select>
                <button class="btn btn-outline btn-sm" onclick="agregarNota(${desp.id})" title="Agregar nota">&#128221;</button>
            </div>
        </li>`;
}

window.cambiarEstadoParte = async function(parteId, nuevoEstado) {
    try {
        await actualizarParte(parteId, { estado: nuevoEstado });
        await cargarDatos();
    } catch (err) {
        alert('Error al actualizar: ' + err.message);
    }
};

window.cambiarEstadoDesp = async function(desperfectoId, nuevoEstado) {
    try {
        await actualizarEstadoDesperfecto(desperfectoId, nuevoEstado);
        await cargarDatos();
    } catch (err) {
        alert('Error al actualizar: ' + err.message);
    }
};

window.agregarNota = async function(desperfectoId) {
    const nota = prompt('Nota para este desperfecto:');
    if (nota === null) return;

    try {
        let estadoActual = 'Pendiente';
        for (const parte of partesActivas) {
            if (parte.desperfectos) {
                const desp = parte.desperfectos.find(d => d.id === desperfectoId);
                if (desp) { estadoActual = desp.estado; break; }
            }
        }
        await actualizarEstadoDesperfecto(desperfectoId, estadoActual, nota);
        await cargarDatos();
    } catch (err) {
        alert('Error al guardar nota: ' + err.message);
    }
};

window.editarObservaciones = async function(parteId) {
    const parte = partesActivas.find(p => p.id === parteId);
    const obs = prompt('Observaciones:', parte?.observaciones || '');
    if (obs === null) return;

    try {
        await actualizarParte(parteId, { observaciones: obs });
        await cargarDatos();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

// --- OPERATIVOS ---
function renderOperativos() {
    const btn = document.getElementById('btn-operativos');
    const container = document.getElementById('operativos-container');

    if (partesOperativas.length === 0) {
        btn.style.display = 'none';
        container.style.display = 'none';
        return;
    }

    btn.style.display = 'inline-flex';
    btn.innerHTML = `&#9660; Ver unidades operativas (${partesOperativas.length})`;

    container.innerHTML = `
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>N&#176;</th>
                            <th>Dominio</th>
                            <th>Novedad</th>
                            <th>Taller/Box</th>
                            <th>T. Rep.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${partesOperativas.map(p => `
                            <tr>
                                <td>${p.n_parte}</td>
                                <td style="font-family:monospace; font-weight:600;">${p.dominio}</td>
                                <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                                    title="${(p.novedad || '').replace(/"/g, '&quot;')}">${p.novedad || '-'}</td>
                                <td>${p.taller_box || '-'}</td>
                                <td>${p.tipo_reparacion || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

window.toggleOperativos = function() {
    const container = document.getElementById('operativos-container');
    const visible = container.style.display !== 'none';
    container.style.display = visible ? 'none' : 'block';
};
