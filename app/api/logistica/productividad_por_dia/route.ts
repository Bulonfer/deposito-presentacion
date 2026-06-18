import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import { productividadPorDia } from "@/app/utils/types";

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
      { error: "API_URL or API_TOKEN/API_KEY is not configured in .env" },
      { status: 500 }
    );
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.append("fecha", `gte.${startDate}`);
    queryParams.append("fecha", `lte.${endDate}`);

    const response = await axios.get(
      `${apiUrl}/productividad_por_dia?${queryParams.toString()}`,
      {
        httpsAgent,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return NextResponse.json(response.data as productividadPorDia[]);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error fetching productividad_por_dia:",
        error.response?.data || error.message
      );
      return NextResponse.json(
        {
          error:
            error.response?.data?.message ||
            error.message ||
            "Error al obtener datos de la API",
        },
        { status: error.response?.status || 500 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
