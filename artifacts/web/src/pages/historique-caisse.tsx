import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFCFA } from "@/lib/format";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchHistoriqueCaisse() {
  const res = await fetch(`${BASE}/api/dashboard/historique-caisse`, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur chargement historique caisse");
  return res.json();
}

export default function HistoriqueCaisse() {
  const { data, isLoading } = useQuery({ queryKey: ["historique-caisse"], queryFn: fetchHistoriqueCaisse });
  const [dateFilter, setDateFilter] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!data) return <div className="text-destructive">Erreur de chargement</div>;

  const categories: string[] = [...new Set<string>((data.entries || []).map((e: Record<string, unknown>) => String(e.categorie || "")))].filter(Boolean);

  const filtered = (data.entries || []).filter((e: Record<string, unknown>) => {
    if (dateFilter && !(e.date as string).startsWith(dateFilter)) return false;
    if (catFilter !== "all" && e.categorie !== catFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Historique de caisse</h1>
        <p className="text-muted-foreground mt-1">Journal complet des mouvements financiers</p>
      </div>

      <Card className="border-t-4 border-t-primary shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Solde courant</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${data.soldeCourant >= 0 ? "text-green-700" : "text-red-600"}`}>
            {formatFCFA(data.soldeCourant)}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 flex-wrap">
        <Input type="month" placeholder="Filtrer par mois" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-48" />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Solde après</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun mouvement.</TableCell></TableRow>
            ) : (
              filtered.map((e: Record<string, unknown>, i: number) => (
                <TableRow key={i}>
                  <TableCell>{e.date as string}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${e.type === "entree" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {e.type === "entree" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {e.type === "entree" ? "Entrée" : "Sortie"}
                    </span>
                  </TableCell>
                  <TableCell>{String(e.categorie || "")}</TableCell>
                  <TableCell>{String(e.designation || "")}</TableCell>
                  <TableCell className={`text-right font-medium ${e.type === "entree" ? "text-green-700" : "text-red-600"}`}>
                    {e.type === "entree" ? "+" : "-"}{formatFCFA(e.montant as number)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${(e.soldeApres as number) >= 0 ? "" : "text-red-600"}`}>
                    {formatFCFA(e.soldeApres as number)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
