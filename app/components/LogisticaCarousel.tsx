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
  Cell,
} from "recharts";
import {
  estadoLineas,
  remitosResumen,
  remitosPorVendedor,
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
  formatVendedor,
  fmt,
  METRICAS,
  METRICAS_PRODUCTIVIDAD,
  METRICAS_PENDIENTES_LOG,
  REMITOS_CARDS,
} from "@/app/lib/logistica";

const swrOpts = { refreshInterval: REFRESH_MS, revalidateOnFocus: false };

/** Top de vendedores que entran cómodos en la pantalla */
const TOP_VENDEDORES = 12;

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
  const { data: remitosVendedor = [] } = useSWR<remitosPorVendedor[]>(
    "/api/logistica/remitos_sin_liberacion_por_vendedor",
    fetcher,
    swrOpts,
  );
  const { data: contabilium } = useSWR<ContabiliumAggregatedResponse>(
    `/api/facturacion/contabilium${range}`,
    fetcher,
    swrOpts,
  );

  // --- Agregados (misma lógica que el dashboard) ---
  const totales = useMemo(() => {
    const sorted = [...estado].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const last = sorted[sorted.length - 1];
    const base = estado.reduce(
      (acc, item) => {
        acc.lineas_entrantes += Number(item.lineas_entrantes) || 0;
        acc.lineas_facturadas += Number(item.lineas_facturadas) || 0;
        return acc;
      },
      {
        lineas_entrantes: 0,
        lineas_facturadas: 0,
        lineas_pendientes_logistica: Number(last?.lineas_pendientes_logistica) || 0,
        lineas_pendientes_ctasctes: Number(last?.lineas_pendientes_ctasctes) || 0,
      },
    );
    base.lineas_facturadas += contabilium?.itemsCount || 0;
    return base;
  }, [estado, contabilium]);

  const chartData = useMemo(() => {
    const byDateCount = contabilium?.byDateCount || {};
    return [...estado]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((item) => ({
        fechaCorta: formatFechaCorta(item.fecha),
        lineas_entrantes: Number(item.lineas_entrantes) || 0,
        lineas_facturadas:
          (Number(item.lineas_facturadas) || 0) + (byDateCount[item.fecha] || 0),
        lineas_pendientes_logistica: Number(item.lineas_pendientes_logistica) || 0,
        lineas_pendientes_ctasctes: Number(item.lineas_pendientes_ctasctes) || 0,
      }));
  }, [estado, contabilium]);

  const snapshot = useMemo(() => {
    const sorted = [...estado].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted[sorted.length - 1];
  }, [estado]);

  const totalesProductividad = useMemo(
    () =>
      productividad.reduce(
        (acc, item) => {
          acc.lineas_reposicion += Number(item.lineas_reposicion) || 0;
          acc.lineas_preparadas += Number(item.lineas_preparadas) || 0;
          acc.lineas_empaquetadas += Number(item.lineas_empaquetadas) || 0;
          return acc;
        },
        { lineas_reposicion: 0, lineas_preparadas: 0, lineas_empaquetadas: 0 },
      ),
    [productividad],
  );

  const remitosChartData = useMemo(
    () =>
      [...remitosVendedor]
        .sort((a, b) => b.cantidad_remitos - a.cantidad_remitos)
        .slice(0, TOP_VENDEDORES)
        .map((item) => ({ ...item, nombre: formatVendedor(item.vendedor) })),
    [remitosVendedor],
  );

  // --- Definición de slides ---
  const slides = useMemo(
    () => [
      {
        title: "Estado de Líneas por Día",
        subtitle: `${startDate} → ${endDate}`,
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1d5273" />
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
                    wrapperStyle={{ paddingTop: 12, fontSize: 20, fontWeight: 600 }}
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
        subtitle: `${startDate} → ${endDate}`,
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
          <div className="flex min-h-0 flex-1 flex-col gap-8">
            <CardRow
              cards={REMITOS_CARDS.map((c) => ({
                label: c.label,
                color: c.color,
                value: remitosResumenData
                  ? c.format(remitosResumenData[c.key])
                  : "—",
              }))}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-2 text-center text-xl font-bold uppercase tracking-wide text-bulonfer-teal-200">
                Remitos por Vendedor
              </p>
              <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={remitosChartData}
                  margin={{ top: 4, right: 60, left: 8, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1d5273" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#cbe3f0", fontSize: 18 }}
                    stroke="#3e657e"
                    tickFormatter={(v) => Number(v).toLocaleString("es-AR")}
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={220}
                    tick={{ fill: "#e8f4fb", fontSize: 18, fontWeight: 600 }}
                    stroke="#3e657e"
                  />
                  <Bar dataKey="cantidad_remitos" name="Remitos" radius={[0, 6, 6, 0]}>
                    {remitosChartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "#38BDF8" : index === 1 ? "#0EA5E9" : "#0E6E96"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        ),
      },
    ],
    [
      startDate,
      endDate,
      totales,
      chartData,
      totalesProductividad,
      snapshot,
      remitosResumenData,
      remitosChartData,
    ],
  );

  // --- Rotación ---
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      SLIDE_MS,
    );
    return () => clearInterval(id);
  }, [slides.length]);

  const current = slides[index];

  return (
    <main className="flex h-screen w-screen flex-col bg-linear-to-br from-bulonfer-blue to-bulonfer-blue-500 px-14 pt-10 pb-8 text-white">
      <Header subtitle={current.subtitle} />

      <section
        key={index}
        className="slide-enter flex min-h-0 flex-1 flex-col"
      >
        <h2 className="mb-6 text-5xl font-extrabold tracking-tight text-white">
          {current.title}
        </h2>
        {current.content}
      </section>

      <Dots count={slides.length} active={index} />
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
  // El valor más largo define el tamaño de fuente para que ninguno desborde.
  const maxLen = Math.max(...cards.map((c) => c.value.length));
  const valueSize = big
    ? "text-8xl"
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
            className={`font-extrabold tabular-nums leading-none text-white ${valueSize}`}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-3 rounded-full transition-all duration-500 ${
            i === active ? "w-12 bg-bulonfer-teal" : "w-3 bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}
