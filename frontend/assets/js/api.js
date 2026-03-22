// API Helper - Parte Diario
const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || "http://127.0.0.1:3001";

// --- PARTES ---

export async function getPartes(params = {}) {
    const url = new URL(`${API_BASE_URL}/api/partes`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
            url.searchParams.append(key, value);
        }
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
}

export async function getParte(id) {
    const res = await fetch(`${API_BASE_URL}/api/partes/${id}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
}

export async function crearParte(data) {
    const res = await fetch(`${API_BASE_URL}/api/partes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

export async function asignarFechaCitacion(parteId, fecha_citacion) {
    const res = await fetch(`${API_BASE_URL}/api/partes/${parteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_citacion })
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
}

// --- DESPERFECTOS ---

export async function actualizarEstadoDesperfecto(desperfectoId, estado, notas = null) {
    const body = { estado };
    if (notas !== null) body.notas = notas;

    const res = await fetch(`${API_BASE_URL}/api/desperfectos/${desperfectoId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
}

// --- ESTADOS ---

export async function getEstados() {
    const res = await fetch(`${API_BASE_URL}/api/estados`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
}

export async function crearEstado(data) {
    const res = await fetch(`${API_BASE_URL}/api/estados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}
