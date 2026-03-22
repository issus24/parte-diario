import { getPartes, getParte, getEstados, actualizarParte, actualizarEstadoDesperfecto } from './api.js';

let partes = [];
let estadosDisponibles = [];
let parteEditando = null;
let tabActual = 'internos';

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
        const lista = await getPartes();
        // Cargar detalle con desperfectos
        partes = await Promise.all(lista.map(async p => {
            try {
                const detalle = await getParte(p.id);
                p._desperfectos = detalle.desperfectos || [];
            } catch { p._desperfectos = []; }
            return p;
        }));
        actualizarStats();
        actualizarTabCounts();
        renderTabla();
    } catch (err) {
        console.error('Error cargando datos:', err);
        document.getElementById('tabla-taller').innerHTML =
            '<tr><td colspan="11" class="empty-state"><p>Error al cargar datos</p></td></tr>';
    }
}

function enTaller(p) {
    return p.ingreso_confirmado && p.estado !== 'Operativo' && p.estado !== 'Pendiente de Ingreso';
}

function filtrarPorTab(datos) {
    if (tabActual === 'internos') return datos.filter(p => enTaller(p) && p.tipo_taller === 'INTERNO');
    if (tabActual === 'externos') return datos.filter(p => enTaller(p) && p.tipo_taller === 'EXTERNO');
    if (tabActual === 'pendientes') return datos.filter(p => !p.ingreso_confirmado && p.estado !== 'Operativo');
    if (tabActual === 'operativos') return datos.filter(p => p.estado === 'Operativo');
    return datos;
}

function actualizarStats() {
    const activos = partes.filter(p => p.estado !== 'Operativo');
    document.getElementById('stat-pendientes').textContent = activos.filter(p => p.estado === 'Pendiente').length;
    document.getElementById('stat-en-proceso').textContent = activos.filter(p => p.estado === 'En Proceso').length;
    document.getElementById('stat-en-espera').textContent = activos.filter(p => p.estado === 'En Espera' || p.estado === 'Esperando Repuesto').length;
    document.getElementById('stat-operativos').textContent = partes.filter(p => p.estado === 'Operativo').length;
}

function actualizarTabCounts() {
    const internos = partes.filter(p => enTaller(p) && p.tipo_taller === 'INTERNO').length;
    const externos = partes.filter(p => enTaller(p) && p.tipo_taller === 'EXTERNO').length;
    const pendientes = partes.filter(p => !p.ingreso_confirmado && p.estado !== 'Operativo').length;
    const operativos = partes.filter(p => p.estado === 'Operativo').length;

    document.getElementById('tab-count-internos').textContent = internos ? `(${internos})` : '';
    document.getElementById('tab-count-externos').textContent = externos ? `(${externos})` : '';
    document.getElementById('tab-count-pendientes').textContent = pendientes ? `(${pendientes})` : '';
    document.getElementById('tab-count-operativos').textContent = operativos ? `(${operativos})` : '';
}

function getColorEstado(estadoNombre) {
    const estado = estadosDisponibles.find(e => e.nombre === estadoNombre);
    return estado ? estado.color : 'muted';
}

function esResolutivo(estadoNombre) {
    const estado = estadosDisponibles.find(e => e.nombre === estadoNombre);
    return estado ? estado.es_resolutivo : false;
}

