import type { QueryClient } from "@tanstack/react-query";
import {
  getBande,
  getGetBandeQueryKey,
  listBandeDepenses,
  getListBandeDepensesQueryKey,
  listBandeVentes,
  getListBandeVentesQueryKey,
  getBandeChargesFixe,
  getGetBandeChargesFixeQueryKey,
  listBandeDepensesVente,
  getListBandeDepensesVenteQueryKey,
  getBandeMortalite,
  getGetBandeMortaliteQueryKey,
  getBandePesees,
  getGetBandePeseesQueryKey,
  getBandeConsommation,
  getGetBandeConsommationQueryKey,
  getBandeVaccinations,
  getGetBandeVaccinationsQueryKey,
} from "@workspace/api-client-react";
import {
  fetchConsommationEau,
  fetchTraitements,
  fetchObservations,
  fetchReferencePoids,
  getConsommationEauQueryKey,
  getTraitementsQueryKey,
  getObservationsQueryKey,
  getReferencePoidsQueryKey,
} from "@/lib/bande-extras-api";

export async function prefetchBandeDetail(
  queryClient: QueryClient,
  bandeId: number,
  
) {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: getGetBandeQueryKey(bandeId),
      queryFn: () => getBande(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getListBandeDepensesQueryKey(bandeId),
      queryFn: () => listBandeDepenses(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getListBandeVentesQueryKey(bandeId),
      queryFn: () => listBandeVentes(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getGetBandeChargesFixeQueryKey(bandeId),
      queryFn: () => getBandeChargesFixe(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getListBandeDepensesVenteQueryKey(bandeId),
      queryFn: () => listBandeDepensesVente(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getGetBandeMortaliteQueryKey(bandeId),
      queryFn: () => getBandeMortalite(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getGetBandePeseesQueryKey(bandeId),
      queryFn: () => getBandePesees(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getGetBandeConsommationQueryKey(bandeId),
      queryFn: () => getBandeConsommation(bandeId),
    }),

    queryClient.prefetchQuery({
      queryKey: getGetBandeVaccinationsQueryKey(bandeId),
      queryFn: () => getBandeVaccinations(bandeId),
    }),

    queryClient.prefetchQuery({
        queryKey: getConsommationEauQueryKey(bandeId),
            queryFn: () => fetchConsommationEau(bandeId),
    }),

    queryClient.prefetchQuery({
        queryKey: getTraitementsQueryKey(bandeId),
            queryFn: () => fetchTraitements(bandeId),
    }),

    queryClient.prefetchQuery({
        queryKey: getObservationsQueryKey(bandeId),
            queryFn: () => fetchObservations(bandeId),
    }),
  ]);
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}


export async function prefetchOfflineData(
  queryClient: QueryClient,
) {
    const bandes = await queryClient.fetchQuery({
        queryKey: ["/api/bandes"],
        queryFn: () => fetchJson("/api/bandes"),
    });

    const bandesActives = bandes.filter(
        (bande: any) => bande.statut === "active",
    );

    await Promise.allSettled(
        bandesActives.map((bande: any) =>
            prefetchBandeDetail(queryClient, bande.id),
        ),
    );
    await Promise.allSettled([
        queryClient.prefetchQuery({
            queryKey: ["/api/dashboard/summary"],
            queryFn: () => fetchJson("/api/dashboard/summary"),
        }),

        queryClient.prefetchQuery({
  queryKey: getReferencePoidsQueryKey(),
  queryFn: fetchReferencePoids,
}),

    queryClient.prefetchQuery({
      queryKey: ["dashboard-finances"],
      queryFn: () => fetchJson("/api/dashboard/finances"),
    }),

    queryClient.prefetchQuery({
      queryKey: ["/api/bandes"],
      queryFn: () => fetchJson("/api/bandes"),
    }),

    queryClient.prefetchQuery({
      queryKey: ["stock-aliments"],
      queryFn: () => fetchJson("/api/stocks/aliments"),
    }),

    queryClient.prefetchQuery({
      queryKey: ["stock-medicaments"],
      queryFn: () => fetchJson("/api/stocks/medicaments"),
    }),

    queryClient.prefetchQuery({
      queryKey: ["historique-caisse"],
      queryFn: () =>
        fetchJson("/api/dashboard/historique-caisse"),
    }),
  ]);

  console.log("[offline] Préchargement terminé");
}