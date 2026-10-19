import { useCallback, useEffect, useRef, useState } from "react";

// Runs fn() whenever deps change. Keeps the previous data while reloading, so lists do not flash.
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false; // ignore answers that arrive after a newer request or unmount
    setState((s) => ({ ...s, error: null, loading: true }));
    fnRef.current().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error) => !cancelled && setState((s) => ({ ...s, error, loading: false }))
    );
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// Returns value after it has stopped changing for `ms` milliseconds (cleans up its timer).
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
