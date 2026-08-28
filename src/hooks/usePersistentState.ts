import { useEffect, useState } from "react";
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const x = localStorage.getItem(key);
      return x ? (JSON.parse(x) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* device storage unavailable */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
