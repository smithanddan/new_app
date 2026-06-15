"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type GeoLocationFieldsProps = {
  initialLat?: string;
  initialLng?: string;
  updateUrl?: boolean;
};

type GeoStatus = "idle" | "loading" | "ready" | "denied" | "unsupported" | "error";

export function GeoLocationFields({ initialLat = "", initialLng = "", updateUrl = false }: GeoLocationFieldsProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [status, setStatus] = useState<GeoStatus>(initialLat && initialLng ? "ready" : "idle");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const label = useMemo(() => statusLabel(status, lat, lng), [lat, lng, status]);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude.toFixed(5);
        const nextLng = position.coords.longitude.toFixed(5);
        setLat(nextLat);
        setLng(nextLng);
        setStatus("ready");

        if (updateUrl) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("lat", nextLat);
          params.set("lng", nextLng);
          router.replace(`${pathname}?${params.toString()}`);
        }
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 8000,
      },
    );
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <button
        type="button"
        onClick={useCurrentLocation}
        className="h-11 border border-blue-700 px-4 text-sm font-medium text-blue-700 active:bg-blue-50 disabled:opacity-60"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Определяем..." : "Использовать моё местоположение"}
      </button>
      <div className="min-h-5 text-xs text-slate-500" aria-live="polite">
        {label}
      </div>
    </div>
  );
}

function statusLabel(status: GeoStatus, lat: string, lng: string): string {
  if (status === "ready") {
    return `Гео включено: ${lat}, ${lng}`;
  }
  if (status === "denied") {
    return "Гео недоступно: можно продолжить без расстояния.";
  }
  if (status === "unsupported") {
    return "Браузер не поддерживает геолокацию.";
  }
  if (status === "error") {
    return "Не удалось определить местоположение.";
  }
  return "Нужно только для подсказки “ближе”; координаты не сохраняются в профиль.";
}
