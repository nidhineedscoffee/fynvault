"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { stitchScreens } from "@/lib/stitch-screens";

function clampIndex(index: number) {
  if (index < 0) return 0;
  if (index >= stitchScreens.length) return stitchScreens.length - 1;
  return index;
}

function indexFromHash() {
  if (typeof window === "undefined") return 0;
  const slug = window.location.hash.replace("#", "");
  const index = stitchScreens.findIndex((screen) => screen.slug === slug);
  return index >= 0 ? index : 0;
}

export function StitchProductFlow() {
  const [index, setIndex] = useState(0);
  const screen = stitchScreens[index];

  useEffect(() => {
    const initialIndex = indexFromHash();
    setIndex(initialIndex);
  }, []);

  useEffect(() => {
    const nextHash = `#${screen.slug}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [screen.slug]);

  const goTo = useCallback((nextIndex: number) => {
    setIndex(clampIndex(nextIndex));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        goTo(index + 1);
      }

      if (event.key === "ArrowLeft" || event.key === "Backspace") {
        event.preventDefault();
        goTo(index - 1);
      }

      if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      }

      if (event.key === "End") {
        event.preventDefault();
        goTo(stitchScreens.length - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index]);

  const imagePath = useMemo(() => `/stitch/${screen.slug}/screen.png`, [screen.slug]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#f7f9fb]">
      <h1 className="sr-only">Fynny product flow: {screen.title}</h1>
      <img
        key={screen.slug}
        src={imagePath}
        alt={screen.title}
        className="h-full w-full object-contain"
        draggable={false}
      />
      <button
        type="button"
        aria-label="Previous Fynny screen"
        onClick={() => goTo(index - 1)}
        className="absolute left-0 top-0 h-full w-1/3 cursor-w-resize opacity-0 focus:opacity-0"
        disabled={index === 0}
      />
      <button
        type="button"
        aria-label="Next Fynny screen"
        onClick={() => goTo(index + 1)}
        className="absolute right-0 top-0 h-full w-2/3 cursor-e-resize opacity-0 focus:opacity-0"
        disabled={index === stitchScreens.length - 1}
      />
    </main>
  );
}
