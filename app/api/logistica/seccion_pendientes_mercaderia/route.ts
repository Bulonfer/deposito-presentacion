import { NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import { seccionPendientesMercaderia } from "@/app/utils/types";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export async function GET() {
  const apiUrl = process.env.API_URL;
  const apiKey = process.env.API_TOKEN || process.env.API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "API_URL or API_TOKEN/API_KEY is not configured in .env" },
      { status: 500 },
    );
  }

  try {
    const response = await axios.post(
      `${apiUrl}/rpc/seccion_pendientes_mercaderia`,
      {},
      {
        httpsAgent,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const rows = (response.data as seccionPendientesMercaderia[]) || [];
    const empty: seccionPendientesMercaderia = {
      cant_facturas: 0,
      cant_lineas: 0,
      cant_proveedores: 0,
    };

    return NextResponse.json(rows[0] ?? empty);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error fetching seccion_pendientes_mercaderia:",
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
