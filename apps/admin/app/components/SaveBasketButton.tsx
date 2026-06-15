"use client";

import { useEffect, useState } from "react";

type SaveBasketButtonProps = {
  tests: string;
  city: string;
  lat?: string;
  lng?: string;
};

const STORAGE_KEY = "labprice.savedBasket";

export function SaveBasketButton({ tests, city, lat = "", lng = "" }: SaveBasketButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      return;
    }

    try {
      const value = JSON.parse(existing) as { tests?: string; city?: string };
      setSaved(value.tests === tests && value.city === city);
    } catch {
      setSaved(false);
    }
  }, [city, tests]);

  function saveBasket() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tests,
      city,
      lat,
      lng,
      savedAt: new Date().toISOString(),
    }));
    setSaved(true);
  }

  return (
    <button
      type="button"
      onClick={saveBasket}
      className="h-10 border border-slate-300 px-4 text-sm font-medium active:bg-slate-100"
    >
      {saved ? "Корзина сохранена" : "Сохранить корзину"}
    </button>
  );
}
