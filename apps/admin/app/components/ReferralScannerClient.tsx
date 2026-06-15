"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { scanReferralText, type ReferralMatch, type ReferralScanResult } from "@labmind/lab-crawlers/src/referral-scanner";
import { GeoLocationFields } from "./GeoLocationFields";

type ReferralScannerClientProps = {
  city: string;
  lat: string;
  lng: string;
};

type OcrStatus = "idle" | "loading" | "recognizing" | "parsed" | "error";

export function ReferralScannerClient({ city, lat, lng }: ReferralScannerClientProps) {
  const [rawText, setRawText] = useState("");
  const [scanResult, setScanResult] = useState<ReferralScanResult | null>(null);
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualText, setManualText] = useState("");
  const searchParams = useSearchParams();
  const activeLat = searchParams.get("lat") || lat;
  const activeLng = searchParams.get("lng") || lng;

  const confirmedTests = useMemo(() => {
    const fromMatches = [...(scanResult?.matched ?? []), ...(scanResult?.candidates ?? [])]
      .filter((match) => selected[matchKey(match)])
      .map((match) => match.canonical?.nameRu)
      .filter((value): value is string => Boolean(value));
    const manual = splitManualTests(manualText);
    return [...new Set([...fromMatches, ...manual])];
  }, [manualText, scanResult, selected]);

  const basketHref = buildBasketHref({
    tests: confirmedTests,
    city,
    lat: activeLat,
    lng: activeLng,
  });

  function parseText(nextText = rawText) {
    const result = scanReferralText(nextText);
    setScanResult(result);
    setStatus("parsed");
    setProgress("");
    setError("");
    setSelected(defaultSelection(result));
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setStatus("loading");
    setProgress("загружаем OCR");
    setError("");

    try {
      const { createWorker } = await import("tesseract.js");
      setStatus("recognizing");
      const worker = await createWorker("rus+eng", undefined, {
        logger(message) {
          if (message.status) {
            const percent = message.progress ? ` ${Math.round(message.progress * 100)}%` : "";
            setProgress(`${message.status}${percent}`);
          }
        },
      });
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text.trim();
      setRawText(text);
      parseText(text);
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "Не удалось распознать изображение");
      setProgress("");
    }
  }

  return (
    <div className="grid gap-5">
      <section className="border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="grid gap-2 border border-dashed border-slate-300 p-4">
            <span className="text-sm font-semibold">Сфотографировать или загрузить</span>
            <span className="text-xs text-slate-500">Печатное направление, скрин из почты или мессенджера.</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="text-sm"
              onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
            />
          </label>

          <div className="grid gap-2">
            <label className="text-sm font-semibold" htmlFor="referral-text">Или вставить текст</label>
            <textarea
              id="referral-text"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              className="min-h-40 border border-slate-300 p-3 text-sm outline-none focus:border-slate-900"
              placeholder={"Например:\nОАК\nФерритин\nТТГ\n25-OH витамин D"}
            />
            <button
              type="button"
              onClick={() => parseText()}
              className="h-11 bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
              disabled={!rawText.trim()}
            >
              Разобрать текст
            </button>
          </div>
        </div>

        <div className="mt-4">
          <GeoLocationFields initialLat={lat} initialLng={lng} updateUrl />
        </div>

        <div className="mt-4 min-h-6 text-sm text-slate-600" aria-live="polite">
          {status === "idle" ? "Фото не сохраняется в базе. OCR v1 работает локально в браузере." : null}
          {status === "loading" || status === "recognizing" ? `Статус: ${progress || "распознаём"}` : null}
          {status === "parsed" ? "Готово: проверьте найденные анализы перед переходом в корзину." : null}
          {status === "error" ? `Ошибка OCR: ${error}` : null}
        </div>
      </section>

      {scanResult ? (
        <section className="grid gap-4">
          <MatchSection
            title="Точно найдено"
            description="Эти позиции попадут в корзину, если оставить галочки."
            matches={scanResult.matched}
            selected={selected}
            onToggle={(key) => setSelected((current) => ({ ...current, [key]: !current[key] }))}
          />
          <MatchSection
            title="Похоже на анализ"
            description="Проверьте вручную: это не добавляется без подтверждения."
            matches={scanResult.candidates}
            selected={selected}
            onToggle={(key) => setSelected((current) => ({ ...current, [key]: !current[key] }))}
          />
          <UnmatchedSection matches={scanResult.unmatched} manualText={manualText} onManualText={setManualText} />
          {scanResult.ignored.length > 0 ? (
            <details className="border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-800">Игнорировано: {scanResult.ignored.length}</summary>
              <ul className="mt-3 grid gap-1">
                {scanResult.ignored.map((match) => (
                  <li key={matchKey(match)}>{match.rawText}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <section className="sticky bottom-0 border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600">В корзину: {confirmedTests.length ? confirmedTests.join(", ") : "ничего не выбрано"}</div>
            <Link
              href={basketHref}
              aria-disabled={confirmedTests.length === 0}
              className={`mt-3 inline-flex h-12 w-full items-center justify-center px-4 text-sm font-medium md:w-auto ${
                confirmedTests.length === 0 ? "pointer-events-none bg-slate-200 text-slate-500" : "bg-slate-950 text-white"
              }`}
            >
              Найти где дешевле
            </Link>
          </section>
        </section>
      ) : null}
    </div>
  );
}

function MatchSection({
  title,
  description,
  matches,
  selected,
  onToggle,
}: {
  title: string;
  description: string;
  matches: ReferralMatch[];
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-4 grid gap-2">
        {matches.map((match) => {
          const key = matchKey(match);
          return (
            <label key={key} className="flex gap-3 border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(selected[key])}
                onChange={() => onToggle(key)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{match.canonical?.nameRu ?? match.rawText}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Было: {match.rawText} · confidence {match.confidence} · {match.reason}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function UnmatchedSection({
  matches,
  manualText,
  onManualText,
}: {
  matches: ReferralMatch[];
  manualText: string;
  onManualText: (value: string) => void;
}) {
  return (
    <section className="border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold">Не распознано</div>
      <p className="mt-1 text-xs text-slate-500">
        Введите анализы вручную через запятую. Рукописные направления в MVP лучше перепроверять глазами.
      </p>
      {matches.length > 0 ? (
        <div className="mt-3 grid gap-1 text-sm text-slate-600">
          {matches.map((match) => (
            <div key={matchKey(match)}>Не нашли: {match.rawText}</div>
          ))}
        </div>
      ) : null}
      <input
        value={manualText}
        onChange={(event) => onManualText(event.target.value)}
        className="mt-3 h-11 w-full border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
        placeholder="Например: Глюкоза, ТТГ"
      />
    </section>
  );
}

function defaultSelection(result: ReferralScanResult): Record<string, boolean> {
  const values: Record<string, boolean> = {};
  for (const match of result.matched) {
    values[matchKey(match)] = true;
  }
  for (const match of result.candidates) {
    values[matchKey(match)] = false;
  }
  return values;
}

function matchKey(match: ReferralMatch): string {
  return `${match.status}:${match.rawText}:${match.canonical?.code ?? "none"}`;
}

function splitManualTests(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildBasketHref(input: { tests: string[]; city: string; lat: string; lng: string }): string {
  const params = new URLSearchParams();
  params.set("tests", input.tests.join(","));
  params.set("city", input.city);
  if (input.lat && input.lng) {
    params.set("lat", input.lat);
    params.set("lng", input.lng);
  }
  return `/basket?${params.toString()}`;
}
