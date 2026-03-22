/**
 * Categorizador automático de desperfectos.
 * Analiza el texto de la novedad y sugiere el sector/especialidad.
 * Basado en +450 partes reales de un año completo.
 */

const REGLAS = [
    // --- ELECTRICIDAD ---
    {
        sector: "ELECTRICIDAD",
        palabras: [
            "luz", "luces", "lampara", "lamparas", "foco", "focos",
            "optica", "opticas", "giro", "giros", "baliza", "balizas",
            "posicion", "posición", "stop", "led",
            "alta", "baja", "altas", "bajas",  // luces alta/baja
            "alternador", "bateria", "batería", "baterias",
            "fusible", "fusilera", "fusiblera",
            "bocina", "chicharra",
            "arranque", "burro",  // burro de arranque
            "no arranca", "no enciende", "no encendia",
            "carga", "no carga",  // alternador no carga
            "cable", "cables", "cableado", "instalacion electrica",
            "sensor", "relay", "rele",
            "limpiaparabrisas", "escobilla",
            "crucero", "climatic",
            "portalampara", "portalamparas",
            "acrilico", "acrilicos",
            "destellan",
            "triler", "trailer electrico",
        ],
        frases: [
            "no funciona el giro",
            "no funcionan las luces",
            "luces no funcionan",
            "luces generales",
            "reparar luces",
            "revisar luces",
            "arreglar luces",
            "luces en general",
            "luces delanteras",
            "luces traseras",
            "quemada", "quemadas", "quemado",
            "sin funcionar",
            "no tiene bocina",
            "colocar bocina",
            "cable de positivo",
            "cable de negativo",
            "no arranca",
            "no enciende",
        ]
    },
    // --- HERRERÍA ---
    {
        sector: "HERRERIA",
        palabras: [
            "soldar", "soldadura", "desoldado", "desoldo", "desoldó",
            "pala", "joystick", "comando de pala", "tecla de pala",
            "brazo de pala", "alargue de pala", "automatico de pala",
            "barral", "portabarral", "bicicletero",
            "paragolpe", "paragolpes",
            "bisagra", "bisagras",
            "puerta", "puertas", "porton", "portones",
            "manija", "manijas",
            "furgon",  // reparaciones de furgon
            "chapa", "chapón", "chapon",
            "guardabarros", "babero",
            "espejo", "retrovisor",
            "estribo", "escalon",
            "poncho",
            "piso", "piso del furgon",
            "marco", "marcos",
            "vidrio", "ventilete",
            "levantavidrios", "levanta vidrios", "alzacristal", "alza cristal",
            "cinturon", "cinturón",
            "grampas",
        ],
        frases: [
            "soldar",
            "se desoldo", "se desoldó",
            "reparar pala",
            "arreglar pala",
            "revisar pala",
            "pala no funciona",
            "pala no sube",
            "pala no baja",
            "pala se baja sola",
            "joystick de pala",
            "tecla de pala", "tecla del pala",
            "comando de pala",
            "llueve furgon",
            "enderezar",
            "encuadrar",
            "se rompió el joystick",
            "gancho de pala",
            "motor de pala",
            "brazo del espejo",
            "puerta trasera",
            "puertas de furgon",
            "paragolpe",
        ]
    },
    // --- GOMERÍA ---
    {
        sector: "GOMERIA",
        palabras: [
            "cubierta", "cubiertas", "neumatico", "neumaticos", "neumático", "neumáticos",
            "goma", "gomas",
            "pinchada", "pinchadura", "pinchado",
            "engomó", "engomar",
            "calibrar", "inflar",
            "dibujo", "dibujos", "lisas", "lisa",
        ],
        frases: [
            "cambiar cubierta",
            "cambiar cubiertas",
            "cubierta pinchada",
            "rueda pinchada",
            "no tienen dibujo",
            "se patina",
            "cambiar neumaticos",
            "controlar cubiertas",
            "rotar cubiertas",
        ]
    },
    // --- MECÁNICA (default si no matchea nada más fuerte) ---
    {
        sector: "MECANICA",
        palabras: [
            "aceite", "motor", "temperatura", "levanta temperatura",
            "freno", "frenos", "regular frenos",
            "embrague", "caja", "cambio", "cambios", "palanca",
            "inyector", "inyectores", "inyeccion", "inyección",
            "turbo", "compresor",
            "radiador", "agua", "refrigerante",
            "correa", "filtro",
            "escape", "caño de escape",
            "service", "engrase",
            "diferencial", "transmision",
            "direccion", "dirección", "hidraulico de direccion",
            "pulmones", "pulmon", "pulmón",
            "elastico", "elasticos", "elástico", "elásticos",
            "amortiguador", "amortiguadores",
            "tren delantero",
            "cigueñal", "cigüeñal",
            "bomba", "bomba de agua", "bomba inyectora",
            "gasoil", "combustible",
            "bloquea", "bloqueo",
            "pierde aire",
            "pierde aceite",
            "vtv",
            "fluido", "fluidos",
            "manguera",
            "cruzeta", "cruzetas",
        ],
        frases: [
            "agregar aceite",
            "falta aceite",
            "perdida de aceite",
            "pérdida de aceite",
            "levanta temperatura",
            "regular frenos",
            "revisar frenos",
            "realizar service",
            "se bloquea",
            "pierde aire",
            "pierde aceite",
            "pierde combustible",
            "revisar motor",
            "revisar inyectores",
            "cuesta que entren los cambios",
            "no tiene fuerza",
            "revisar fluidos",
            "completar aceite",
            "agregar agua",
            "equipo de frio", "equipo de frío",
        ]
    }
];

/**
 * Categoriza un texto de novedad y retorna el sector sugerido con confianza.
 * @param {string} texto - La descripción del desperfecto
 * @returns {{ sector: string, confianza: number, alternativas: string[] }}
 */
export function categorizar(texto) {
    if (!texto || texto.trim().length < 3) {
        return { sector: "MECANICA", confianza: 0, alternativas: [] };
    }

    const textoLower = texto.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quitar acentos para comparar

    const scores = {};

    for (const regla of REGLAS) {
        let score = 0;

        // Buscar frases (mayor peso)
        for (const frase of regla.frases) {
            const fraseLower = frase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (textoLower.includes(fraseLower)) {
                score += 3;
            }
        }

        // Buscar palabras individuales
        for (const palabra of regla.palabras) {
            const palabraLower = palabra.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            // Buscar como palabra completa o parte de palabra
            const regex = new RegExp(`\\b${palabraLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, "i");
            if (regex.test(textoLower)) {
                score += 1;
            }
        }

        scores[regla.sector] = score;
    }

    // Ordenar por score
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const mejor = sorted[0];
    const segundo = sorted[1];

    // Calcular confianza (0-100)
    const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
    const confianza = totalScore > 0 ? Math.round((mejor[1] / totalScore) * 100) : 0;

    // Alternativas (sectores con score > 0, excluyendo el mejor)
    const alternativas = sorted
        .filter(([sector, score]) => score > 0 && sector !== mejor[0])
        .map(([sector]) => sector);

    return {
        sector: mejor[1] > 0 ? mejor[0] : "MECANICA",
        confianza: mejor[1] > 0 ? confianza : 0,
        alternativas
    };
}

/**
 * Todos los sectores disponibles.
 */
export const SECTORES = ["MECANICA", "ELECTRICIDAD", "HERRERIA", "GOMERIA", "LAVADERO"];
