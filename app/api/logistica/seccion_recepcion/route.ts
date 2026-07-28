import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import { seccionRecepcion } from "@/app/utils/types";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  let startDate = searchParams.get("startDate");
  let endDate = searchParams.get("endDate");

  // Sin fechas: limitar a últimos 6 meses por defecto
  if (!startDate?.trim() || !endDate?.trim()) {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    endDate = endDate?.trim() || formatDateYYYYMMDD(today);
    startDate = startDate?.trim() || formatDateYYYYMMDD(sixMonthsAgo);
  }

  const apiUrl = process.env.API_URL;
  const apiKey = process.env.API_TOKEN || process.env.API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "API3_URL/API_URL or API_TOKEN/API_KEY is not configured in .env" },
      { status: 500 },
    );
  }

  try {
    const response = await axios.post(
      `${apiUrl}/rpc/seccion_recepcion`,
      {
        p_fecha_desde: startDate,
        p_fecha_hasta: endDate,
      },
      {
        httpsAgent,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const rows = (response.data as seccionRecepcion[]) || [];
    const empty: seccionRecepcion = {
      proveedores_nacionales: 0,
      proveedores_importados: 0,
      proveedores_total: 0,
      lineas_nacional: 0,
      lineas_importado: 0,
      lineas_total: 0,
      lotes_nacional: 0,
      lotes_importado: 0,
      lotes_total: 0,
      guardadas_picking: 0,
      guardadas_almacenamiento: 0,
      guardadas_total: 0,
    };

    return NextResponse.json(rows[0] ?? empty);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error fetching seccion_recepcion:",
        error.response?.data || error.message,
      );
      return NextResponse.json(
        {
          error:
            error.response?.data?.message ||
            error.message ||
            "Error al obtener datos de la API",
        },
        { status: error.response?.status || 500 },
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
