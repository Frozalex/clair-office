import { useCallback, useRef, useState } from "react";
export function useHistory<T>(value: T, onChange: (next: T) => void) {
  const past = useRef<T[]>([]),
    future = useRef<T[]>([]),
    latest = useRef(value);
  const [, render] = useState(0);
  latest.current = value;
  const commit = useCallback(
    (next: T) => {
      past.current = [
        ...past.current.slice(-49),
        structuredClone(latest.current),
      ];
      future.current = [];
      latest.current = next;
      onChange(next);
      render((n) => n + 1);
    },
    [onChange],
  );
  const undo = () => {
    const previous = past.current.pop();
    if (previous) {
      future.current.push(structuredClone(latest.current));
      latest.current = previous;
      onChange(previous);
      render((n) => n + 1);
    }
  };
  const redo = () => {
    const next = future.current.pop();
    if (next) {
      past.current.push(structuredClone(latest.current));
      latest.current = next;
      onChange(next);
      render((n) => n + 1);
    }
  };
  return {
    commit,
    undo,
    redo,
    canUndo: !!past.current.length,
    canRedo: !!future.current.length,
  };
}
