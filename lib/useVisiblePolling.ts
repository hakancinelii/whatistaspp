import { useEffect, useRef } from "react";

/**
 * Sayfa görünür (foreground) olduğu sürece `callback`'i `intervalMs` aralığıyla çağırır.
 * Sayfa arka plana atıldığında (document.hidden) interval durdurulur — böylece
 * telefon cebinde/ekran kapalıyken gereksiz ağ+CPU kullanımı (ısınma/pil) olmaz.
 * Sayfa tekrar görünür olduğunda callback bir kez hemen çağrılır ve interval yeniden başlar.
 *
 * Not: Gerçek zamanlı/arka plan iş alma SUNUCU tarafında (runJobAutomation) çalışır;
 * bu hook yalnızca tarayıcıdaki ekran güncellemesini yönetir.
 */
export function useVisiblePolling(
    callback: () => void,
    intervalMs: number,
    options?: { runOnMount?: boolean; runOnVisible?: boolean }
) {
    const cbRef = useRef(callback);
    cbRef.current = callback;

    const runOnMount = options?.runOnMount !== false;
    const runOnVisible = options?.runOnVisible !== false;

    useEffect(() => {
        let id: ReturnType<typeof setInterval> | null = null;

        const start = () => {
            if (id === null) id = setInterval(() => cbRef.current(), intervalMs);
        };
        const stop = () => {
            if (id !== null) {
                clearInterval(id);
                id = null;
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                if (runOnVisible) cbRef.current();
                start();
            } else {
                stop();
            }
        };

        if (typeof document !== "undefined" && document.visibilityState === "visible") {
            if (runOnMount) cbRef.current();
            start();
        }

        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            stop();
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervalMs]);
}
