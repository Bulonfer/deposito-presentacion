import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { versionApp } from "@/app/utils/types";

/** Nunca servir una respuesta congelada del build: la tele se guía por esto. */
export const dynamic = "force-dynamic";

/**
 * Identificador del build que sirve ESTE proceso. Se lee una sola vez al
 * arrancar y no se vuelve a mirar el disco a propósito: si se corre `next build`
 * mientras el server viejo sigue vivo, el archivo cambia pero el código servido
 * sigue siendo el anterior. Congelado, el valor recién cambia cuando el proceso
 * arranca ya con el build nuevo, que es el momento en que la tele debe recargar.
 */
const VERSION = leerBuildId();

function leerBuildId(): string {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    // Sin build en disco (`next dev`, distDir movido): alcanza con el arranque
    // del proceso como versión, cambia con cada reinicio.
    return `runtime-${Date.now()}`;
  }
}

export async function GET() {
  const body: versionApp = { version: VERSION };
  return NextResponse.json(body, {
    // Si un proxy o el navegador cachean esto, la tele queda clavada en la
    // versión vieja y no se entera nunca de un deploy.
    headers: { "Cache-Control": "no-store" },
  });
}
