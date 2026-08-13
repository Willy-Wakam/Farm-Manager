import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = `${import.meta.env.BASE_URL}api/stocks`;

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useStockAliments() {
  return useQuery({
    queryKey: ["stock-aliments"],
    queryFn: () => fetchJson(`${BASE}/aliments`),
  });
}

export function useCreateStockAliment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchJson(`${BASE}/aliments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-aliments"] }),
  });
}

export function useDeleteStockAliment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchJson(`${BASE}/aliments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-aliments"] }),
  });
}

export function useStockMedicaments() {
  return useQuery({
    queryKey: ["stock-medicaments"],
    queryFn: () => fetchJson(`${BASE}/medicaments`),
  });
}

export function useCreateStockMedicament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchJson(`${BASE}/medicaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-medicaments"] }),
  });
}

export function useDeleteStockMedicament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchJson(`${BASE}/medicaments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-medicaments"] }),
  });
}
