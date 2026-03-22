import { getPartes, actualizarParte, getEstados } from './api.js';

let partes = [];
let estadosDisponibles = [];
let parteEditando = null;
let tabActual = 'internos';

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        estadosDisponibles = await getEstados();
    } catch (err) {
        console.error('Error cargando estados:', err);
    }

    document.getElementById('filtro-dominio').addEventListener('input', renderTabla);
    document.getElementById('filtro-tipo-rep').addEventListener('change', renderTabla);
    document.getElementById('filtro-taller').addEventListener('change', renderTabla);
    document.getElementById('filtro-estado').addEventListener('change', renderTabla);

    cargarDatos();
});

async function cargarDatos() {
    try {
        partes = await getPartes();
        // Solo mostrar los que tienen fecha de ingreso (asignados por coordinacion)
        partes = partes.filter(p => p.fecha_ingreso);
        actualizarStats();
        renderTabla();
    } catch (err) {
        console.error('Error cargando datos:', err);
        document.getElementById('tabla-taller').innerHTML =
            '<tr><td colspan="11" class="empty-state"><p>Error al cargar datos</p></td></tr>';
    }
}

function actualizarStats() {
    document.getElementById('stat-pendientes').textContent = partes.filter(p => p.estado === 'Pendiente').length;
    document.getElementById('stat-en-proceso').textContent = partes.filter(p => p.estado === 'En Proceso').length;
    document.getElementById('stat-en-espera').textContent = partes.filter(p => p.estado === 'En Espera' || p.estado === 'Esperando Repuesto').length;
    document.getElementById('stat-operativos').textContent = partes.filter(p => p.estado === 'Operativo').length;
}

function getColorEstado(estado) {
    const e = estadosDisponibles.find(s => s.nombre === estado);
    return e ? e.color : 'muted';
}

function renderTabla() {
    const filtroDominio = document.getElementById('filtro-dominio').value.toUpperCase();
    const filtroTipoRep = document.getElementById('filtro-tipo-rep').value;
    const filtroTaller = document.getElementById('filtro-taller').value;
    const filtroEstado = document.getElementById('filtro-estado').value;
    const tbody = document.getElementById('tabla-taller');

    let datos = partes;

    // Filtro por tab
    if (tabActual === 'internos') datos = datos.filter(p => p.tipo_taller === 'INTERNO' && p.estado !== 'Operativo');
    else if (tabActual === 'externos') datos = datos.filter(p => p.tipo_taller === 'EXTERNO' && p.estado !== 'Operativo');
    else if (tabActual === 'operativos') datos = datos.filter(p => p.estado === 'Operativo');

    // Filtros de columna
    if (filtroDominio) datos = datos.filter(p => p.dominio.toUpperCase().includes(filtroDominio));
    if (filtroTipoRep) datos = datos.filter(p => p.tipo_reparacion === filtroTipoRep);
    if (filtroTaller) datos = datos.filter(p => p.taller_box === filtroTaller);
    if (filtroEstado) datos = datos.filter(p => p.estado === filtroEstado);

    document.getElementById('tabla-count').textContent = `${datos.length} unidades`;

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><p>Sin datos</p></td></tr>';
        return;
    }

    let num = 1;
    tbody.innerHTML = datos.map(p => {
        const colorEstado = getColorEstado(p.estado);
        const tipoRepBadge = p.tipo_reparacion === 'PROFUNDA' ? 'danger'
            : p.tipo_reparacion === 'LENTA' ? 'warning' : 'info';
        const fechaIngreso = p.fecha_ingreso ? formatFecha(p.fecha_ingreso) : '';
        const fechaFin = p.fecha_probable_fin ? formatFecha(p.fecha_probable_fin) : '';
        const tallerDisplay = p.tipo_taller === 'EXTERNO' && p.taller_externo
            ? p.taller_externo : (p.taller_box || '');

        return `<tr ondblclick="abrirEditar(${p.id})" style="cursor:pointer;">
            <td class="text-muted">${num++}</td>
            <td>${fechaIngreso}</td>
            <td>${fechaFin}</td>
            <td><strong style="font-family:monospace;">${p.dominio}</strong></td>
            <td>${p.operacion}</td>
            <td><span class="badge badge-${tipoRepBadge}">${p.tipo_reparacion}</span></td>
            <td class="cell-wrap">${p.novedad || ''}</td>
            <td>${tallerDisplay}</td>
            <td><span class="badge badge-${colorEstado}">${p.estado}</span></td>
            <td class="cell-wrap text-muted">${p.observaciones || ''}</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); abrirEditar(${p.id})">&#9998;</button>
            </td>
        </tr>`;
    }).join('');
}

function formatFecha(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- TABS ---
window.cambiarTab = function(tab) {
    tabActual = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    renderTabla();
};

// --- MODAL EDITAR ---
window.abrirEditar = function(parteId) {
    parteEditando = partes.find(p => p.id === parteId);
    if (!parteEditando) return;

    document.getElementById('modal-editar-titulo').textContent =
        `${parteEditando.n_parte} - ${parteEditando.dominio}`;
    document.getElementById('edit-dominio').textContent = parteEditando.dominio;
    document.getElementById('edit-operacion').textContent = parteEditando.operacion;
    document.getElementById('edit-tipo-taller').textContent =
        parteEditando.tipo_taller === 'EXTERNO'
            ? `EXTERNO - ${parteEditando.taller_externo || ''}`
            : `INTERNO - ${parteEditando.taller_box || ''}`;

    const selectEstado = document.getElementById('edit-estado');
    selectEstado.innerHTML = estadosDisponibles.map(e =>
        `<option value="${e.nombre}" ${e.nombre === parteEditando.estado ? 'selected' : ''}>${e.nombre}</option>`
    ).join('');

    document.getElementById('edit-tipo-rep').value = parteEditando.tipo_reparacion || 'RAPIDA';
    document.getElementById('edit-taller-box').value = parteEditando.taller_box || 'MECANICA';
    document.getElementById('edit-fecha-fin').value = parteEditando.fecha_probable_fin || '';
    document.getElementById('edit-novedad').value = parteEditando.novedad || '';
    document.getElementById('edit-observaciones').value = parteEditando.observaciones || '';

    document.getElementById('modal-editar').classList.add('active');
};

window.guardarEdicion = async function() {
    if (!parteEditando) return;

    const data = {
        estado: document.getElementById('edit-estado').value,
        tipo_reparacion: document.getElementById('edit-tipo-rep').value,
        taller_box: document.getElementById('edit-taller-box').value,
        fecha_probable_fin: document.getElementById('edit-fecha-fin').value || null,
        novedad: document.getElementById('edit-novedad').value.trim(),
        observaciones: document.getElementById('edit-observaciones').value.trim() || null,
    };

    try {
        await actualizarParte(parteEditando.id, data);
        cerrarModal('modal-editar');
        await cargarDatos();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
    }
};

// --- UTILS ---
window.cerrarModal = function(id) {
    document.getElementById(id).classList.remove('active');
};
