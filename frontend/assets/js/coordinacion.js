import { getPartes, crearParte, actualizarParte, getEstados } from './api.js';

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

    document.getElementById('nuevo-fecha-ingreso').value = new Date().toISOString().split('T')[0];
    document.getElementById('filtro-dominio').addEventListener('input', renderTabla);
    document.getElementById('filtro-tipo-rep').addEventListener('change', renderTabla);
    document.getElementById('filtro-taller').addEventListener('change', renderTabla);
    document.getElementById('filtro-estado').addEventListener('change', renderTabla);

    cargarPartes();
});

async function cargarPartes() {
    try {
        partes = await getPartes();
        actualizarStats();
        renderTabla();
    } catch (err) {
        console.error('Error cargando partes:', err);
        document.getElementById('tabla-partes').innerHTML =
            '<tr><td colspan="11" class="empty-state"><p>Error al cargar datos</p></td></tr>';
    }
}

function actualizarStats() {
    document.getElementById('stat-pendientes').textContent = partes.filter(p => p.estado === 'Pendiente').length;
    document.getElementById('stat-en-proceso').textContent = partes.filter(p => p.estado === 'En Proceso').length;
    document.getElementById('stat-en-espera').textContent = partes.filter(p => p.estado === 'En Espera' || p.estado === 'Esperando Repuesto').length;
    document.getElementById('stat-operativos').textContent = partes.filter(p => p.estado === 'Operativo').length;
}

function renderTabla() {
    const filtroDominio = document.getElementById('filtro-dominio').value.toUpperCase();
    const filtroTipoRep = document.getElementById('filtro-tipo-rep').value;
    const filtroTaller = document.getElementById('filtro-taller').value;
    const filtroEstado = document.getElementById('filtro-estado').value;
    const tbody = document.getElementById('tabla-partes');

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
        const fechaIngreso = p.fecha_ingreso
            ? formatFecha(p.fecha_ingreso) : '';
        const fechaFin = p.fecha_probable_fin
            ? formatFecha(p.fecha_probable_fin) : '';
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

function getColorEstado(estado) {
    const e = estadosDisponibles.find(s => s.nombre === estado);
    return e ? e.color : 'muted';
}

// --- TABS ---
window.cambiarTab = function(tab) {
    tabActual = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    renderTabla();
};

// --- MODAL NUEVO ---
window.abrirModalNuevo = function() {
    document.getElementById('nuevo-dominio').value = '';
    document.getElementById('nuevo-operacion').value = 'BASE TT';
    document.getElementById('nuevo-tipo-rep').value = 'RAPIDA';
    document.getElementById('nuevo-tipo-taller').value = 'INTERNO';
    document.getElementById('nuevo-taller-box').value = 'MECANICA';
    document.getElementById('nuevo-taller-externo').value = '';
    document.getElementById('nuevo-fecha-ingreso').value = new Date().toISOString().split('T')[0];
    document.getElementById('nuevo-fecha-fin').value = '';
    document.getElementById('nuevo-novedad').value = '';
    document.getElementById('nuevo-observaciones').value = '';
    toggleTallerExterno();
    document.getElementById('modal-nuevo').classList.add('active');
};

window.toggleTallerExterno = function() {
    const tipo = document.getElementById('nuevo-tipo-taller').value;
    document.getElementById('grupo-taller-externo').style.display = tipo === 'EXTERNO' ? 'block' : 'none';
};

window.guardarNuevo = async function() {
    const dominio = document.getElementById('nuevo-dominio').value.trim();
    const novedad = document.getElementById('nuevo-novedad').value.trim();
    if (!dominio) return alert('Ingresa el dominio');
    if (!novedad) return alert('Ingresa la novedad');

    const data = {
        dominio,
        operacion: document.getElementById('nuevo-operacion').value.trim() || 'BASE TT',
        tipo_reparacion: document.getElementById('nuevo-tipo-rep').value,
        tipo_taller: document.getElementById('nuevo-tipo-taller').value,
        taller_externo: document.getElementById('nuevo-taller-externo').value.trim() || null,
        taller_box: document.getElementById('nuevo-taller-box').value,
        novedad,
        observaciones: document.getElementById('nuevo-observaciones').value.trim() || null,
        fecha_ingreso: document.getElementById('nuevo-fecha-ingreso').value || null,
        fecha_probable_fin: document.getElementById('nuevo-fecha-fin').value || null,
    };

    try {
        await crearParte(data);
        cerrarModal('modal-nuevo');
        await cargarPartes();
    } catch (err) {
        alert('Error al crear: ' + err.message);
    }
};

// --- MODAL EDITAR ---
window.abrirEditar = async function(parteId) {
    parteEditando = partes.find(p => p.id === parteId);
    if (!parteEditando) return;

    document.getElementById('modal-editar-titulo').textContent =
        `${parteEditando.n_parte} - ${parteEditando.dominio}`;
    document.getElementById('edit-dominio').textContent = parteEditando.dominio;
    document.getElementById('edit-operacion').textContent = parteEditando.operacion;
    document.getElementById('edit-tipo-taller').textContent =
        parteEditando.tipo_taller === 'EXTERNO'
            ? `EXTERNO - ${parteEditando.taller_externo || ''}`
            : 'INTERNO';

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
        await cargarPartes();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
    }
};

// --- UTILS ---
window.cerrarModal = function(id) {
    document.getElementById(id).classList.remove('active');
};
