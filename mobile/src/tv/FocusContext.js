import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

const FocusContext = createContext(null);

/**
 * Gestor de navegação espacial (D-pad / setas).
 * Mantém um registo de nós focáveis por ecrã.
 */
export function FocusProvider({ children, enabled = true }) {
  const nodesRef = useRef(new Map());
  const [focusedId, setFocusedId] = useState(null);

  const register = useCallback((id, meta) => {
    nodesRef.current.set(id, meta);
    return () => {
      nodesRef.current.delete(id);
    };
  }, []);

  const focus = useCallback((id) => {
    setFocusedId(id);
    const node = nodesRef.current.get(id);
    node?.onFocus?.();
  }, []);

  const move = useCallback(
    (direction) => {
      if (!enabled || !nodesRef.current.size) return;

      const entries = [...nodesRef.current.entries()].filter(([, n]) => n.enabled !== false);
      if (!entries.length) return;

      let currentId = focusedId;
      if (!currentId || !nodesRef.current.has(currentId)) {
        currentId = entries[0][0];
        setFocusedId(currentId);
        entries[0][1].onFocus?.();
        return;
      }

      const current = nodesRef.current.get(currentId);
      const cx = current.x + current.w / 2;
      const cy = current.y + current.h / 2;

      let best = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const [id, node] of entries) {
        if (id === currentId) continue;
        const nx = node.x + node.w / 2;
        const ny = node.y + node.h / 2;
        const dx = nx - cx;
        const dy = ny - cy;

        let valid = false;
        if (direction === 'left') valid = dx < -8;
        if (direction === 'right') valid = dx > 8;
        if (direction === 'up') valid = dy < -8;
        if (direction === 'down') valid = dy > 8;
        if (!valid) continue;

        const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
        const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
        const score = primary + secondary * 2.2;
        if (score < bestScore) {
          bestScore = score;
          best = id;
        }
      }

      if (best) {
        nodesRef.current.get(focusedId)?.onBlur?.();
        setFocusedId(best);
        nodesRef.current.get(best)?.onFocus?.();
        nodesRef.current.get(best)?.onScrollIntoView?.();
      }
    },
    [enabled, focusedId]
  );

  const activate = useCallback(() => {
    nodesRef.current.get(focusedId)?.onSelect?.();
  }, [focusedId]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      const map = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      };
      if (map[event.key]) {
        event.preventDefault();
        move(map[event.key]);
      }
      if (event.key === 'Enter' || event.key === ' ') {
        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        event.preventDefault();
        activate();
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        nodesRef.current.get(focusedId)?.onBack?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activate, enabled, focusedId, move]);

  const value = useMemo(
    () => ({ focusedId, register, focus, move, activate }),
    [focusedId, register, focus, move, activate]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocusManager() {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error('useFocusManager must be used within FocusProvider');
  }
  return ctx;
}
