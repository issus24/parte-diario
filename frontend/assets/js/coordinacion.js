import { getPartes, getParte, crearParte, actualizarParte, getEstados } from './api.js';

let partes = [];
let parteSeleccionado = null;
let estadosDisponibles = [];

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

function esResolutivo(estadoNombre) {
    const estado = estadosDisponibles.find(e => e.nombre === estadoNombre);
    return estado ? estado.es_resolutivo : false;
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try { estadosDisponibles = await getEstados(); } catch {}
    document.getElementById('filtro-dominio').addEventListener('input', renderTabla);
    document.getElementById('filtro-estado').addEventListener('change', renderTabla);
    cargarPartes();
});

async function cargarPartes() {
    try {
        const lista = await getPartes();
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
            '<tr><td colspan="8" class="empty-state"><p>Error al cargar datos</p></td></tr>';
    }
}

function actualizarStats() {
    const sinFecha = partes.filter(p => !p.fecha_ingreso && p.estado === 'Pendiente de Ingreso').length;
    const conFechaSinConfirmar = partes.filter(p => p.fecha_ingreso && !p.ingreso_confirmado && p.estado === 'Pendiente de Ingreso').length;
    const enTaller = partes.filter(p => p.ingreso_confirmado && p.estado !== 'Operativo').length;
    const operativos = partes.filter(p => p.estado === 'Operativo').length;

    document.getElementById('stat-sin-asignar').textContent = sinFecha;
    document.getElementById('stat-por-confirmar').textContent = conFechaSinConfirmar;
    document.getElementById('stat-en-taller').textContent = enTaller;
    document.getElementById('stat-operativos').textContent = operativos;
}

function getEstadoDisplay(p) {
    if (p.estado === 'Operativo') return '<span class="badge badge-success">OPERATIVO</span>';
    if (!p.fecha_ingreso) return '<span class="badge badge-muted">PEND. INGRESO</span>';
    if (!p.ingreso_confirmado) return '<span class="badge badge-warning">CITADO - SIN CONFIRMAR</span>';
    // En taller
    const total = p._desperfectos.length;
    if (total > 0) {
        const resueltos = p._desperfectos.filter(d => esResolutivo(d.estado)).length;
        if (resueltos === total) return '<span class="badge badge-success">COMPLETADO</span>';
        if (resueltos > 0) return `<span class="badge badge-info">EN PROCESO ${resueltos}/${total}</span>`;
    }
    return '<span class="badge badge-orange">EN TALLER</span>';
}

function renderTabla() {
    const filtroDominio = document.getElementById('filtro-dominio').value.toUpperCase();
    const filtroEstado = document.getElementById('filtro-estado').value;
    const tbody = document.getElementById('tabla-partes');

    let datos = partes;

    if (filtroDominio) datos = datos.filter(p => p.dominio.toUpperCase().includes(filtroDominio));
    if (filtroEstado === 'sin-fecha') datos = datos.filter(p => !p.fecha_ingreso && p.estado === 'Pendiente de Ingreso');
    else if (filtroEstado === 'por-confirmar') datos = datos.filter(p => p.fecha_ingreso && !p.ingreso_confirmado && p.estado === 'Pendiente de Ingreso');
    else if (filtroEstado === 'en-taller') datos = datos.filter(p => p.ingreso_confirmado && p.estado !== 'Operativo');
    else if (filtroEstado === 'Operativo') datos = datos.filter(p => p.estado === 'Operativo');

    document.getElementById('tabla-count').textContent = `${datos.length} partes`;

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><p>Sin datos</p></td></tr>';
        return;
    }

    let num = 1;
    tbody.innerHTML = datos.map(p => {
        const fechaIngreso = p.fecha_ingreso ? formatFecha(p.fecha_ingreso) : '';

        // Novedad con desperfectos
        let novedadHtml = '';
        if (p._desperfectos && p._desperfectos.length > 0) {
            novedadHtml = p._desperfectos.map(d => {
                const sColor = sectorColor(d.sector);
                return `<div class="desp-line"><span class="badge badge-${sColor}">${d.sector}</span> ${d.descripcion}</div>`;
            }).join('');
        } else {
            const problemas = (p.novedad || '').split('. ').filter(t => t.trim());
            novedadHtml = problemas.length > 1
                ? problemas.map(t => `<div class="desp-line">${t.trim()}</div>`).join('')
                : (p.novedad || '');
        }

        // Acción según estado
        let accion = '';
        if (!p.fecha_ingreso) {
            accion = `<button class="btn btn-primary btn-sm" onclick="abrirAsignar(${p.id})">Citar</button>`;
        } else if (!p.ingreso_confirmado) {
            accion = `<button class="btn btn-success btn-sm" onclick="confirmarIngreso(${p.id})">Confirmar</button>
                       <button class="btn btn-outline btn-sm" onclick="abrirAsignar(${p.id})" title="Cambiar fecha">&#9998;</button>`;
        } else {
            accion = `<span class="text-muted" style="font-size:0.7rem;">&#10003; Ingresado</span>`;
        }

        return `<tr>
            <td class="text-muted">${num++}</td>
            <td><strong style="font-family:monospace;">${p.dominio}</strong></td>
            <td>${p.chofer_nombre || p.operacion}</td>
            <td class="cell-novedad">${novedadHtml}</td>
            <td>${fechaIngreso}</td>
            <td>${getEstadoDisplay(p)}</td>
            <td>${accion}</td>
        </tr>`;
    }).join('');
}

function formatFecha(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- CONFIRMAR INGRESO ---
window.confirmarIngreso = async function(parteId) {
    try {
        await actualizarParte(parteId, { ingreso_confirmado: true });
        await cargarPartes();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

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

// --- MODAL ASIGNAR (solo fecha) ---
window.abrirAsignar = function(parteId) {
    parteSeleccionado = partes.find(p => p.id === parteId);
    if (!parteSeleccionado) return;

    document.getElementById('asignar-nparte').textContent = parteSeleccionado.n_parte;
    document.getElementById('asignar-dominio').textContent = parteSeleccionado.dominio;
    document.getElementById('asignar-fecha').value = parteSeleccionado.fecha_ingreso || new Date().toISOString().split('T')[0];

    const probEl = document.getElementById('asignar-problemas');
    if (parteSeleccionado._desperfectos && parteSeleccionado._desperfectos.length > 0) {
        probEl.innerHTML = parteSeleccionado._desperfectos.map(d => {
            const sColor = sectorColor(d.sector);
            return `<div class="desp-line"><span class="badge badge-${sColor}">${d.sector}</span> ${d.descripcion}</div>`;
        }).join('');
    } else {
        probEl.innerHTML = `<div style="font-size:0.8rem; color:var(--text-secondary);">${parteSeleccionado.novedad || ''}</div>`;
    }

    document.getElementById('modal-asignar').classList.add('active');
};

window.guardarAsignacion = async function() {
    if (!parteSeleccionado) return;
    const fecha = document.getElementById('asignar-fecha').value;
    if (!fecha) return alert('Selecciona una fecha');

    try {
        await actualizarParte(parteSeleccionado.id, { fecha_ingreso: fecha });
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
