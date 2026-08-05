import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import { pendientesLogisticaMensual } from "@/app/utils/types";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mes = searchParams.get("mes")?.trim();

  if (!mes || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(mes)) {
    return NextResponse.json(
      { error: "Parámetro 'mes' inválido: se espera el primer día del mes (YYYY-MM-01)" },
      { status: 400 },
    );
  }

  const apiUrl = process.env.API_URL;
  const apiKey = process.env.API_TOKEN || process.env.API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "API_URL or API_TOKEN/API_KEY is not configured in .env" },
      { status: 500 },
    );
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.append("mes", `eq.${mes}`);

    const response = await axios.get(
      `${apiUrl}/pendientes_logistica_mensual?${queryParams.toString()}`,
      {
        httpsAgent,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    const rows = (response.data as pendientesLogisticaMensual[]) || [];

    // Los meses anteriores al alta del snapshot no tienen fila y no se pueden
    // reconstruir. Se devuelve null (no un cero) para que la presentación
    // pueda mostrar "s/d" en vez de un valor inventado.
    return NextResponse.json(rows[0] ?? null);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error fetching pendientes_logistica_mensual:",
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
