import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { Wallet, Receipt, Construction, Bird, AlertTriangle, Syringe, TrendingUp, ArrowRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Link } from "wouter";
import SaisieRapide from "@/components/saisie-rapide";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">Chargement du tableau de bord...</span>
    </div>
  );
  if (error || !summary) return <div className="text-destructive">Erreur de chargement des donnees.</div>;

  const s = summary as unknown as Record<string, unknown>;
  const prochainesVaccinations = (s.prochainesVaccinations as Array<{ bandeNom: string; vaccinNom: string; datePrevue: string; enRetard: boolean }>) || [];
  const previsions = s.previsions as { coutProductionEstime: number; beneficeProbable: number; dureeMoyenneJours: number } | null;
  const totalRembourse = (s.totalRembourse as number) || 0;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[hsl(145,45%,22%)] to-[hsl(145,35%,30%)] text-white p-6 md:p-8">
        <div className="absolute inset-0 opacity-10">
          <img
            src={`${import.meta.env.BASE_URL}images/chicks-grass.jpg`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Tableau de bord</h1>
          <p className="text-white/70 text-sm md:text-base">Vue d'ensemble de votre exploitation avicole</p>
        </div>
      </div>

      {summary.alerteDepassementBudget && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="font-medium text-sm">Attention : Les depenses de construction ont depasse le budget prevu (devis).</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Caisse disponible</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(summary.caisseDisponible)}</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total investi</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(summary.totalFinance)}</div>
            {totalRembourse > 0 && <p className="text-xs text-muted-foreground mt-1">Rembourse : {formatFCFA(totalRembourse)}</p>}
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Depenses construction</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Construction className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(summary.totalDepenseConstruction)}</div>
            <p className="text-xs text-muted-foreground mt-1">Sur {formatFCFA(summary.totalDevis)} (devis)</p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bandes actives</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <Bird className="h-4 w-4 text-green-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{summary.bandesActives.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Sur {summary.nombreBandes} au total</p>
          </CardContent>
        </Card>
      </div>

      {prochainesVaccinations.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-orange-50/50 border-b border-orange-100">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-md bg-orange-100 flex items-center justify-center">
                <Syringe className="h-4 w-4 text-orange-600" />
              </div>
              Prochaines vaccinations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {prochainesVaccinations.map((v, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg text-sm ${v.enRetard ? "bg-red-50 border border-red-200 text-red-800" : "bg-muted/30"}`}>
                  <div>
                    <span className="font-medium">{v.vaccinNom}</span>
                    <span className="text-muted-foreground ml-2">({v.bandeNom})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{v.datePrevue}</span>
                    {v.enRetard && <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">EN RETARD</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <SaisieRapide />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bird className="h-5 w-5 text-primary" />
              Bandes actives - Production
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {summary.bandesActives.length > 0 ? (
                (summary.bandesActives as unknown as Array<Record<string, unknown>>).map((bande: Record<string, unknown>) => (
                  <Link key={bande.id as number} href={`/bandes/${bande.id}`}>
                    <div className="flex flex-col space-y-2 p-3 bg-muted/20 rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer group">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{bande.nom as string}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
                            {bande.sujetsVivants as number} sujets
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs block">Cout prod.</span>
                          <span className="font-medium">{formatFCFA(bande.coutProduction as number)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">Recettes</span>
                          <span className="font-medium">{formatFCFA(bande.totalRecettes as number)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">Mortalite</span>
                          <span className={`font-medium ${(bande.tauxMortalite as number) > 5 ? "text-red-600" : "text-green-700"}`}>
                            {bande.tauxMortalite as number}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <Bird className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucune bande active</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {previsions && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 bg-blue-50/50 border-b border-blue-100">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  Previsions (prochaine bande)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-muted-foreground text-xs block mb-1">Cout estime</span>
                    <span className="font-bold text-lg">{formatFCFA(previsions.coutProductionEstime)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block mb-1">Benefice probable</span>
                    <span className={`font-bold text-lg ${previsions.beneficeProbable >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatFCFA(previsions.beneficeProbable)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block mb-1">Duree moyenne</span>
                    <span className="font-bold text-lg">{previsions.dureeMoyenneJours}j</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-base">Depenses par categorie (Bandes)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[250px]">
                {summary.depensesParCategorie && summary.depensesParCategorie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.depensesParCategorie}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="categorie" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} fontSize={11} tickFormatter={(value) => `${value / 1000}k`} />
                      <Tooltip formatter={(value: number) => [formatFCFA(value), "Montant"]} cursor={{ fill: "hsl(var(--muted)/0.5)" }} />
                      <Bar dataKey="montant" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucune donnee disponible</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
