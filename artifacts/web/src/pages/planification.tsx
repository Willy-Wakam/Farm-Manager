import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListBandes } from "@workspace/api-client-react";
import { formatFCFA } from "@/lib/format";
import { Calendar, Plus, ChevronLeft, ChevronRight, Bird, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PlannedBande {
  id: string;
  nom: string;
  dateDebut: string;
  sujets: number;
  dureeJours: number;
  couleur: string;
}

const COULEURS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

export default function Planification() {
  const { data: bandes } = useListBandes();
  const [params, setParams] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<PlannedBande[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moisOffset, setMoisOffset] = useState(0);
  const [form, setForm] = useState({ nom: "", dateDebut: "", sujets: 500, dureeJours: 45 });

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
    fetch(`${baseUrl}/parametres`, { credentials: "include" })
      .then(r => r.json())
      .then((data: any[]) => {
        const map: Record<string, string> = {};
        data.forEach(p => { map[p.cle] = p.valeur; });
        setParams(map);
      })
      .catch(() => {});
  }, []);

  const consommationParSujetKg = parseFloat(params["consommation_aliment_par_sujet_kg"] || "4.5");
  const poidsSacKg = parseFloat(params["poids_sac_aliment_kg"] || "50");

  const handleAddPlan = () => {
    if (!form.nom || !form.dateDebut) return;
    setPlans(prev => [...prev, {
      id: crypto.randomUUID(),
      nom: form.nom,
      dateDebut: form.dateDebut,
      sujets: form.sujets,
      dureeJours: form.dureeJours,
      couleur: COULEURS[prev.length % COULEURS.length],
    }]);
    setForm({ nom: "", dateDebut: "", sujets: 500, dureeJours: 45 });
    setDialogOpen(false);
  };

  const handleRemovePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const now = new Date();
  const moisActuel = new Date(now.getFullYear(), now.getMonth() + moisOffset, 1);
  const moisNom = moisActuel.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const joursInMois = new Date(moisActuel.getFullYear(), moisActuel.getMonth() + 1, 0).getDate();
  const premierJourSemaine = moisActuel.getDay();

  const allBandes = useMemo(() => {
    const existing = (bandes || []).map((b: any) => ({
      id: `existing-${b.id}`,
      nom: b.nom,
      dateDebut: b.dateDebut,
      sujets: b.sujetsDepart,
      dureeJours: b.dureeElevage || 45,
      couleur: "#64748b",
    }));
    return [...existing, ...plans];
  }, [bandes, plans]);

  const isJourOccupe = (jour: number) => {
    const date = new Date(moisActuel.getFullYear(), moisActuel.getMonth(), jour);
    return allBandes.filter(b => {
      const debut = new Date(b.dateDebut);
      const fin = new Date(debut);
      fin.setDate(fin.getDate() + b.dureeJours);
      return date >= debut && date <= fin;
    });
  };

  const estimationsAliments = plans.map(p => {
    const totalKg = p.sujets * consommationParSujetKg;
    const sacs = Math.ceil(totalKg / poidsSacKg);
    return { ...p, totalKg, sacs };
  });

  const chartData = estimationsAliments.map(p => ({
    nom: p.nom,
    sacs: p.sacs,
    sujets: p.sujets,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Planification des bandes
          </h1>
          <p className="text-muted-foreground mt-1">Planifiez vos futures bandes et estimez les besoins en aliments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Planifier une bande</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle bande planifiée</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nom de la bande</Label>
                <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex : Bande 4" />
              </div>
              <div>
                <Label>Date de début</Label>
                <Input type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))} />
              </div>
              <div>
                <Label>Nombre de sujets</Label>
                <Input type="number" value={form.sujets} onChange={e => setForm(f => ({ ...f, sujets: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Durée d'élevage (jours)</Label>
                <Input type="number" value={form.dureeJours} onChange={e => setForm(f => ({ ...f, dureeJours: parseInt(e.target.value) || 45 }))} />
              </div>
              <Button className="w-full" onClick={handleAddPlan}>Ajouter au planning</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Button variant="outline" size="icon" onClick={() => setMoisOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <CardTitle className="text-xl font-serif capitalize">{moisNom}</CardTitle>
          <Button variant="outline" size="icon" onClick={() => setMoisOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map(j => (
              <div key={j} className="font-medium text-muted-foreground py-2">{j}</div>
            ))}
            {Array.from({ length: premierJourSemaine }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: joursInMois }, (_, i) => {
              const jour = i + 1;
              const bandesJour = isJourOccupe(jour);
              const isToday = moisOffset === 0 && jour === now.getDate();
              return (
                <div key={jour} className={`relative p-1 min-h-[48px] rounded border text-xs ${isToday ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
                  <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{jour}</span>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {bandesJour.slice(0, 2).map(b => (
                      <div key={b.id} className="truncate text-[10px] px-1 rounded" style={{ backgroundColor: b.couleur + "20", color: b.couleur }}>
                        {b.nom}
                      </div>
                    ))}
                    {bandesJour.length > 2 && <span className="text-[10px] text-muted-foreground">+{bandesJour.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {plans.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-serif flex items-center gap-2"><Bird className="h-5 w-5" /> Bandes planifiées</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Nom</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead className="text-right">Sujets</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead className="text-right">Fin estimée</TableHead>
                    <TableHead className="text-right w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map(p => {
                    const fin = new Date(p.dateDebut);
                    fin.setDate(fin.getDate() + p.dureeJours);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.couleur }} />
                            {p.nom}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(p.dateDebut).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell className="text-right">{p.sujets}</TableCell>
                        <TableCell className="text-right">{p.dureeJours} j</TableCell>
                        <TableCell className="text-right">{fin.toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemovePlan(p.id)}>Retirer</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-serif flex items-center gap-2"><Package className="h-5 w-5" /> Estimation des besoins en aliments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Base : {consommationParSujetKg} kg / sujet, sacs de {poidsSacKg} kg (modifiable dans Paramètres)
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Bande</TableHead>
                    <TableHead className="text-right">Sujets</TableHead>
                    <TableHead className="text-right">Total aliment (kg)</TableHead>
                    <TableHead className="text-right">Sacs nécessaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimationsAliments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nom}</TableCell>
                      <TableCell className="text-right">{p.sujets}</TableCell>
                      <TableCell className="text-right">{p.totalKg.toLocaleString("fr-FR")} kg</TableCell>
                      <TableCell className="text-right font-bold">{p.sacs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/5">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{estimationsAliments.reduce((s, p) => s + p.sujets, 0)}</TableCell>
                    <TableCell className="text-right font-bold">{estimationsAliments.reduce((s, p) => s + p.totalKg, 0).toLocaleString("fr-FR")} kg</TableCell>
                    <TableCell className="text-right font-bold">{estimationsAliments.reduce((s, p) => s + p.sacs, 0)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              {chartData.length > 1 && (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nom" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sacs" name="Sacs d'aliment" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {plans.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucune bande planifiée</p>
            <p className="text-sm mt-1">Cliquez sur "Planifier une bande" pour commencer</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
