"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  estadoLineas,
  remitosResumen,
  productividadPorDia,
  seccionRecepcion,
  seccionPendientesImportacion,
  seccionPendientesMercaderia,
  pendientesLogisticaMensual,
  ContabiliumAggregatedResponse,
  climaActual,
  versionApp,
} from "@/app/utils/types";
import { describirClima, REFRESH_CLIMA_MS } from "@/app/lib/clima";
import {
  fetcher,
  SLIDE_MS,
  REFRESH_MS,
  REFRESH_HISTORICO_MS,
  REFRESH_VERSION_MS,
  RANGE_DAYS,
  getLocalDateString,
  getMesAnteriorRange,
  contarDiasHabiles,
  formatFechaCorta,
  formatMesAnio,
  fmt,
  METRICAS,
  METRICAS_MES_ANTERIOR,
  METRICAS_PRODUCTIVIDAD,
  METRICAS_PENDIENTES_LOG,
  RECEPCION_CARDS,
  ACTIVACIONES_CARDS,
  FACTURA_COMPRA_CARDS,
  REMITOS_CARDS,
} from "@/app/lib/logistica";

/** Dónde se recuerda el slide en curso para sobrevivir a una recarga. */
const SLIDE_STORAGE_KEY = "logistica:slide";

const swrOpts = { refreshInterval: REFRESH_MS, revalidateOnFocus: false };
const swrOptsHistorico = {
  refreshInterval: REFRESH_HISTORICO_MS,
  revalidateOnFocus: false,
};

