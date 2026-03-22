// API Helper - Parte Diario
const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || "";

// --- PARTES ---

export async function getPartes(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
            query.append(key, value);
        }
    });
    const qs = query.toString();
    const res = await fetch(`${API_BASE_URL}/api/partes${qs ? '?' + qs : ''}`);
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

export async function actualizarParte(parteId, data) {
    const res = await fetch(`${API_BASE_URL}/api/partes/${parteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Error ${res.status}`);
    }
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
