/**
 * Genera HTML de patente estilo placa argentina.
 * Detecta formato automáticamente:
 * - Mercosur: AA 000 AA (2 letras + 3 números + 2 letras)
 * - Vieja: AAA 000 (3 letras + 3 números)
 * - Vieja larga: AA 000 AA pero con patrón viejo
 */
export function renderPatente(dominio) {
    if (!dominio) return '';
    const clean = dominio.replace(/[\s-]/g, '').toUpperCase();

    // Detectar formato
    const esMercosur = /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(clean);
    const esVieja = /^[A-Z]{3}\d{3}$/.test(clean);

    // Formatear texto para display
    let texto = dominio.toUpperCase();
    if (esMercosur) {
        texto = clean.slice(0, 2) + ' ' + clean.slice(2, 5) + ' ' + clean.slice(5);
    } else if (esVieja) {
        texto = clean.slice(0, 3) + ' ' + clean.slice(3);
    }

    const tipo = esMercosur ? 'mercosur' : 'vieja';
    const franja = esMercosur ? '<div class="placa-franja">MERCOSUR</div>' : '';

    return `<div class="patente-placa ${tipo}">
        ${franja}
        <div class="placa-texto">${texto}</div>
    </div>`;
}
