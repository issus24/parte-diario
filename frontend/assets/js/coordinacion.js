import { getPartes, getParte, crearParte, actualizarParte } from './api.js';

let partes = [];
let parteSeleccionado = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('filtro-dominio').addEventListener('input', renderTabla);
    document.getElementById('filtro-estado').addEventListener('change', renderTabla);
    cargarPartes();
});

function sectorColor(sector) {
    const map = {
        'MECANICA': 'info', 'MECÁNICA': 'info',
        'ELECTRICIDAD': 'warning',
        'HERRERIA': 'muted', 'HERRERÍA': 'muted',
        'GOMERIA': 'success', 'GOMERÍA': 'success',
        'LAVADERO': 'primary',
    };
    return map[(sector || '').toUpperCase()] || 'muted';
}

async function cargarPartes() {
    try {
        const lista = await getPartes();
        // Cargar detalle de cada parte para tener desperfectos
        partes = await Promise.all(lista.map(async p => {
            try {
                const detalle = await getParte(p.id);
                p._desperfectos = detalle.desperfectos || [];
            } catch { p._desperfectos = []; }
            return p;
        }));
        actualizarStats();
        renderTabla();
    } catch (err) {
        console.error('Error cargando partes:', err);
        document.getElementById('tabla-partes').innerHTML =
            '<tr><td colspan="9" class="empty-state"><p>Error al cargar datos</p></td></tr>';
    }
}

function actualizarStats() {
    const sinAsignar = partes.filter(p => !p.fecha_ingreso && p.estado !== 'Operativo').length;
    const enTaller = partes.filter(p => p.fecha_ingreso && p.estado !== 'Operativo').length;
    const operativos = partes.filter(p => p.estado === 'Operativo').length;

    document.getElementById('stat-sin-asignar').textContent = sinAsignar;
    document.getElementById('stat-en-taller').textContent = enTaller;
    document.getElementById('stat-operativos').textContent = operativos;
    document.getElementById('stat-total').textContent = partes.length;
}

function renderTabla() {
    const filtroDominio = document.getElementById('filtro-dominio').value.toUpperCase();
    const filtroEstado = document.getElementById('filtro-estado').value;
    const tbody = document.getElementById('tabla-partes');

    let datos = partes;

    if (filtroDominio) datos = datos.filter(p => p.dominio.toUpperCase().includes(filtroDominio));
    if (filtroEstado === 'sin-asignar') datos = datos.filter(p => !p.fecha_ingreso && p.estado !== 'Operativo');
    else if (filtroEstado === 'asignado') datos = datos.filter(p => p.fecha_ingreso && p.estado !== 'Operativo');
    else if (filtroEstado === 'Operativo') datos = datos.filter(p => p.estado === 'Operativo');

    document.getElementById('tabla-count').textContent = `${datos.length} partes`;

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><p>Sin datos</p></td></tr>';
        return;
    }

    let num = 1;
    tbody.innerHTML = datos.map(p => {
        const tipoRepBadge = p.tipo_reparacion === 'PROFUNDA' ? 'danger'
            : p.tipo_reparacion === 'LENTA' ? 'warning' : 'info';
        const fechaIngreso = p.fecha_ingreso ? formatFecha(p.fecha_ingreso) : '';
        const tallerDisplay = p.tipo_taller === 'EXTERNO' && p.taller_externo
            ? p.taller_externo : (p.taller_box || '');
        const sinAsignar = !p.fecha_ingreso && p.estado !== 'Operativo';

        const estadoBadge = p.estado === 'Operativo'
            ? '<span class="badge badge-success">OPERATIVO</span>'
            : sinAsignar
                ? '<span class="badge badge-warning">SIN ASIGNAR</span>'
                : '<span class="badge badge-info">EN TALLER</span>';

        const accion = sinAsignar
            ? `<button class="btn btn-primary btn-sm" onclick="abrirAsignar(${p.id})">Asignar</button>`
            : `<button class="btn btn-outline btn-sm" onclick="abrirAsignar(${p.id})">&#9998;</button>`;

        // Mostrar desperfectos individuales si el parte tiene detalles cargados
        let novedadHtml = '';
        if (p._desperfectos && p._desperfectos.length > 0) {
            novedadHtml = p._desperfectos.map(d => {
                const sColor = sectorColor(d.sector);
                return `<div class="desp-line"><span class="badge badge-${sColor}">${d.sector}</span> ${d.descripcion}</div>`;
            }).join('');
        } else {
            // Parsear novedad separada por ". "
            const problemas = (p.novedad || '').split('. ').filter(t => t.trim());
            if (problemas.length > 1) {
                novedadHtml = problemas.map(t => `<div class="desp-line">${t.trim()}</div>`).join('');
            } else {
                novedadHtml = p.novedad || '';
            }
        }

        return `<tr>
            <td class="text-muted">${num++}</td>
            <td><strong style="font-family:monospace;">${p.dominio}</strong></td>
            <td>${p.chofer_nombre || p.operacion}</td>
            <td class="cell-novedad">${novedadHtml}</td>
            <td><span class="badge badge-${tipoRepBadge}">${p.tipo_reparacion}</span></td>
            <td>${tallerDisplay}</td>
            <td>${fechaIngreso}</td>
            <td>${estadoBadge}</td>
            <td>${accion}</td>
        </tr>`;
    }).join('');
}

function formatFecha(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- MODAL NUEVO ---
window.abrirModalNuevo = function() {
    document.getElementById('nuevo-dominio').value = '';
    document.getElementById('nuevo-operacion').value = 'BASE TT';
    document.getElementById('nuevo-tipo-rep').value = 'RAPIDA';
    document.getElementById('nuevo-tipo-taller').value = 'INTERNO';
    document.getElementById('nuevo-taller-box').value = 'MECANICA';
    document.getElementById('nuevo-taller-externo').value = '';
    document.getElementById('nuevo-fecha-ingreso').value = '';
    document.getElementById('nuevo-novedad').value = '';
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
        fecha_ingreso: document.getElementById('nuevo-fecha-ingreso').value || null,
    };

    try {
        await crearParte(data);
        cerrarModal('modal-nuevo');
        await cargarPartes();
    } catch (err) {
        alert('Error al crear: ' + err.message);
    }
};

// --- MODAL ASIGNAR ---
window.abrirAsignar = function(parteId) {
    parteSeleccionado = partes.find(p => p.id === parteId);
    if (!parteSeleccionado) return;

    document.getElementById('asignar-nparte').textContent = parteSeleccionado.n_parte;
    document.getElementById('asignar-dominio').textContent = parteSeleccionado.dominio;
    document.getElementById('asignar-fecha').value = parteSeleccionado.fecha_ingreso || new Date().toISOString().split('T')[0];
    document.getElementById('asignar-tipo-taller').value = parteSeleccionado.tipo_taller || 'INTERNO';
    document.getElementById('asignar-taller-box').value = parteSeleccionado.taller_box || 'MECANICA';

    document.getElementById('modal-asignar').classList.add('active');
};

window.guardarAsignacion = async function() {
    if (!parteSeleccionado) return;
    const fecha = document.getElementById('asignar-fecha').value;
    if (!fecha) return alert('Selecciona una fecha');

    try {
        await actualizarParte(parteSeleccionado.id, {
            fecha_ingreso: fecha,
            tipo_taller: document.getElementById('asignar-tipo-taller').value,
            taller_box: document.getElementById('asignar-taller-box').value,
        });
        cerrarModal('modal-asignar');
        await cargarPartes();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

// --- UTILS ---
window.cerrarModal = function(id) {
    document.getElementById(id).classList.remove('active');
};
