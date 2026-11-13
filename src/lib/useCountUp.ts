"use client";

import { useEffect, useRef, useState } from "react";

// Animates a number from its previous value to the new one (ease-out), e.g. a star balance.
// `undefined` means "not loaded yet": the first real value shows as-is, only later changes animate.
export function useCountUp(value: number | undefined, ms = 700) {
  const [shown, setShown] = useState(value ?? 0);
  const from = useRef<number | undefined>(value);
  useEffect(() => {
    if (value === undefined) return;
    const start = from.current;
    if (start === undefined || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    from.current = value;
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
