import type { IconType } from "react-icons";
import {
  WiCloudy,
  WiDayCloudy,
  WiDayShowers,
  WiDaySunny,
  WiDaySunnyOvercast,
  WiDayThunderstorm,
  WiFog,
  WiNightAltCloudy,
  WiNightAltPartlyCloudy,
  WiNightAltShowers,
  WiNightClear,
  WiRain,
  WiRainMix,
  WiShowers,
  WiSnow,
  WiSnowWind,
  WiSprinkle,
  WiThunderstorm,
} from "react-icons/wi";

/** Open-Meteo publica una lectura nueva cada ~15 min; no tiene sentido pedir más seguido. */
export const REFRESH_CLIMA_MS = 10 * 60 * 1000;

type Condicion = {
  label: string;
  icon: IconType;
  /** Variante nocturna, cuando el ícono diurno tiene sol. */
  iconNoche?: IconType;
};

/**
 * Códigos WMO que devuelve Open-Meteo en `weather_code`.
 * Tabla completa: https://open-meteo.com/en/docs
 */
const CONDICIONES: Record<number, Condicion> = {
  0: { label: "Despejado", icon: WiDaySunny, iconNoche: WiNightClear },
  1: {
    label: "Mayormente despejado",
    icon: WiDaySunnyOvercast,
    iconNoche: WiNightAltPartlyCloudy,
  },
  2: {
    label: "Parcialmente nublado",
    icon: WiDayCloudy,
    iconNoche: WiNightAltCloudy,
  },
  3: { label: "Nublado", icon: WiCloudy },
  45: { label: "Niebla", icon: WiFog },
  48: { label: "Niebla con escarcha", icon: WiFog },
  51: { label: "Llovizna leve", icon: WiSprinkle },
  53: { label: "Llovizna", icon: WiSprinkle },
  55: { label: "Llovizna intensa", icon: WiSprinkle },
  56: { label: "Llovizna helada", icon: WiRainMix },
  57: { label: "Llovizna helada intensa", icon: WiRainMix },
  61: { label: "Lluvia leve", icon: WiRain },
  63: { label: "Lluvia", icon: WiRain },
  65: { label: "Lluvia intensa", icon: WiRain },
  66: { label: "Lluvia helada", icon: WiRainMix },
  67: { label: "Lluvia helada intensa", icon: WiRainMix },
  71: { label: "Nevada leve", icon: WiSnow },
  73: { label: "Nevada", icon: WiSnow },
  75: { label: "Nevada intensa", icon: WiSnow },
  77: { label: "Granos de nieve", icon: WiSnowWind },
  80: {
    label: "Chaparrones leves",
    icon: WiDayShowers,
    iconNoche: WiNightAltShowers,
  },
  81: {
    label: "Chaparrones",
    icon: WiDayShowers,
    iconNoche: WiNightAltShowers,
  },
  82: { label: "Chaparrones fuertes", icon: WiShowers },
  85: { label: "Chaparrones de nieve", icon: WiSnow },
  86: { label: "Chaparrones de nieve fuertes", icon: WiSnow },
  95: { label: "Tormenta", icon: WiDayThunderstorm, iconNoche: WiThunderstorm },
  96: { label: "Tormenta con granizo", icon: WiThunderstorm },
  99: { label: "Tormenta con granizo fuerte", icon: WiThunderstorm },
};

const DESCONOCIDO: Condicion = { label: "Sin datos", icon: WiCloudy };

/** Traduce un código WMO a texto e ícono, eligiendo la variante de día o de noche. */
export const describirClima = (codigo: number, esDia: boolean) => {
  const cond = CONDICIONES[codigo] ?? DESCONOCIDO;
  return {
    label: cond.label,
    Icon: esDia ? cond.icon : (cond.iconNoche ?? cond.icon),
  };
};