export default function LogisticaCarousel() {
  // Rango: últimos RANGE_DAYS días, recalculado cuando cambia el día.
  const [dayTick, setDayTick] = useState(() => getLocalDateString(new Date()));
  useEffect(() => {
    const id = setInterval(
      () => setDayTick(getLocalDateString(new Date())),
      60 * 1000,
    );
    return () => clearInterval(id);
  }, []);

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const desde = new Date();
    desde.setDate(today.getDate() - (RANGE_DAYS - 1));
    return {
      startDate: getLocalDateString(desde),
      endDate: getLocalDateString(today),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayTick]);

  const range = `?startDate=${startDate}&endDate=${endDate}`;

  // Mes calendario cerrado anterior, para la sección comparativa.
  const mesAnterior = useMemo(
    () => getMesAnteriorRange(new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayTick],
  );
  const rangeMesAnterior = `?startDate=${mesAnterior.startDate}&endDate=${mesAnterior.endDate}`;

  const { data: estado = [] } = useSWR<estadoLineas[]>(
    `/api/logistica/estado_lineas${range}`,
    fetcher,
    swrOpts,
  );
  const { data: productividad = [] } = useSWR<productividadPorDia[]>(
    `/api/logistica/productividad_por_dia${range}`,
    fetcher,
    swrOpts,
  );
  const { data: remitosResumenData } = useSWR<remitosResumen>(
    "/api/logistica/remitos_sin_liberacion_resumen",
    fetcher,
    swrOpts,
  );
  const { data: contabilium } = useSWR<ContabiliumAggregatedResponse>(
    `/api/facturacion/contabilium${range}`,
    fetcher,
    swrOpts,
  );
  // Recepción agrega todo el período en una sola fila: se pide solo hoy,
  // igual que el filtro por defecto del dashboard.
  const { data: recepcion } = useSWR<seccionRecepcion>(
    `/api/logistica/seccion_recepcion?startDate=${endDate}&endDate=${endDate}`,
    fetcher,
    swrOpts,
  );
  const { data: activaciones } = useSWR<seccionPendientesImportacion>(
    "/api/logistica/seccion_pendientes_importacion",
    fetcher,
    swrOpts,
  );
  const { data: facturaCompra } = useSWR<seccionPendientesMercaderia>(
    "/api/logistica/seccion_pendientes_mercaderia",
    fetcher,
    swrOpts,
  );
  const { data: estadoMesAnterior = [] } = useSWR<estadoLineas[]>(
    `/api/logistica/estado_lineas${rangeMesAnterior}`,
    fetcher,
    swrOptsHistorico,
  );
  const { data: productividadMesAnterior = [] } = useSWR<productividadPorDia[]>(
    `/api/logistica/productividad_por_dia${rangeMesAnterior}`,
    fetcher,
    swrOptsHistorico,
  );
  const { data: contabiliumMesAnterior } =
    useSWR<ContabiliumAggregatedResponse>(
      `/api/facturacion/contabilium${rangeMesAnterior}`,
      fetcher,
      swrOptsHistorico,
    );
  // Foto de pendientes del mes cerrado. Devuelve null si ese mes es anterior al
  // alta del snapshot en la BD: esa historia no existe y no se reconstruye.
  const { data: pendientesMesAnterior } =
    useSWR<pendientesLogisticaMensual | null>(
      `/api/logistica/pendientes_logistica_mensual?mes=${mesAnterior.startDate}`,
      fetcher,
      swrOptsHistorico,
    );

  // --- Agregados ---
  // Las tarjetas usan SOLO la fila de hoy; el gráfico (más abajo) usa toda la semana.
  const hoyRow = useMemo(() => {
    const sorted = [...estado].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted.find((d) => d.fecha === endDate) ?? sorted[sorted.length - 1];
  }, [estado, endDate]);

  const totales = useMemo(() => {
    const facturadasContab = contabilium?.byDateCount?.[endDate] || 0;
    return {
      lineas_entrantes: Number(hoyRow?.lineas_entrantes) || 0,
      lineas_facturadas:
        (Number(hoyRow?.lineas_facturadas) || 0) + facturadasContab,
      lineas_pendientes_logistica:
        Number(hoyRow?.lineas_pendientes_logistica) || 0,
      lineas_pendientes_ctasctes:
        Number(hoyRow?.lineas_pendientes_ctasctes) || 0,
    };
  }, [hoyRow, contabilium, endDate]);

  const chartData = useMemo(() => {
    const byDateCount = contabilium?.byDateCount || {};
    return [...estado]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((item) => ({
        fechaCorta: formatFechaCorta(item.fecha),
        lineas_entrantes: Number(item.lineas_entrantes) || 0,
        lineas_facturadas:
          (Number(item.lineas_facturadas) || 0) +
          (byDateCount[item.fecha] || 0),
        lineas_pendientes_logistica:
          Number(item.lineas_pendientes_logistica) || 0,
        lineas_pendientes_ctasctes:
          Number(item.lineas_pendientes_ctasctes) || 0,
      }));
  }, [estado, contabilium]);

  const snapshot = hoyRow;

  const totalesProductividad = useMemo(() => {
    const hoy = productividad.find((d) => d.fecha === endDate);
    return {
      lineas_reposicion: Number(hoy?.lineas_reposicion) || 0,
      lineas_preparadas: Number(hoy?.lineas_preparadas) || 0,
      lineas_empaquetadas: Number(hoy?.lineas_empaquetadas) || 0,
    };
  }, [productividad, endDate]);

  // Totales del mes cerrado anterior (suma de todas las filas diarias del período).
  const totalesMesAnterior = useMemo(() => {
    const facturadasContab = Object.entries(
      contabiliumMesAnterior?.byDateCount || {},
    ).reduce(
      (acc, [fecha, cant]) =>
        fecha >= mesAnterior.startDate && fecha <= mesAnterior.endDate
          ? acc + (Number(cant) || 0)
          : acc,
      0,
    );

    const lineas = estadoMesAnterior.reduce(
      (acc, row) => {
        acc.lineas_entrantes += Number(row.lineas_entrantes) || 0;
        acc.lineas_facturadas += Number(row.lineas_facturadas) || 0;
        return acc;
      },
      { lineas_entrantes: 0, lineas_facturadas: 0 },
    );

    const prod = productividadMesAnterior.reduce(
      (acc, row) => {
        acc.lineas_reposicion += Number(row.lineas_reposicion) || 0;
        acc.lineas_preparadas += Number(row.lineas_preparadas) || 0;
        acc.lineas_empaquetadas += Number(row.lineas_empaquetadas) || 0;
        return acc;
      },
      { lineas_reposicion: 0, lineas_preparadas: 0, lineas_empaquetadas: 0 },
    );

    const totales = {
      ...lineas,
      lineas_facturadas: lineas.lineas_facturadas + facturadasContab,
      ...prod,
    };

    // Promedio sobre los días hábiles del calendario (lun-vie), tenga o no
    // movimiento cada día. Solo aplica a entrantes y facturadas.
    const diasHabiles = contarDiasHabiles(
      mesAnterior.startDate,
      mesAnterior.endDate,
    );
    const promedio = (v: number) => (diasHabiles > 0 ? v / diasHabiles : 0);

    return {
      ...totales,
      diasHabiles,
      promedios: {
        lineas_entrantes: promedio(totales.lineas_entrantes),
        lineas_facturadas: promedio(totales.lineas_facturadas),
      },
    };
  }, [
    estadoMesAnterior,
    productividadMesAnterior,
    contabiliumMesAnterior,
    mesAnterior,
  ]);

  // --- Definición de slides ---
  const slides = useMemo(
    () => [
      {
        title: "Estado de Líneas por Día",
        subtitle: `Hoy ${endDate} · gráfico últimos ${RANGE_DAYS} días`,
        content: (
          <div className="flex min-h-0 flex-1 flex-col gap-8">
            <CardRow
              cards={METRICAS.map((m) => ({
                label: m.labelCard,
                color: m.color,
                value: fmt(totales[m.key]),
              }))}
            />
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#1d5273"
                  />
                  <XAxis
                    dataKey="fechaCorta"
                    interval={0}
                    tick={{ fill: "#cbe3f0", fontSize: 22, fontWeight: 700 }}
                    stroke="#3e657e"
                  />
                  <YAxis
                    tick={{ fill: "#cbe3f0", fontSize: 18 }}
                    stroke="#3e657e"
                    tickFormatter={(v) => Number(v).toLocaleString("es-AR")}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: 12,
                      fontSize: 20,
                      fontWeight: 600,
                    }}
                    formatter={(value) => (
                      <span style={{ color: "#e8f4fb" }}>{value}</span>
                    )}
                  />
                  {METRICAS.map((m) => (
                    <Bar
                      key={m.key}
                      dataKey={m.key}
                      name={m.label}
                      fill={m.color}
                      radius={[6, 6, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ),
      },
      {
        title: "Líneas Pendientes Logística",
        subtitle: "Estado actual",
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              big
              cards={METRICAS_PENDIENTES_LOG.map((m) => ({
                label: m.label,
                color: m.color,
                value: fmt(Number(snapshot?.[m.key]) || 0),
              }))}
            />
          </div>
        ),
      },
      {
        title: "Productividad por Equipo",
        subtitle: `Hoy ${endDate}`,
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              big
              cards={METRICAS_PRODUCTIVIDAD.map((m) => ({
                label: m.label,
                color: m.color,
                value: fmt(totalesProductividad[m.key]),
              }))}
            />
          </div>
        ),
      },
      {
        title: "Remitos Sin Liberación",
        subtitle: "Pendientes de liberar",
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              big
              shrink
              cards={REMITOS_CARDS.filter(
                (c) => c.key !== "valor_declarado_sin_iva",
              ).map((c) => ({
                label: c.label,
                color: c.color,
                value: remitosResumenData
                  ? c.format(remitosResumenData[c.key])
                  : "—",
              }))}
            />
          </div>
        ),
      },
      {
        title: "Recepción",
        subtitle: `Hoy ${endDate}`,
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              cards={RECEPCION_CARDS.map((c) => ({
                label: c.labelCard,
                color: c.color,
                value: fmt(Number(recepcion?.[c.key]) || 0),
                breakdown: c.breakdown.map((b) => ({
                  label: b.label,
                  value: fmt(Number(recepcion?.[b.key]) || 0),
                })),
              }))}
            />
          </div>
        ),
      },
      {
        title: "Activaciones de Gastos",
        subtitle: "Pendientes de importación",
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              big
              cards={ACTIVACIONES_CARDS.map((c) => ({
                label: c.label,
                color: c.color,
                value: fmt(Number(activaciones?.[c.key]) || 0),
              }))}
            />
          </div>
        ),
      },
      {
        title: "Factura de Compra",
        subtitle: "Pendientes de mercadería",
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              big
              cards={FACTURA_COMPRA_CARDS.map((c) => ({
                label: c.label,
                color: c.color,
                value: fmt(Number(facturaCompra?.[c.key]) || 0),
              }))}
            />
          </div>
        ),
      },
      {
        title: `Resumen ${formatMesAnio(mesAnterior.endDate)}`,
        subtitle: `Mes anterior · ${formatFechaCorta(mesAnterior.startDate)} al ${formatFechaCorta(mesAnterior.endDate)} · ${totalesMesAnterior.diasHabiles} días hábiles`,
        content: (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-10">
            <Grupo title="Estado de Líneas">
              <CardRow
                cards={METRICAS_MES_ANTERIOR.map((m) => ({
                  label: m.label,
                  color: m.color,
                  value:
                    m.modo === "acumulado"
                      ? fmt(totalesMesAnterior[m.key])
                      : pendientesMesAnterior
                        ? fmt(pendientesMesAnterior.pendientes_logistica)
                        : "s/d",
                  breakdown:
                    m.modo === "acumulado"
                      ? [
                          {
                            label: "Prom. día hábil",
                            value: fmt(
                              Math.round(totalesMesAnterior.promedios[m.key]),
                            ),
                          },
                        ]
                      : [
                          {
                            label: "Foto al cierre",
                            value: pendientesMesAnterior
                              ? formatFechaCorta(
                                  pendientesMesAnterior.fecha_foto,
                                )
                              : "sin registro",
                          },
                        ],
                }))}
              />
            </Grupo>
            <Grupo title="Productividad por Equipo">
              <CardRow
                cards={METRICAS_PRODUCTIVIDAD.map((m) => ({
                  label: m.label,
                  color: m.color,
                  value: fmt(totalesMesAnterior[m.key]),
                }))}
              />
            </Grupo>
          </div>
        ),
      },
    ],
    [
      endDate,
      totales,
      chartData,
      totalesProductividad,
      recepcion,
      activaciones,
      facturaCompra,
      snapshot,
      remitosResumenData,
      mesAnterior,
      totalesMesAnterior,
      pendientesMesAnterior,
    ],
  );

  // --- Rotación ---
  const [index, setIndex] = useState(0);
  const hayActualizacion = useActualizacionPendiente();

  // Se recuerda el slide en curso para que cualquier recarga (deploy, F5 manual,
  // corte de luz) retome donde estaba en vez de volver al principio.
  const posicionRestaurada = useRef(false);
  useEffect(() => {
    if (!posicionRestaurada.current) {
      posicionRestaurada.current = true;
      const guardado = Number(sessionStorage.getItem(SLIDE_STORAGE_KEY));
      // El módulo cubre el caso de que el deploy haya cambiado la cantidad de
      // slides y el índice guardado ya no exista.
      if (Number.isInteger(guardado) && guardado > 0) {
        // Leerlo en el inicializador del useState rompería la hidratación: en el
        // server no hay sessionStorage y el HTML sale siempre con el slide 0.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIndex(guardado % slides.length);
      }
      return;
    }
    sessionStorage.setItem(SLIDE_STORAGE_KEY, String(index));
  }, [index, slides.length]);

  // El contador se reinicia al cambiar de slide (incluida la navegación manual).
  useEffect(() => {
    const id = setTimeout(() => {
      const siguiente = (index + 1) % slides.length;
      // Con un deploy pendiente, la recarga se hace justo al cerrar la vuelta:
      // la tele ya iba a mostrar el primer slide, así que el corte no se nota.
      if (siguiente === 0 && hayActualizacion) {
        sessionStorage.removeItem(SLIDE_STORAGE_KEY);
        window.location.reload();
        return;
      }
      setIndex(siguiente);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, slides.length, hayActualizacion]);

  const current = slides[index];

  return (
    <main className="flex h-screen w-screen flex-col bg-linear-to-br from-bulonfer-blue to-bulonfer-blue-500 px-14 pt-10 pb-8 text-white">
      <Header subtitle={current.subtitle} />

      <section key={index} className="slide-enter flex min-h-0 flex-1 flex-col">
        <h2 className="mb-6 text-5xl font-extrabold tracking-tight text-white pt-4">
          {current.title}
        </h2>
        {current.content}
      </section>

      <Dots count={slides.length} active={index} onSelect={setIndex} />
    </main>
  );
}

/* ---------- Hooks ---------- */

/**
 * Avisa cuando el server pasó a servir un build distinto del que cargó esta
 * pestaña, o sea cuando hubo un deploy. Los datos ya se refrescan solos vía SWR:
 * lo único que obliga a recargar la página es el código nuevo, que es un evento
 * raro. Por eso se consulta en vez de recargar a ciegas cada X minutos.
 */
function useActualizacionPendiente() {
  const { data } = useSWR<versionApp>("/api/version", fetcher, {
    refreshInterval: REFRESH_VERSION_MS,
    revalidateOnFocus: false,
  });
  const versionCargada = useRef<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  useEffect(() => {
    const version = data?.version;
    // Sin respuesta (server caído, red cortada) no se asume nada: la tele sigue
    // rotando con los últimos datos que tenga.
    if (!version) return;
    if (versionCargada.current === null) {
      versionCargada.current = version;
      return;
    }
    if (version !== versionCargada.current) setPendiente(true);
  }, [data]);

  return pendiente;
}

/* ---------- Subcomponentes de presentación ---------- */

function Header({ subtitle }: { subtitle: string }) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="shrink-0 rounded-xl bg-bulonfer-teal px-4 py-2 text-2xl font-black tracking-tight text-bulonfer-blue-500">
          BULONFER
        </span>
        {/* Cede espacio antes que el reloj y el clima si la pantalla es angosta. */}
        <span className="truncate text-2xl font-semibold text-bulonfer-teal-200">
          Logística · {subtitle}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-6 pl-6">
        <span className="flex items-center gap-2 text-xl font-bold uppercase tracking-widest text-emerald-400">
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
          En vivo
        </span>
        <Clima />
        <span
          suppressHydrationWarning
          className="font-mono text-4xl font-bold tabular-nums"
        >
          {now.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </header>
  );
}

