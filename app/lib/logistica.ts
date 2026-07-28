import axios from "axios";
import {
  seccionRecepcion,
  seccionPendientesImportacion,
  seccionPendientesMercaderia,
} from "@/app/utils/types";

export const fetcher = (url: string) =>
  axios.get(url).then((res) => res.data);

/** Cada cuánto rota el carousel (ms) */
export const SLIDE_MS = 18000;
/** Cada cuánto se refrescan los datos (ms). La BD sincroniza cada ~15 min. */
export const REFRESH_MS = 10 * 60 * 1000;
/** Días que cubre el gráfico de "Estado de Líneas por Día". Las tarjetas siempre usan hoy. */
export const RANGE_DAYS = 7;

export const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatFechaCorta = (fecha: string) => {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
};

export const fmt = (v: number) => Number(v || 0).toLocaleString("es-AR");

export const fmtMoneda = (v: number) =>
  Number(v || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

export const fmtPeso = (v: number) =>
  `${Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })} kg`;

/** Acorta "Juan Carlos Perez Lopez" -> "Juan Lopez" */
export const formatVendedor = (nombre: string) => {
  const partes = nombre.trim().split(" ");
  if (partes.length <= 2) return nombre;
  return `${partes[0]} ${partes[partes.length - 1]}`;
};

/** `labelCard` usa \n para forzar el salto de línea en las tarjetas; la leyenda del gráfico usa `label`. */
export const METRICAS = [
  { key: "lineas_entrantes" as const, label: "Líneas Entrantes", labelCard: "Líneas\nEntrantes", color: "#38BDF8" },
  { key: "lineas_facturadas" as const, label: "Líneas Facturadas", labelCard: "Líneas\nFacturadas", color: "#10B981" },
  { key: "lineas_pendientes_logistica" as const, label: "Pendientes Logística", labelCard: "Pendientes\nLogística", color: "#F59E0B" },
  { key: "lineas_pendientes_ctasctes" as const, label: "Pendientes Ctas Ctes", labelCard: "Pendientes\nCtas Ctes", color: "#EF4444" },
];

export const METRICAS_PRODUCTIVIDAD = [
  { key: "lineas_reposicion" as const, label: "Líneas Reposición", color: "#F43F5E" },
  { key: "lineas_preparadas" as const, label: "Líneas Preparadas", color: "#14B8A6" },
  { key: "lineas_empaquetadas" as const, label: "Líneas Empaquetadas", color: "#F97316" },
];

export const METRICAS_PENDIENTES_LOG = [
  { key: "lineas_confirmadas" as const, label: "Confirmadas", color: "#06B6D4" },
  { key: "lineas_en_preparacion" as const, label: "En Preparación", color: "#8B5CF6" },
  { key: "lineas_en_empaquetado" as const, label: "En Empaquetado", color: "#F97316" },
];

/** Recepción: cada tarjeta muestra el total y su desglose (igual que el dashboard). */
export const RECEPCION_CARDS: {
  key: keyof seccionRecepcion;
  label: string;
  labelCard: string;
  color: string;
  breakdown: { label: string; key: keyof seccionRecepcion }[];
}[] = [
  {
    key: "proveedores_total",
    label: "Cantidad de Proveedores",
    labelCard: "Cantidad de\nProveedores",
    color: "#38BDF8",
    breakdown: [
      { label: "Nacionales", key: "proveedores_nacionales" },
      { label: "Importados", key: "proveedores_importados" },
    ],
  },
  {
    key: "lineas_total",
    label: "Cantidad de Líneas",
    labelCard: "Cantidad de\nLíneas",
    color: "#10B981",
    breakdown: [
      { label: "Nacional", key: "lineas_nacional" },
      { label: "Importado", key: "lineas_importado" },
    ],
  },
  {
    key: "lotes_total",
    label: "Lotes Generados",
    labelCard: "Lotes\nGenerados",
    color: "#A855F7",
    breakdown: [
      { label: "Nacional", key: "lotes_nacional" },
      { label: "Importado", key: "lotes_importado" },
    ],
  },
  {
    key: "guardadas_total",
    label: "Líneas Guardadas",
    labelCard: "Líneas\nGuardadas",
    color: "#F59E0B",
    breakdown: [
      { label: "Picking", key: "guardadas_picking" },
      { label: "Almacenamiento", key: "guardadas_almacenamiento" },
    ],
  },
];

export const ACTIVACIONES_CARDS: {
  key: keyof seccionPendientesImportacion;
  label: string;
  color: string;
}[] = [
  { key: "cant_activaciones", label: "Cantidad de Activaciones", color: "#38BDF8" },
  { key: "cant_lineas", label: "Cantidad de Líneas", color: "#10B981" },
  { key: "cant_proveedores", label: "Proveedores Pendientes", color: "#A855F7" },
];

export const FACTURA_COMPRA_CARDS: {
  key: keyof seccionPendientesMercaderia;
  label: string;
  color: string;
}[] = [
  { key: "cant_facturas", label: "Cantidad de Facturas", color: "#38BDF8" },
  { key: "cant_lineas", label: "Cantidad de Líneas", color: "#10B981" },
  { key: "cant_proveedores", label: "Proveedores Pendientes", color: "#A855F7" },
];

export const REMITOS_CARDS = [
  { key: "cantidad_remitos" as const, label: "Cantidad de Remitos", color: "#38BDF8", format: fmt },
  { key: "cantidad_lineas" as const, label: "Cantidad de Líneas", color: "#10B981", format: fmt },
  { key: "valor_declarado_sin_iva" as const, label: "Valor Declarado (S/IVA)", color: "#F59E0B", format: fmtMoneda },
  { key: "peso_total" as const, label: "Peso Total", color: "#A855F7", format: fmtPeso },
];
