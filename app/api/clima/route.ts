import { NextResponse } from "next/server";
import axios from "axios";
import { climaActual, OpenMeteoResponse } from "@/app/utils/types";

/** La tele muestra el clima en vivo: nunca servir una lectura del build. */
export const dynamic = "force-dynamic";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Ubicación del depósito: Tandil, Buenos Aires. Se puede sobreescribir por
 * `.env` (CLIMA_LAT / CLIMA_LON / CLIMA_TZ) sin tocar código si se muda.
 */
const LAT = process.env.CLIMA_LAT || "-37.3287";
const LON = process.env.CLIMA_LON || "-59.1369";
const TZ = process.env.CLIMA_TZ || "America/Argentina/Buenos_Aires";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET() {
  try {
    const { data } = await axios.get<OpenMeteoResponse>(OPEN_METEO_URL, {
      params: {
        latitude: LAT,
        longitude: LON,
        current:
          "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m",
        daily: "temperature_2m_max,temperature_2m_min",
        forecast_days: 1,
        timezone: TZ,
      },
      // Si no hay internet, cortar rápido: el header simplemente no muestra clima.
      timeout: 8000,
    });

    const actual = data?.current;
    if (!actual) {
      return NextResponse.json(
        { error: "Open-Meteo respondió sin datos actuales" },
        { status: 502 },
      );
    }

    const hoy = data?.daily;
    const clima: climaActual = {
      temperatura: Math.round(num(actual.temperature_2m)),
      sensacion: Math.round(num(actual.apparent_temperature)),
      humedad: Math.round(num(actual.relative_humidity_2m)),
      viento: Math.round(num(actual.wind_speed_10m)),
      codigo: num(actual.weather_code),
      esDia: num(actual.is_day) === 1,
      maxima: Math.round(num(hoy?.temperature_2m_max?.[0])),
      minima: Math.round(num(hoy?.temperature_2m_min?.[0])),
      actualizado: actual.time || "",
    };

    return NextResponse.json(clima);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error fetching clima (open-meteo):",
        error.response?.data || error.message,
      );
      return NextResponse.json(
        {
          error:
            error.message || "No se pudo obtener el clima desde Open-Meteo",
        },
        { status: error.response?.status || 503 },
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
