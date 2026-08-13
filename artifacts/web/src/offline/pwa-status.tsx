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
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg">
          <p className="mb-3 text-sm font-medium">
            Une nouvelle version de Farm Manager est disponible.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Mettre à jour
            </button>

            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </>
  );
}