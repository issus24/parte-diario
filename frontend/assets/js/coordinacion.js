import { getPartes, crearParte, asignarFechaCitacion } from './api.js';

let partes = [];
let parteSeleccionado = null;
let desperfectosNuevo = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    cargarPartes();
    document.getElementById('filtro-patente').addEventListener('input', renderTabla);
});

async function cargarPartes() {
    try {
        partes = await getPartes();
        actualizarStats();
        renderTabla();
    } catch (err) {
        console.error('Error cargando partes:', err);
        document.getElementById('tabla-partes').innerHTML =
            '<tr><td colspan="8" class="empty-state"><p>Error al cargar datos</p></td></tr>';
    }
}

function actualizarStats() {
    const hoy = new Date().toISOString().split('T')[0];
    const sinCitar = partes.filter(p => !p.fecha_citacion && !p.alta).length;
    const citadosHoy = partes.filter(p => p.fecha_citacion === hoy).length;
    const enTaller = partes.filter(p => p.fecha_citacion && !p.alta).length;
    const conAlta = partes.filter(p => p.alta).length;

    document.getElementById('stat-sin-citar').textContent = sinCitar;
    document.getElementById('stat-citados-hoy').textContent = citadosHoy;
    document.getElementById('stat-en-taller').textContent = enTaller;
    document.getElementById('stat-con-alta').textContent = conAlta;
}

function renderTabla() {
    const filtro = document.getElementById('filtro-patente').value.toUpperCase();
    const tbody = document.getElementById('tabla-partes');

    let datos = partes;
    if (filtro) {
        datos = datos.filter(p => p.patente.toUpperCase().includes(filtro));
    }

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No hay partes</p></td></tr>';
        return;
    }

    tbody.innerHTML = datos.map(p => {
        const estado = getEstadoGeneral(p);
        const fechaCarga = new Date(p.fecha_carga).toLocaleDateString('es-AR');
        const fechaCitacion = p.fecha_citacion
            ? new Date(p.fecha_citacion + 'T12:00:00').toLocaleDateString('es-AR')
            : '-';

        return `<tr>
            <td><strong>${p.n_parte}</strong></td>
            <td style="font-family:monospace; font-weight:600;">${p.patente}</td>
            <td>${p.chofer}</td>
            <td>${p.cant_resueltos}/${p.cant_desperfectos}</td>
            <td>${fechaCarga}</td>
            <td>${fechaCitacion}</td>
            <td><span class="badge badge-${estado.color}">${estado.label}</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="abrirModalFecha(${p.id})">
                    ${p.fecha_citacion ? '&#9998; Editar' : '&#128197; Citar'}
                </button>
            </td>
        </tr>`;
    }).join('');
}

function getEstadoGeneral(parte) {
    if (parte.alta) return { label: 'Alta', color: 'success' };
    if (!parte.fecha_citacion) return { label: 'Sin citar', color: 'warning' };
    if (parte.cant_resueltos > 0 && parte.cant_resueltos < parte.cant_desperfectos) {
        return { label: 'En proceso', color: 'info' };
    }
    return { label: 'Citado', color: 'primary' };
}

// --- MODAL FECHA ---
window.abrirModalFecha = function(parteId) {
    parteSeleccionado = partes.find(p => p.id === parteId);
    if (!parteSeleccionado) return;

    document.getElementById('modal-fecha-nparte').textContent = parteSeleccionado.n_parte;
    document.getElementById('modal-fecha-patente').textContent = parteSeleccionado.patente;
    document.getElementById('input-fecha-citacion').value = parteSeleccionado.fecha_citacion || '';
    document.getElementById('modal-fecha').classList.add('active');
};

window.guardarFechaCitacion = async function() {
    if (!parteSeleccionado) return;
    const fecha = document.getElementById('input-fecha-citacion').value;
    if (!fecha) return alert('Selecciona una fecha');

    try {
        await asignarFechaCitacion(parteSeleccionado.id, fecha);
        cerrarModal('modal-fecha');
        await cargarPartes();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
    }
};

// --- MODAL NUEVO PARTE ---
window.abrirModalNuevoParte = function() {
    desperfectosNuevo = [];
    document.getElementById('nuevo-patente').value = '';
    document.getElementById('nuevo-chofer').value = '';
    document.getElementById('nuevo-km').value = '';
    document.getElementById('nuevo-descripcion').value = '';
    renderDesperfectosNuevo();
    document.getElementById('modal-nuevo').classList.add('active');
};

window.agregarDesperfectoNuevo = function() {
    const sector = document.getElementById('nuevo-sector').value;
    const descripcion = document.getElementById('nuevo-descripcion').value.trim();
    if (!descripcion) return alert('Ingresa una descripcion');

    desperfectosNuevo.push({ sector, descripcion });
    document.getElementById('nuevo-descripcion').value = '';
    renderDesperfectosNuevo();
};

function renderDesperfectosNuevo() {
    const container = document.getElementById('lista-desperfectos-nuevo');
    if (desperfectosNuevo.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.75rem;">No hay desperfectos agregados</p>';
        return;
    }
    container.innerHTML = desperfectosNuevo.map((d, i) => `
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; padding:0.4rem 0.6rem; background:var(--muted-light); border-radius:var(--radius);">
            <span class="badge badge-${d.sector.toLowerCase()}">${d.sector}</span>
            <span style="flex:1; font-size:0.85rem;">${d.descripcion}</span>
            <button class="btn btn-sm" onclick="quitarDesperfectoNuevo(${i})" style="color:var(--danger); padding:0.2rem;">&times;</button>
        </div>
    `).join('');
}

window.quitarDesperfectoNuevo = function(index) {
    desperfectosNuevo.splice(index, 1);
    renderDesperfectosNuevo();
};

window.guardarNuevoParte = async function() {
    const patente = document.getElementById('nuevo-patente').value.trim();
    const chofer = document.getElementById('nuevo-chofer').value.trim();
    const km = document.getElementById('nuevo-km').value;

    if (!patente) return alert('Ingresa la patente');
    if (!chofer) return alert('Ingresa el chofer');
    if (desperfectosNuevo.length === 0) return alert('Agrega al menos un desperfecto');

    try {
        await crearParte({
            patente,
            chofer,
            km: km ? parseInt(km) : null,
            desperfectos: desperfectosNuevo
        });
        cerrarModal('modal-nuevo');
        await cargarPartes();
    } catch (err) {
        alert('Error al crear parte: ' + err.message);
    }
};

// --- UTILS ---
window.cerrarModal = function(id) {
    document.getElementById(id).classList.remove('active');
};
