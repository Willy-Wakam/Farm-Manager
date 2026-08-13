import { useGetComparaisonBandes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";
import { BarChart3, Target } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function ComparaisonBandes() {
  const { data: bandes, isLoading, error } = useGetComparaisonBandes();

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Chargement...</div>;
  if (error) return <div className="text-destructive p-4">Erreur de chargement des données de comparaison.</div>;

  const items = (bandes || []) as unknown as Array<Record<string, unknown>>;

  const chartData = items.map(b => ({
    nom: b.nom as string,
    coutParSujet: b.coutParSujet as number,
    prixVenteMoyen: b.prixVenteMoyen as number,
    beneficeNet: b.beneficeNet as number,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Comparaison des bandes</h1>
        <p className="text-muted-foreground mt-1">Analyse comparative des performances entre bandes</p>
      </div>

      {items.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune bande terminée pour comparer. Les données apparaîtront après la clôture de la première bande.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  Coût / sujet vs Prix de vente moyen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="nom" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip formatter={(value: number) => [formatFCFA(value)]} />
                      <Legend />
                      <Bar dataKey="coutParSujet" fill="hsl(var(--destructive))" name="Coût/sujet" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="prixVenteMoyen" fill="hsl(var(--primary))" name="Prix vente moy." radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  Bénéfice net par bande
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="nom" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip formatter={(value: number) => [formatFCFA(value), "Bénéfice"]} />
                      <Bar dataKey="beneficeNet" fill="hsl(var(--chart-2))" name="Bénéfice net" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Tableau comparatif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Bande</TableHead>
                      <TableHead className="text-right">Sujets départ</TableHead>
                      <TableHead className="text-right">Mortalité</TableHead>
                      <TableHead className="text-right">Vendus</TableHead>
                      <TableHead className="text-right">Durée (j)</TableHead>
                      <TableHead className="text-right">Coût/sujet</TableHead>
                      <TableHead className="text-right">Prix vente moy.</TableHead>
                      <TableHead className="text-right">Bénéfice net</TableHead>
                      <TableHead className="text-right">Seuil (nb poulets)</TableHead>
                      <TableHead className="text-right">Prix min seuil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((b) => (
                      <TableRow key={b.id as number}>
                        <TableCell className="font-medium">{b.nom as string}</TableCell>
                        <TableCell className="text-right">{b.sujetsDepart as number}</TableCell>
                        <TableCell className={`text-right ${(b.tauxMortalite as number) > 5 ? "text-red-600 font-medium" : ""}`}>
                          {b.tauxMortalite as number}%
                        </TableCell>
                        <TableCell className="text-right">{b.totalVendus as number}</TableCell>
                        <TableCell className="text-right">{b.dureeJours as number}</TableCell>
                        <TableCell className="text-right">{formatFCFA(b.coutParSujet as number)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(b.prixVenteMoyen as number)}</TableCell>
                        <TableCell className={`text-right font-bold ${(b.beneficeNet as number) >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {formatFCFA(b.beneficeNet as number)}
                        </TableCell>
                        <TableCell className="text-right">{b.seuilNombrePoulets as number}</TableCell>
                        <TableCell className="text-right">{formatFCFA(b.seuilPrixMin as number)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
