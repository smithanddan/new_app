"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GeoLocationFields } from "./GeoLocationFields";

type SearchSuggestion = {
  label: string;
  code: string;
  href: string;
  match_reason: string;
  cheapest_price_rub?: number;
  provider_name?: string;
};

type SuggestResponse = {
  suggestions?: SearchSuggestion[];
};

type SearchBoxProps = {
  initialQuery: string;
  initialCity: string;
  initialLat: string;
  initialLng: string;
};

export function SearchBox({ initialQuery, initialCity, initialLat, initialLng }: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const normalizedQuery = query.trim();
  const isBasket = normalizedQuery.includes(",");
  const shouldSuggest = hasUserEdited && normalizedQuery.length >= 2 && !isBasket;

  useEffect(() => {
    setQuery(initialQuery);
    setCity(initialCity);
    setSuggestions([]);
    setStatus("idle");
    setHasUserEdited(false);
  }, [initialCity, initialQuery]);

  useEffect(() => {
    if (!shouldSuggest) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/lab-suggest?${buildSuggestParams({ query: normalizedQuery, city })}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          setStatus("ready");
          return;
        }
        const payload = await response.json() as SuggestResponse;
        setSuggestions(payload.suggestions ?? []);
        setStatus("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setStatus("ready");
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [city, normalizedQuery, shouldSuggest]);

  const hint = (() => {
    if (isBasket) {
      return "Корзина анализов откроется в оптимизаторе.";
    }
    if (status === "loading") {
      return "Ищем совпадения...";
    }
    if (shouldSuggest && suggestions.length === 0 && status === "ready") {
      return "Точных подсказок пока нет.";
    }
    return "";
  })();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    const nextCity = city.trim() || initialCity;
    setHasUserEdited(false);
    setSuggestions([]);
    if (!nextQuery) {
      router.push(`/search?city=${encodeURIComponent(nextCity)}`);
      return;
    }

    const params = new URLSearchParams();
    params.set(isBasket ? "tests" : "q", nextQuery);
    params.set("city", nextCity);
    if (initialLat && initialLng) {
      params.set("lat", initialLat);
      params.set("lng", initialLng);
    }

    router.push(`${isBasket ? "/basket" : "/search"}?${params.toString()}`);
  }

  return (
    <form onSubmit={submitSearch} className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_160px_auto]">
      <div className="relative md:col-span-1">
        <input
          name="q"
          value={query}
          onChange={(event) => {
            setHasUserEdited(true);
            setQuery(event.target.value);
          }}
          className="h-14 w-full border border-slate-300 px-4 text-base outline-none focus:border-slate-900"
          placeholder="Какой анализ ищем?"
          autoComplete="off"
        />
        {shouldSuggest && suggestions.length > 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 border border-slate-200 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion.code}
                href={suggestion.href}
                onClick={() => {
                  setHasUserEdited(false);
                  setSuggestions([]);
                }}
                className="grid gap-1 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-950">{suggestion.label}</span>
                <span className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{suggestion.code}</span>
                  {suggestion.cheapest_price_rub ? (
                    <span>от {formatRub(suggestion.cheapest_price_rub)}{suggestion.provider_name ? ` · ${suggestion.provider_name}` : ""}</span>
                  ) : (
                    <span>цены пока нет</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <input
        name="city"
        value={city}
        onChange={(event) => setCity(event.target.value)}
        className="h-12 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 md:h-14"
        placeholder="Город"
      />
      <button className="h-12 bg-slate-950 px-5 text-sm font-medium text-white md:h-14">
        Найти
      </button>
      <div className="md:col-span-3">
        <GeoLocationFields initialLat={initialLat} initialLng={initialLng} updateUrl />
        {hint ? <div className="mt-1 min-h-5 text-xs text-slate-500" aria-live="polite">{hint}</div> : null}
      </div>
    </form>
  );
}

function buildSuggestParams(input: { query: string; city: string }): string {
  const params = new URLSearchParams();
  params.set("q", input.query);
  params.set("city", input.city);
  params.set("limit", "6");
  return params.toString();
}

function formatRub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}