function renderTabla() {
    const filtroDominio = document.getElementById('filtro-dominio').value.toUpperCase();
    const filtroTipoRep = document.getElementById('filtro-tipo-rep').value;
    const filtroTaller = document.getElementById('filtro-taller').value;
    const filtroEstado = document.getElementById('filtro-estado').value;
    const tbody = document.getElementById('tabla-taller');

    let datos = filtrarPorTab(partes);

    if (filtroDominio) datos = datos.filter(p => p.dominio.toUpperCase().includes(filtroDominio));
    if (filtroTipoRep) datos = datos.filter(p => p.tipo_reparacion === filtroTipoRep);
    if (filtroTaller) datos = datos.filter(p => p.taller_box === filtroTaller);
    if (filtroEstado) datos = datos.filter(p => p.estado === filtroEstado);

    document.getElementById('tabla-count').textContent = `${datos.length} unidades`;

    // Render tablet cards
    renderTabletCards(datos);

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><p>Sin datos</p></td></tr>';
        return;
    }

    let num = 1;
    tbody.innerHTML = datos.map(p => {
        const colorEstado = getColorEstado(p.estado);
        const tipoRepBadge = p.tipo_reparacion === 'PROFUNDA' ? 'danger'
            : p.tipo_reparacion === 'LENTA' ? 'warning' : 'info';
        const fechaIngreso = p.fecha_ingreso ? formatFecha(p.fecha_ingreso) : '<span class="text-muted">Sin asignar</span>';
        const fechaFin = p.fecha_probable_fin ? formatFecha(p.fecha_probable_fin) : '';
        const tallerDisplay = p.tipo_taller === 'EXTERNO' && p.taller_externo
            ? p.taller_externo : (p.taller_box || '');

        // Novedad con desperfectos individuales
        let novedadHtml = '';
        if (p._desperfectos && p._desperfectos.length > 0) {
            novedadHtml = p._desperfectos.map(d => {
                const sColor = sectorColor(d.sector);
                const dEstColor = getColorEstado(d.estado);
                return `<div class="desp-line">
                    <span class="badge badge-${sColor}">${d.sector}</span>
                    <span class="badge badge-${dEstColor}" style="margin-left:2px;">${d.estado}</span>
                    ${d.descripcion}
                </div>`;
            }).join('');
        } else {
            novedadHtml = p.novedad || '';
        }

        // Estado del parte con progreso
        let estadoHtml = '';
        if (p._desperfectos && p._desperfectos.length > 0) {
            const total = p._desperfectos.length;
            const resueltos = p._desperfectos.filter(d => esResolutivo(d.estado)).length;
            if (resueltos === total) {
                estadoHtml = '<span class="badge badge-success">COMPLETADO</span>';
            } else {
                estadoHtml = `<span class="badge badge-${colorEstado}">${p.estado}</span>
                    <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">${resueltos}/${total} resueltos</div>`;
            }
        } else {
            estadoHtml = `<span class="badge badge-${colorEstado}">${p.estado}</span>`;
        }

        return `<tr ondblclick="abrirEditar(${p.id})" style="cursor:pointer;">
            <td class="text-muted">${num++}</td>
            <td>${fechaIngreso}</td>
            <td>${fechaFin}</td>
            <td><strong style="font-family:monospace;">${p.dominio}</strong></td>
            <td>${p.operacion}</td>
            <td><span class="badge badge-${tipoRepBadge}">${p.tipo_reparacion}</span></td>
            <td class="cell-novedad">${novedadHtml}</td>
            <td>${tallerDisplay}</td>
            <td>${estadoHtml}</td>
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

function renderTabletCards(datos) {
    const container = document.getElementById('tablet-cards');
    if (!container) return;

    if (datos.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Sin datos</p></div>';
        return;
    }

    container.innerHTML = datos.map(p => {
        const colorEstado = getColorEstado(p.estado);

        // Progreso
        let progresoHtml = '';
        if (p._desperfectos && p._desperfectos.length > 0) {
            const total = p._desperfectos.length;
            const resueltos = p._desperfectos.filter(d => esResolutivo(d.estado)).length;
            const pct = Math.round((resueltos / total) * 100);
            progresoHtml = `<div class="tcc-progress">
                <div class="tcc-progress-bar" style="width:${pct}%"></div>
            </div>
            <span class="tcc-progress-text">${resueltos}/${total}</span>`;
        }

        // Desperfectos como filas compactas
        let despRows = '';
        if (p._desperfectos && p._desperfectos.length > 0) {
            despRows = p._desperfectos.map(d => {
                const sColor = sectorColor(d.sector);
                const dColor = getColorEstado(d.estado);
                return `<div class="tcc-desp-row">
                    <span class="badge badge-${sColor}" style="min-width:85px;justify-content:center;">${d.sector}</span>
                    <span class="tcc-desp-desc">${d.descripcion}</span>
                    <span class="badge badge-${dColor}">${d.estado}</span>
                </div>`;
            }).join('');
        }

        return `<div class="tablet-card-compact" onclick="abrirEditar(${p.id})">
            <div class="tcc-header">
                <div class="tcc-left">
                    <span class="tcc-dominio">${p.dominio}</span>
                    <span class="badge badge-${colorEstado}">${p.estado}</span>
                </div>
                <div class="tcc-right">
                    ${progresoHtml}
                </div>
            </div>
            <div class="tcc-body">${despRows}</div>
        </div>`;
    }).join('');
}

window.editarObsTablet = async function(parteId) {
    const parte = partes.find(p => p.id === parteId);
    const obs = prompt('Observaciones:', parte?.observaciones || '');
    if (obs === null) return;
    try {
        await actualizarParte(parteId, { observaciones: obs });
        await cargarDatos();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.cambiarEstadoDesp = async function(despId, nuevoEstado) {
    try {
        await actualizarEstadoDesperfecto(despId, nuevoEstado);
        await cargarDatos();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

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

    // Estado general
    const selectEstado = document.getElementById('edit-estado');
    selectEstado.innerHTML = estadosDisponibles.map(e =>
        `<option value="${e.nombre}" ${e.nombre === parteEditando.estado ? 'selected' : ''}>${e.nombre}</option>`
    ).join('');

    document.getElementById('edit-tipo-rep').value = parteEditando.tipo_reparacion || 'RAPIDA';
    document.getElementById('edit-taller-box').value = parteEditando.taller_box || 'MECANICA';
    document.getElementById('edit-fecha-fin').value = parteEditando.fecha_probable_fin || '';
    document.getElementById('edit-novedad').value = parteEditando.novedad || '';
    document.getElementById('edit-observaciones').value = parteEditando.observaciones || '';

    // Renderizar desperfectos individuales con selects de estado
    const despContainer = document.getElementById('edit-desperfectos');
    if (parteEditando._desperfectos && parteEditando._desperfectos.length > 0) {
        despContainer.innerHTML = `
            <label style="font-size:0.75rem; font-weight:500; color:var(--text-secondary); margin-bottom:0.5rem; display:block;">Desperfectos</label>
            ${parteEditando._desperfectos.map(d => {
                const sColor = sectorColor(d.sector);
                const opts = estadosDisponibles.map(e =>
                    `<option value="${e.nombre}" ${e.nombre === d.estado ? 'selected' : ''}>${e.nombre}</option>`
                ).join('');
                return `<div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0; border-bottom:1px dashed var(--border); flex-wrap:wrap;">
                    <span class="badge badge-${sColor}">${d.sector}</span>
                    <span style="flex:1; font-size:0.8rem; min-width:120px;">${d.descripcion}</span>
                    <select class="form-control" style="width:150px; font-size:0.75rem;" onchange="cambiarEstadoDesp(${d.id}, this.value)">${opts}</select>
                </div>`;
            }).join('')}
        `;
        despContainer.style.display = 'block';
    } else {
        despContainer.style.display = 'none';
    }

    document.getElementById('modal-editar').classList.add('active');
};


window.guardarEdicion = async function() {
    if (!parteEditando) return;

    const data = {
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

// --- TODO REPARADO ---
window.todoReparado = async function() {
    if (!parteEditando || !parteEditando._desperfectos) return;

    const pendientes = parteEditando._desperfectos.filter(d => !esResolutivo(d.estado));
    if (pendientes.length === 0) return alert('Ya están todos reparados');

    try {
        for (const d of pendientes) {
            await actualizarEstadoDesperfecto(d.id, 'Reparado');
        }
        cerrarModal('modal-editar');
        await cargarDatos();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

// --- UTILS ---
window.cerrarModal = function(id) {
    document.getElementById(id).classList.remove('active');
};
