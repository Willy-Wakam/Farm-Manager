import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, Construction, ArrowUpRight, ArrowDownRight,
  Building2, BarChart3, Target, AlertCircle, CheckCircle2, Clock, Bird, BookOpen,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchFinances() {
  const res = await fetch(`${BASE}/api/dashboard/finances`, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur chargement finances");
  return res.json();
}

function StatCard({
  label, value, sub, icon: Icon, color = "primary", trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string; trend?: "up" | "down" | "neutral";
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  };
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${trendColor}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FlowRow({ label, montant, type, sub }: { label: string; montant: number; type: "entree" | "sortie" | "total"; sub?: string }) {
  const isEntree = type === "entree";
  const isTotal = type === "total";
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${isTotal ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/30"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isTotal ? "bg-primary/10" : isEntree ? "bg-green-100" : "bg-red-100"}`}>
          {isTotal ? <Wallet className="h-3.5 w-3.5 text-primary" /> : isEntree ? <ArrowUpRight className="h-3.5 w-3.5 text-green-600" /> : <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />}
        </div>
        <div>
          <div className={`text-sm font-medium ${isTotal ? "text-primary font-semibold" : ""}`}>{label}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
      <div className={`text-sm font-bold ${isTotal ? "text-primary text-base" : isEntree ? "text-green-700" : "text-red-600"}`}>
        {isEntree ? "+" : isTotal ? "" : "−"}{formatFCFA(Math.abs(montant))}
      </div>
    </div>
  );
}

export default function Finances() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard-finances"], queryFn: fetchFinances });

  if (isLoading) return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">Chargement des données financières...</span>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center gap-3 text-destructive p-4 rounded-lg bg-destructive/10 border border-destructive/20">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p>Erreur lors du chargement des données financières.</p>
    </div>
  );

  const f = data as any;
  const soldePositif = f.soldeCourant >= 0;
  const roiPositif = f.roiGlobal >= 0;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[hsl(145,45%,22%)] to-[hsl(220,60%,30%)] text-white p-6 md:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Finances</h1>
          <p className="text-white/70 text-sm md:text-base">Trésorerie, amortissement et rentabilité de l'exploitation</p>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
          <BarChart3 className="h-24 w-24" />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Solde en caisse"
          value={formatFCFA(f.soldeCourant)}
          sub={soldePositif ? "Trésorerie positive" : "Trésorerie négative"}
          icon={Wallet}
          color={soldePositif ? "green" : "red"}
          trend={soldePositif ? "up" : "down"}
        />
        <StatCard
          label="Total investi"
          value={formatFCFA(f.totalFinancement)}
          sub={f.totalRembourse > 0 ? `Remboursé : ${formatFCFA(f.totalRembourse)}` : "Capital engagé"}
          icon={ArrowUpRight}
          color="blue"
        />
        <StatCard
          label="Amortissement"
          value={`${f.progressionAmortissement}%`}
          sub={`${formatFCFA(f.totalAmorti)} sur ${formatFCFA(f.totalConstruction)}`}
          icon={Building2}
          color="orange"
        />
        <StatCard
          label="ROI global"
          value={`${f.roiGlobal > 0 ? "+" : ""}${f.roiGlobal}%`}
          sub={roiPositif ? `Gain net : ${formatFCFA(f.pertesOuGains)}` : `Déficit : ${formatFCFA(Math.abs(f.pertesOuGains))}`}
          icon={TrendingUp}
          color={roiPositif ? "green" : "red"}
          trend={roiPositif ? "up" : "down"}
        />
      </div>

      <Tabs defaultValue="tresorerie" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="tresorerie" className="gap-2"><Wallet className="h-4 w-4" />Trésorerie</TabsTrigger>
          <TabsTrigger value="amortissement" className="gap-2"><Building2 className="h-4 w-4" />Amortissement</TabsTrigger>
          <TabsTrigger value="roi" className="gap-2"><Target className="h-4 w-4" />ROI & Projections</TabsTrigger>
          <TabsTrigger value="historique" className="gap-2"><BookOpen className="h-4 w-4" />Historique</TabsTrigger>
        </TabsList>

        {/* ─── TAB 1 : TRÉSORERIE ─── */}
        <TabsContent value="tresorerie" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                  Entrées de trésorerie
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-1">
                <FlowRow label="Investissements reçus" montant={f.totalFinancement} type="entree" sub="Capital apporté par les investisseurs" />
                <FlowRow label="Recettes des ventes" montant={f.totalRecettesBandes} type="entree" sub="Toutes bandes confondues" />
                <div className="border-t mt-2 pt-2">
                  <FlowRow label="Total entrées" montant={f.totalFinancement + f.totalRecettesBandes} type="total" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                  Sorties de trésorerie
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-1">
                <FlowRow label="Dépenses de construction" montant={f.totalConstruction} type="sortie" sub="Bâtiment, matériel, forage, carburant" />
                <FlowRow label="Dépenses de production" montant={f.totalDepensesBandes} type="sortie" sub="Toutes bandes confondues" />
                <FlowRow label="Frais de vente" montant={f.totalDepensesVenteBandes} type="sortie" sub="Transport, conditionnement, etc." />
                {(f.totalAchatActifs ?? 0) > 0 && (
                  <FlowRow label="Achats d'actifs" montant={f.totalAchatActifs} type="sortie" sub="Terrain, bâtiment racheté, matériel" />
                )}
                {f.totalRembourse > 0 && (
                  <FlowRow label="Remboursements investisseurs" montant={f.totalRembourse} type="sortie" />
                )}
                <div className="border-t mt-2 pt-2">
                  <FlowRow label="Total sorties" montant={f.totalConstruction + f.totalDepensesBandes + f.totalDepensesVenteBandes + (f.totalAchatActifs ?? 0) + f.totalRembourse} type="total" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className={`border-2 ${soldePositif ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Solde net en caisse (aujourd'hui)</p>
                <div className={`text-4xl font-bold ${soldePositif ? "text-green-700" : "text-red-700"}`}>
                  {formatFCFA(f.soldeCourant)}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  = Investissements + Recettes ventes − Construction − Production − Frais vente{f.totalRembourse > 0 ? " − Remboursements" : ""}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${soldePositif ? "bg-green-100" : "bg-red-100"}`}>
                {soldePositif ? <TrendingUp className="h-8 w-8 text-green-600" /> : <TrendingDown className="h-8 w-8 text-red-600" />}
              </div>
            </CardContent>
          </Card>

          {f.bandesDetails?.length > 0 && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-serif">Contribution par bande</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Bande</TableHead>
                        <TableHead className="text-right">Coût prod.</TableHead>
                        <TableHead className="text-right">Recettes</TableHead>
                        <TableHead className="text-right">Résultat</TableHead>
                        <TableHead className="text-right">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.bandesDetails.map((b: any) => (
                        <TableRow key={b.id} className="hover:bg-muted/10">
                          <TableCell className="font-medium">{b.nom}</TableCell>
                          <TableCell className="text-right text-red-600">{formatFCFA(b.coutProduction)}</TableCell>
                          <TableCell className="text-right text-green-700">{formatFCFA(b.totalRecettes)}</TableCell>
                          <TableCell className={`text-right font-bold ${b.beneficeNet >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {b.beneficeNet >= 0 ? "+" : ""}{formatFCFA(b.beneficeNet)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.statut === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                              {b.statut === "active" ? "Active" : "Terminée"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB 2 : AMORTISSEMENT ─── */}
        <TabsContent value="amortissement" className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-600" />
                Récupération de l'investissement construction
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant récupéré via les bandes</span>
                  <span className="font-semibold">{formatFCFA(f.totalAmorti)} / {formatFCFA(f.totalConstruction)}</span>
                </div>
                <div className="relative h-5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, f.progressionAmortissement)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{f.progressionAmortissement}% récupéré</span>
                  <span>Reste : {formatFCFA(f.resteAAmortir)}</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-xl border bg-orange-50/50 border-orange-100 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Investi en construction</div>
                  <div className="text-xl font-bold text-orange-700">{formatFCFA(f.totalConstruction)}</div>
                </div>
                <div className="p-4 rounded-xl border bg-green-50/50 border-green-100 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Récupéré ({f.bandesDetails?.length || 0} bandes)</div>
                  <div className="text-xl font-bold text-green-700">{formatFCFA(f.totalAmorti)}</div>
                  <div className="text-xs text-muted-foreground">moy. {formatFCFA(f.moyenneAmortissementParBande)}/bande</div>
                </div>
                <div className="p-4 rounded-xl border bg-muted/30 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Reste à récupérer</div>
                  <div className="text-xl font-bold">{formatFCFA(f.resteAAmortir)}</div>
                  {f.bandesRestantesEstimees !== null && (
                    <div className="text-xs text-muted-foreground">≈ {f.bandesRestantesEstimees} bandes supplémentaires</div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 flex items-start gap-3 text-sm text-blue-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Les charges fixes de chaque bande (dépréciation matériel, imprévus, loyer) contribuent progressivement à rembourser le coût de construction.
                  Chaque nouvelle bande récupère en moyenne <strong>{formatFCFA(f.moyenneAmortissementParBande)}</strong>.
                </p>
              </div>
            </CardContent>
          </Card>

          {f.bandesDetails?.length > 0 && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-serif">Contribution de chaque bande</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={f.bandesDetails.map((b: any) => ({ nom: b.nom, contribution: b.chargesTotal }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [formatFCFA(v), "Contribution amortissement"]} />
                    <Bar dataKey="contribution" radius={[6, 6, 0, 0]}>
                      {f.bandesDetails.map((_: any, i: number) => (
                        <Cell key={i} fill={`hsl(${25 + i * 15}, 80%, ${45 + i * 5}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB 3 : ROI & PROJECTIONS ─── */}
        <TabsContent value="roi" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className={`border-2 ${roiPositif ? "border-green-200" : "border-red-200"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">ROI global de l'exploitation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-5xl font-bold ${roiPositif ? "text-green-700" : "text-red-600"}`}>
                  {f.roiGlobal > 0 ? "+" : ""}{f.roiGlobal}%
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  (Recettes − Toutes dépenses) ÷ Capital investi × 100
                </p>
                <div className={`mt-3 text-sm font-medium ${roiPositif ? "text-green-700" : "text-red-600"}`}>
                  {roiPositif ? `Gain net de ${formatFCFA(f.pertesOuGains)} sur l'investissement total` : `Déficit de ${formatFCFA(Math.abs(f.pertesOuGains))} à ce stade`}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">ROI par bande</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Bande</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                        <TableHead className="text-right">Résultat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.bandesDetails?.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                              {b.statut === "active"
                                ? <Clock className="h-3.5 w-3.5 text-blue-500" />
                                : b.beneficeNet >= 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                              {b.nom}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-bold text-sm ${b.roiBande >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {b.roiBande >= 0 ? "+" : ""}{b.roiBande}%
                          </TableCell>
                          <TableCell className={`text-right text-sm ${b.beneficeNet >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {b.beneficeNet >= 0 ? "+" : ""}{formatFCFA(b.beneficeNet)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {f.projectionsBandesActives?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold font-serif flex items-center gap-2">
                <Bird className="h-5 w-5 text-primary" /> Projections — Bandes en cours
              </h3>
              {f.projectionsBandesActives.map((b: any) => (
                <Card key={b.id} className="border-l-4 border-l-primary/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{b.nom}</span>
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {b.sujetsRestants} sujets restants
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {b.hypothese === "pas_de_vente_encore" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        Aucune vente enregistrée — impossible de projeter un prix de vente. Enregistre une première vente pour activer les projections.
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-4">
                        <div className="p-3 rounded-lg bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">Recettes actuelles</div>
                          <div className="font-bold text-green-700">{formatFCFA(b.totalRecettes)}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                          <div className="text-xs text-muted-foreground mb-1">Recettes estimées (total)</div>
                          <div className="font-bold text-blue-700">{formatFCFA(b.recettesEstimees)}</div>
                          <div className="text-xs text-muted-foreground">si vente à {formatFCFA(b.prixVenteMoyenUtilise)}/sujet</div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">Coût de production</div>
                          <div className="font-bold text-red-600">{formatFCFA(b.coutProduction)}</div>
                        </div>
                        <div className={`p-3 rounded-lg border ${b.beneficeEstime >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                          <div className="text-xs text-muted-foreground mb-1">Bénéfice estimé</div>
                          <div className={`font-bold ${b.beneficeEstime >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {b.beneficeEstime >= 0 ? "+" : ""}{formatFCFA(b.beneficeEstime)}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              <div className="text-xs text-muted-foreground px-1">
                Les projections utilisent le prix de vente moyen historique de chaque bande appliqué aux sujets restants. Elles évoluent automatiquement à chaque nouvelle vente enregistrée.
              </div>
            </div>
          )}

          {(!f.projectionsBandesActives || f.projectionsBandesActives.length === 0) && (
            <Card className="bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bird className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Aucune bande active — les projections apparaîtront ici dès qu'une bande est en cours.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB 4 : HISTORIQUE CAISSE ─── */}
        <TabsContent value="historique" className="space-y-6">
          <HistoriqueCaisseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function fetchHistoriqueCaisse() {
  const res = await fetch(`${BASE}/api/dashboard/historique-caisse`, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur chargement historique caisse");
  return res.json();
}

function HistoriqueCaisseTab() {
  const { data, isLoading } = useQuery({ queryKey: ["historique-caisse"], queryFn: fetchHistoriqueCaisse });
  const [dateFilter, setDateFilter] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  if (isLoading) return <div className="min-h-[20vh] flex items-center justify-center text-muted-foreground text-sm">Chargement...</div>;
  if (!data) return <div className="text-destructive text-sm">Erreur de chargement</div>;

  const categories: string[] = [...new Set<string>((data.entries || []).map((e: Record<string, unknown>) => String(e.categorie || "")))].filter(Boolean);
  const filtered = (data.entries || []).filter((e: Record<string, unknown>) => {
    if (dateFilter && !(e.date as string).startsWith(dateFilter)) return false;
    if (catFilter !== "all" && e.categorie !== catFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Journal de caisse</h3>
          <p className="text-sm text-muted-foreground">Tous les mouvements financiers de l'exploitation</p>
        </div>
        <div className={`text-xl font-bold ${data.soldeCourant >= 0 ? "text-green-700" : "text-red-600"}`}>
          Solde : {formatFCFA(data.soldeCourant)}
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Input type="month" placeholder="Filtrer par mois" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-hidden">
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
                  <TableCell className="text-sm">{e.date as string}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${e.type === "entree" ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}`}>
                      {e.type === "entree" ? <ArrowUpRight className="h-3 w-3 mr-1 inline" /> : <ArrowDownRight className="h-3 w-3 mr-1 inline" />}
                      {e.type === "entree" ? "Entrée" : "Sortie"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.categorie as string}</TableCell>
                  <TableCell className="text-sm">{e.designation as string}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${e.type === "entree" ? "text-green-700" : "text-red-600"}`}>
                    {e.type === "entree" ? "+" : "−"}{formatFCFA(e.montant as number)}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-medium ${(e.soldeApres as number) >= 0 ? "" : "text-red-600"}`}>
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
