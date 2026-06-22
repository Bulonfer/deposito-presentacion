"use client";

import { useEffect, useMemo, useState } from "react";
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
  ContabiliumAggregatedResponse,
} from "@/app/utils/types";
import {
  fetcher,
  SLIDE_MS,
  REFRESH_MS,
  RANGE_DAYS,
  getLocalDateString,
  formatFechaCorta,
  fmt,
  METRICAS,
  METRICAS_PRODUCTIVIDAD,
  METRICAS_PENDIENTES_LOG,
  REMITOS_CARDS,
} from "@/app/lib/logistica";

const swrOpts = { refreshInterval: REFRESH_MS, revalidateOnFocus: false };

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
                label: m.label,
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
        title: "Remitos Sin Liberación",
        subtitle: "Pendientes de liberar",
        content: (
          <div className="flex flex-1 items-center">
            <CardRow
              big
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
    ],
    [
      endDate,
      totales,
      chartData,
      totalesProductividad,
      snapshot,
      remitosResumenData,
    ],
  );

  // --- Rotación ---
  const [index, setIndex] = useState(0);
  // El contador se reinicia al cambiar de slide (incluida la navegación manual).
  useEffect(() => {
    const id = setTimeout(
      () => setIndex((i) => (i + 1) % slides.length),
      SLIDE_MS,
    );
    return () => clearTimeout(id);
  }, [index, slides.length]);

  const current = slides[index];

  return (
    <main className="flex h-screen w-screen flex-col bg-linear-to-br from-bulonfer-blue to-bulonfer-blue-500 px-14 pt-10 pb-8 text-white">
      <Header subtitle={current.subtitle} />

      <section key={index} className="slide-enter flex min-h-0 flex-1 flex-col">
        <h2 className="mb-6 text-5xl font-extrabold tracking-tight text-white">
          {current.title}
        </h2>
        {current.content}
      </section>

      <Dots count={slides.length} active={index} onSelect={setIndex} />
    </main>
  );
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
      <div className="flex items-center gap-4">
        <span className="rounded-xl bg-bulonfer-teal px-4 py-2 text-2xl font-black tracking-tight text-bulonfer-blue-500">
          BULONFER
        </span>
        <span className="text-2xl font-semibold text-bulonfer-teal-200">
          Logística · {subtitle}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-xl font-bold uppercase tracking-widest text-emerald-400">
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
          En vivo
        </span>
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

type CardData = { label: string; color: string; value: string };

function CardRow({ cards, big = false }: { cards: CardData[]; big?: boolean }) {
  // El valor más largo define el tamaño de fuente para que ninguno desborde ni corte línea.
  const maxLen = Math.max(...cards.map((c) => c.value.length));
  const valueSize = big
    ? maxLen > 9
      ? "text-6xl"
      : "text-8xl"
    : cards.length >= 4 || maxLen > 9
      ? "text-5xl"
      : "text-7xl";
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
            className="mb-3 truncate text-xl font-bold uppercase tracking-widest"
            style={{ color: c.color }}
          >
            {c.label}
          </h3>
          <p
            className={`whitespace-nowrap font-extrabold tabular-nums leading-none text-white ${valueSize}`}
          >
            {c.value}
          </p>
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
