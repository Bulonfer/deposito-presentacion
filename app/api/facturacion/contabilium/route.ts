import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import type {
  ContabiliumAggregatedResponse,
  ContabiliumComprobante,
  ContabiliumSearchResponse,
  ContabiliumTokenResponse,
} from "../../../utils/types";

let cachedAccessToken: string | null = null;
let accessTokenExpiresAtMs = 0;
let tokenRefreshPromise: Promise<string> | null = null;
const RANGE_CACHE_TTL_MS = 5 * 60 * 1000;
const rangeCache = new Map<
  string,
  { expiresAt: number; data: ContabiliumAggregatedResponse }
>();
const rangeInFlight = new Map<string, Promise<ContabiliumAggregatedResponse>>();

function pruneRangeCache() {
  const now = Date.now();
  for (const [key, entry] of rangeCache) {
    if (entry.expiresAt <= now) rangeCache.delete(key);
  }
}

function invalidateAccessTokenCache() {
  cachedAccessToken = null;
  accessTokenExpiresAtMs = 0;
}

async function requestNewAccessToken(): Promise<string> {
  const grantType = process.env.CONTABILIUM_GRANT_TYPE?.trim() || "client_credentials";
  const clientId = process.env.CONTABILIUM_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.CONTABILIUM_CLIENT_SECRET?.trim() || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan variables CONTABILIUM_CLIENT_ID/CONTABILIUM_CLIENT_SECRET",
    );
  }

  const formBody = new URLSearchParams();
  formBody.set("grant_type", grantType);
  formBody.set("client_id", clientId);
  formBody.set("client_secret", clientSecret);

  const response = await axios.post<ContabiliumTokenResponse>(
    "https://rest.contabilium.com/token",
    formBody.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  const accessToken = response.data?.access_token?.trim() || "";
  const expiresInRaw = Number(response.data?.expires_in ?? 0);
  const expiresIn = Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : 3600;

  if (!accessToken) {
    throw new Error("No se recibió access_token desde /token");
  }

  // Margen de seguridad para evitar usar token casi vencido.
  const safetySeconds = 60;
  const ttlSeconds = Math.max(expiresIn - safetySeconds, 30);
  cachedAccessToken = accessToken;
  accessTokenExpiresAtMs = Date.now() + ttlSeconds * 1000;

  return accessToken;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < accessTokenExpiresAtMs) {
    return cachedAccessToken;
  }

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = requestNewAccessToken().finally(() => {
      tokenRefreshPromise = null;
    });
  }

  return tokenRefreshPromise;
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.includes("T") ? value.split("T")[0] : value.split(" ")[0];
  const [y, m, d] = raw.split("-").map((p) => Number(p));
  if (!y || !m || !d) return null;
  const yyyy = String(y).padStart(4, "0");
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseArNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  // Contabilium devuelve formato es-AR (ej: "40.405,61")
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let startDate = searchParams.get("startDate")?.trim() || "";
  let endDate = searchParams.get("endDate")?.trim() || "";

  // Contabilium exige fechaDesde y fechaHasta; si no vienen del filtro, usamos últimos 6 meses
  const today = new Date();
  if (!startDate) {
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    startDate = formatYYYYMMDD(sixMonthsAgo);
  }
  if (!endDate) endDate = formatYYYYMMDD(today);
  const cacheKey = `${startDate}|${endDate}`;
  const now = Date.now();
  pruneRangeCache();
  const cached = rangeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  const apiBaseUrl = process.env.CONTABILIUM_API_URL?.trim() || "https://rest.contabilium.com/api";
  const baseUrl = `${apiBaseUrl.replace(/\/$/, "")}/comprobantes/search`;
  const MAX_PAGES = 10000;
  const PARALLEL_BATCH_SIZE = 10;

  function buildUrl(page: number): string {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("fechaDesde", startDate);
    qs.set("fechaHasta", endDate);
    return `${baseUrl}?${qs.toString()}`;
  }

  async function fetchComprobantesPage(page: number) {
    const url = buildUrl(page);
    let accessToken = await getAccessToken();

    try {
      return await axios.get<ContabiliumSearchResponse>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403)
      ) {
        invalidateAccessTokenCache();
        accessToken = await getAccessToken();
        return await axios.get<ContabiliumSearchResponse>(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      throw error;
    }
  }

  function processItems(
    items: ContabiliumComprobante[],
    acc: {
      byDateNeto: Record<string, number>;
      byDateBruto: Record<string, number>;
      byDateCount: Record<string, number>;
      totalNeto: number;
      totalBruto: number;
      count: number;
    },
  ) {
    for (const item of items) {
      const dateKey = toDateKey(item?.FechaEmision ?? item?.FechaAlta);
      if (!dateKey) continue;
      const montoNeto = parseArNumber(item?.ImporteTotalNeto);
      const montoBruto = parseArNumber(item?.ImporteTotalBruto);

      if (montoNeto) {
        acc.byDateNeto[dateKey] = (acc.byDateNeto[dateKey] ?? 0) + montoNeto;
        acc.totalNeto += montoNeto;
      }

      if (montoBruto) {
        acc.byDateBruto[dateKey] = (acc.byDateBruto[dateKey] ?? 0) + montoBruto;
        acc.totalBruto += montoBruto;
      }

      acc.byDateCount[dateKey] = (acc.byDateCount[dateKey] ?? 0) + 1;
      acc.count += 1;
    }
  }

  try {
    if (rangeInFlight.has(cacheKey)) {
      const inflight = await rangeInFlight.get(cacheKey)!;
      return NextResponse.json(inflight);
    }

    const computePromise = (async (): Promise<ContabiliumAggregatedResponse> => {
      const acc = {
        byDateNeto: {} as Record<string, number>,
        byDateBruto: {} as Record<string, number>,
        byDateCount: {} as Record<string, number>,
        totalNeto: 0,
        totalBruto: 0,
        count: 0,
      };
      let pagesFetched = 1;
      let previousSignature = "";

      const firstResp = await fetchComprobantesPage(1);
      const firstItems = Array.isArray(firstResp.data?.Items)
        ? firstResp.data.Items
        : [];
      processItems(firstItems, acc);

      const firstId = String(firstItems[0]?.Id ?? "");
      const lastId = String(firstItems[firstItems.length - 1]?.Id ?? "");
      previousSignature = `${firstId}-${lastId}-${firstItems.length}`;

      const pageLength = firstItems.length;
      const totalItemsRaw = Number(firstResp.data?.TotalItems);
      const totalItemsKnown =
        Number.isFinite(totalItemsRaw) && totalItemsRaw > 0
          ? Math.floor(totalItemsRaw)
          : null;
      const totalPagesRaw = Number(firstResp.data?.TotalPages);
      const totalPagesFromApi =
        Number.isFinite(totalPagesRaw) && totalPagesRaw > 0
          ? Math.floor(totalPagesRaw)
          : null;

      const totalPagesInferred =
        totalItemsKnown && pageLength > 0
          ? Math.ceil(totalItemsKnown / pageLength)
          : null;

      const maxPageToFetch = Math.min(
        totalPagesFromApi ?? totalPagesInferred ?? MAX_PAGES,
        MAX_PAGES,
      );

      // Si conocemos páginas totales, traer en paralelo por lotes para acelerar "Ver todo".
      if (totalPagesFromApi || totalPagesInferred) {
        for (let from = 2; from <= maxPageToFetch; from += PARALLEL_BATCH_SIZE) {
          const to = Math.min(from + PARALLEL_BATCH_SIZE - 1, maxPageToFetch);
          const batch = await Promise.all(
            Array.from({ length: to - from + 1 }, (_, idx) =>
              fetchComprobantesPage(from + idx),
            ),
          );

          for (const resp of batch) {
            const items = Array.isArray(resp.data?.Items) ? resp.data.Items : [];
            if (items.length === 0) continue;
            processItems(items, acc);
            pagesFetched += 1;
          }
        }
      } else {
        // Fallback robusto si la API no informa metadata de paginación.
        for (let page = 2; page <= maxPageToFetch; page += 1) {
          const resp = await fetchComprobantesPage(page);
          const items = Array.isArray(resp.data?.Items) ? resp.data.Items : [];
          if (items.length === 0) break;

          const nextFirstId = String(items[0]?.Id ?? "");
          const nextLastId = String(items[items.length - 1]?.Id ?? "");
          const currentSignature = `${nextFirstId}-${nextLastId}-${items.length}`;
          if (currentSignature === previousSignature) break;
          previousSignature = currentSignature;

          processItems(items, acc);
          pagesFetched += 1;
        }
      }

      return {
        totalImporteNeto: acc.totalNeto,
        totalImporteBruto: acc.totalBruto,
        byDate: acc.byDateNeto,
        byDateBruto: acc.byDateBruto,
        byDateCount: acc.byDateCount,
        itemsCount: acc.count,
        pagesFetched,
      };
    })();

    rangeInFlight.set(cacheKey, computePromise);
    const responsePayload = await computePromise;
    rangeCache.set(cacheKey, {
      data: responsePayload,
      expiresAt: Date.now() + RANGE_CACHE_TTL_MS,
    });
    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error fetching from Contabilium:",
        error.response?.data || error.message,
      );
      return NextResponse.json(
        { error: error.response?.data || error.message || "Error al obtener datos de Contabilium" },
        { status: error.response?.status || 500 },
      );
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  } finally {
    rangeInFlight.delete(cacheKey);
  }
}