/** Clima actual del depósito (Open-Meteo). Ver `app/api/clima/route.ts`. */
function Clima() {
  const { data: clima } = useSWR<climaActual>("/api/clima", fetcher, {
    refreshInterval: REFRESH_CLIMA_MS,
    revalidateOnFocus: false,
  });

  // Sin internet o API caída no se renderiza nada: el resto del header queda igual.
  if (!clima) return null;

  const { label, Icon } = describirClima(clima.codigo, clima.esDia);

  return (
    <div className="flex items-center gap-2">
      <Icon className="shrink-0 text-6xl text-bulonfer-teal-200" />
      <span className="text-4xl font-bold tabular-nums">
        {clima.temperatura}°
      </span>
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap text-lg font-semibold uppercase tracking-wider text-bulonfer-teal-200">
          {label}
        </span>
        <span className="text-lg font-medium tabular-nums text-white/60">
          {clima.maxima}° / {clima.minima}°
        </span>
      </span>
    </div>
  );
}

/** Encabezado de un bloque dentro de un slide que agrupa varias filas de tarjetas. */
function Grupo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <h3 className="text-2xl font-bold uppercase tracking-widest text-bulonfer-teal-200">
          {title}
        </h3>
        <span className="h-px flex-1 bg-white/15" />
      </div>
      {children}
    </div>
  );
}

