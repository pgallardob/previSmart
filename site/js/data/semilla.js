/* Synthetic demonstration only: no real affiliate identity or official offer codes. */
import { crearCliente, actualizarExpediente } from '../core/store.js';

export function cargarClienteSCOMP() {
  const c = crearCliente({ nombre: 'DEMOSTRACIÓN — Cliente de ejemplo' });
  if (!c) return null;
  const ofertas = Array.from({ length: 14 }, (_, i) => ({
    aseguradora: `Aseguradora de ejemplo ${String.fromCharCode(65 + (i % 3))}`,
    clasificacion: 'AA', pensionUF: Number((12 - i * 0.1).toFixed(2)), primaUF: 1500,
    codigoOferta: `DEMO-${String(i + 1).padStart(4, '0')}`, fuente: 'demostracion',
    periodoGarantizadoAnios: i >= 9 ? 12 : 0,
    ...(i >= 9 ? { aumentoTemporalPct: 100, aumentoTemporalMeses: 60 } : {}),
    notas: 'Datos sintéticos: no constituyen una oferta de ninguna aseguradora.'
  }));
  actualizarExpediente(c.id, {
    perfil: { nombre: 'Cliente de ejemplo', rut: '00.000.000-0', fechaNacimiento: '1960-01-01', sexo: 'M', estadoCivil: 'casado',
      rutaTipo: 'vejez', yaPensionado: false, afp: 'Modelo', saludTipo: 'fonasa', otrasPensiones: [] },
    beneficiarios: [{ tipo: 'conyuge', nombre: 'Beneficiario de ejemplo', fechaNacimiento: '1965-01-01' }],
    saldo: { obligatorio: 61500000, apv: 0, cuenta2: 0, pensionEstimadaUF: 12 },
    ofertas, ingesta: { demostracion: true, eventos: [] },
    ruta: { etapa: 0, fechas: {} }
  });
  return c;
}
