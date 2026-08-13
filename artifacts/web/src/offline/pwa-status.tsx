import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "@/hooks/use-toast";

export function PwaStatus() {
  const { toast } = useToast();

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log("[pwa] Service Worker enregistré:", swUrl);
    },

    onRegisterError(error) {
      console.error(
        "[pwa] Erreur lors de l'enregistrement du Service Worker:",
        error,
      );
    },
  });

  useEffect(() => {
    if (!offlineReady) {
      return;
    }

    toast({
      title: "Farm Manager prêt hors ligne",
      description:
        "L'application peut maintenant être ouverte sans connexion Internet.",
    });

    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, toast]);

  useEffect(() => {
    if (!needRefresh) {
      return;
    }

    toast({
      title: "Mise à jour disponible",
      description:
        "Une nouvelle version de Farm Manager est disponible.",
    });
  }, [needRefresh, toast]);

  return (
    <>
      {needRefresh && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 rounded-lg border bg-background p-3 shadow-lg sm:left-auto sm:right-4 sm:w-full sm:max-w-md sm:p-4"
        >
          <p className="mb-3 text-sm font-medium leading-snug">
            Une nouvelle version de Farm Manager est disponible.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="min-h-10 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Mettre à jour
            </button>

            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="min-h-10 rounded-md border px-3 py-2 text-sm font-medium"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