type CardData = {
  label: string;
  color: string;
  value: string;
  /** Desglose opcional debajo del valor (ej. Nacionales / Importados). */
  breakdown?: { label: string; value: string }[];
};

const VALUE_SIZES = [
  "text-8xl",
  "text-7xl",
  "text-6xl",
  "text-5xl",
  "text-4xl",
];

function CardRow({
  cards,
  big = false,
  shrink = false,
}: {
  cards: CardData[];
  big?: boolean;
  /** Baja dos escalones el tamaño del valor (para filas con unidades, ej. "kg"). */
  shrink?: boolean;
}) {
  // El valor más largo define el tamaño de fuente para que ninguno desborde ni corte línea.
  const maxLen = Math.max(...cards.map((c) => c.value.length));
  let sizeIdx = big ? 0 : 1;
  if (maxLen > 9 || (!big && cards.length >= 4)) sizeIdx += 2;
  if (shrink) sizeIdx += 2;
  const valueSize = VALUE_SIZES[Math.min(sizeIdx, VALUE_SIZES.length - 1)];
  return (
    <div
      className="grid w-full gap-6"
      style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          className="min-w-0 overflow-hidden rounded-3xl border-l-8 bg-white/5 px-8 py-7 shadow-lg backdrop-blur"
          style={{ borderLeftColor: c.color }}
        >
          <h3
            className={`mb-3 text-xl font-bold uppercase tracking-widest ${
              c.label.includes("\n") ? "whitespace-pre-line" : "truncate"
            }`}
            style={{ color: c.color }}
          >
            {c.label}
          </h3>
          <p
            className={`whitespace-nowrap font-extrabold tabular-nums leading-none text-white ${valueSize}`}
          >
            {c.value}
          </p>
          {c.breakdown && (
            <div className="mt-6 flex flex-col gap-2 border-t border-white/15 pt-4">
              {c.breakdown.map((b) => (
                <div
                  key={b.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate text-lg font-medium uppercase tracking-wider text-white/60">
                    {b.label}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-white/90">
                    {b.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Dots({
  count,
  active,
  onSelect,
}: {
  count: number;
  active: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Ir a la sección ${i + 1}`}
          onClick={() => onSelect(i)}
          className="group flex h-10 items-center px-1"
        >
          <span
            className={`h-4 rounded-full transition-all duration-500 group-hover:bg-bulonfer-teal-200 ${
              i === active ? "w-14 bg-bulonfer-teal" : "w-4 bg-white/25"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
