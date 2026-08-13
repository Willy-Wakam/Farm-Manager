import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useStockAliments, useCreateStockAliment, useDeleteStockAliment, useStockMedicaments, useCreateStockMedicament, useDeleteStockMedicament } from "@/lib/stocks-api";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wheat, Pill, AlertTriangle, Package, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const alimentSchema = z.object({
  designation: z.string().min(1, "La désignation est requise"),
  type: z.enum(["entree", "sortie"]),
  quantiteKg: z.coerce.number().min(0.1, "La quantité doit être positive"),
  prixUnitaire: z.coerce.number().optional(),
  fournisseur: z.string().optional(),
  date: z.string().min(1, "La date est requise"),
  commentaire: z.string().optional(),
});

const medicamentSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  type: z.enum(["entree", "sortie"]),
  quantite: z.coerce.number().min(0.1, "La quantité doit être positive"),
  unite: z.string().min(1, "L'unité est requise"),
  datePeremption: z.string().optional(),
  fournisseur: z.string().optional(),
  date: z.string().min(1, "La date est requise"),
  commentaire: z.string().optional(),
});

export default function Stocks() {
  const { data: user } = useGetMe();
  const { data: alimentsData, isLoading: loadingAliments } = useStockAliments();
  const { data: medicamentsData, isLoading: loadingMedicaments } = useStockMedicaments();
  const createAliment = useCreateStockAliment();
  const deleteAliment = useDeleteStockAliment();
  const createMedicament = useCreateStockMedicament();
  const deleteMedicament = useDeleteStockMedicament();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"aliment" | "medicament">("aliment");

  const isReadOnly = user?.role === "investisseur" || user?.role === "lecteur";

  const alimentForm = useForm<z.infer<typeof alimentSchema>>({
    resolver: zodResolver(alimentSchema),
    defaultValues: { designation: "", type: "entree", quantiteKg: 0, date: new Date().toISOString().split("T")[0], fournisseur: "", commentaire: "" },
  });

  const medicamentForm = useForm<z.infer<typeof medicamentSchema>>({
    resolver: zodResolver(medicamentSchema),
    defaultValues: { nom: "", type: "entree", quantite: 0, unite: "flacon", date: new Date().toISOString().split("T")[0], fournisseur: "", commentaire: "" },
  });

  const onAlimentSubmit = async (values: z.infer<typeof alimentSchema>) => {
    try {
      await createAliment.mutateAsync(values);
      toast({ title: "Stock aliment enregistré" });
      setDialogOpen(false);
      alimentForm.reset({ designation: "", type: "entree", quantiteKg: 0, date: new Date().toISOString().split("T")[0], fournisseur: "", commentaire: "" });
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onMedicamentSubmit = async (values: z.infer<typeof medicamentSchema>) => {
    try {
      await createMedicament.mutateAsync(values);
      toast({ title: "Stock médicament enregistré" });
      setDialogOpen(false);
      medicamentForm.reset({ nom: "", type: "entree", quantite: 0, unite: "flacon", date: new Date().toISOString().split("T")[0], fournisseur: "", commentaire: "" });
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const stockActuel = alimentsData?.stockActuel || 0;
  const joursRestants = alimentsData?.items?.length > 0
    ? Math.round(stockActuel / (alimentsData.totalSorties / Math.max(alimentsData.items.filter((i: any) => i.type === "sortie").length, 1) || 1))
    : null;

  if (loadingAliments || loadingMedicaments) return <div>Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Gestion des stocks</h1>
        <p className="text-muted-foreground mt-1">Suivi des aliments et produits vétérinaires</p>
      </div>

      <Tabs defaultValue="aliments">
        <TabsList>
          <TabsTrigger value="aliments" className="gap-2"><Wheat className="h-4 w-4" /> Aliments</TabsTrigger>
          <TabsTrigger value="medicaments" className="gap-2"><Pill className="h-4 w-4" /> Médicaments / Vaccins</TabsTrigger>
        </TabsList>

        <TabsContent value="aliments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-t-4 border-t-primary">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stock actuel</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockActuel.toFixed(1)} kg</div>
                {stockActuel < 100 && stockActuel > 0 && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" /> Stock bas</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total entrées</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{(alimentsData?.totalEntrees || 0).toFixed(1)} kg</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total sorties</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-red-600">{(alimentsData?.totalSorties || 0).toFixed(1)} kg</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-serif">Mouvements de stock aliments</CardTitle>
              {!isReadOnly && (
                <Button size="sm" className="gap-2" onClick={() => { setDialogType("aliment"); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4" /> Nouveau mouvement
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Désignation</TableHead>
                      <TableHead className="text-right">Quantité (kg)</TableHead><TableHead className="text-right">Prix U.</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!alimentsData?.items || alimentsData.items.length === 0) ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun mouvement enregistré</TableCell></TableRow>
                    ) : (
                      alimentsData.items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{format(new Date(item.date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            {item.type === "entree" ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-800"><ArrowDownCircle className="h-3 w-3" /> Entrée</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800"><ArrowUpCircle className="h-3 w-3" /> Sortie</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.designation}</TableCell>
                          <TableCell className="text-right">{item.quantiteKg} kg</TableCell>
                          <TableCell className="text-right">{item.prixUnitaire ? formatFCFA(item.prixUnitaire) : "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{item.fournisseur || "-"}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                if (confirm("Supprimer ce mouvement ?")) {
                                  try {
                                    await deleteAliment.mutateAsync(item.id);
                                    toast({ title: "Mouvement supprimé" });
                                  } catch { toast({ title: "Erreur", variant: "destructive" }); }
                                }
                              }}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medicaments" className="space-y-4">
          {medicamentsData?.peremptionProche?.length > 0 && (
            <Card className="border-l-4 border-l-orange-500 bg-orange-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-orange-800 font-medium">
                  <AlertTriangle className="h-5 w-5" />
                  Produits proches de la date de péremption
                </div>
                <ul className="mt-2 text-sm text-orange-700">
                  {medicamentsData.peremptionProche.map((p: any, i: number) => (
                    <li key={i}>{p.nom} - péremption : {p.datePeremption}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {medicamentsData?.resume?.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {medicamentsData.resume.map((r: any, i: number) => (
                <Card key={i} className={r.stockActuel <= 0 ? "border-red-200 bg-red-50/50" : ""}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{r.nom}</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold ${r.stockActuel <= 0 ? "text-red-600" : ""}`}>{r.stockActuel} {r.unite}</div>
                    {r.datePeremption && <p className="text-xs text-muted-foreground mt-1">Péremption : {r.datePeremption}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-serif">Mouvements médicaments / vaccins</CardTitle>
              {!isReadOnly && (
                <Button size="sm" className="gap-2" onClick={() => { setDialogType("medicament"); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4" /> Nouveau mouvement
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Produit</TableHead>
                      <TableHead className="text-right">Quantité</TableHead><TableHead>Péremption</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!medicamentsData?.items || medicamentsData.items.length === 0) ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun mouvement enregistré</TableCell></TableRow>
                    ) : (
                      medicamentsData.items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{format(new Date(item.date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            {item.type === "entree" ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-100 text-green-800"><ArrowDownCircle className="h-3 w-3" /> Entrée</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800"><ArrowUpCircle className="h-3 w-3" /> Sortie</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.nom}</TableCell>
                          <TableCell className="text-right">{item.quantite} {item.unite}</TableCell>
                          <TableCell className="text-muted-foreground">{item.datePeremption || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{item.fournisseur || "-"}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                if (confirm("Supprimer ce mouvement ?")) {
                                  try {
                                    await deleteMedicament.mutateAsync(item.id);
                                    toast({ title: "Mouvement supprimé" });
                                  } catch { toast({ title: "Erreur", variant: "destructive" }); }
                                }
                              }}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogType === "aliment" ? "Mouvement stock aliment" : "Mouvement médicament / vaccin"}</DialogTitle>
            <DialogDescription>Enregistrez une entrée ou sortie de stock.</DialogDescription>
          </DialogHeader>

          {dialogType === "aliment" ? (
            <Form {...alimentForm}>
              <form onSubmit={alimentForm.handleSubmit(onAlimentSubmit)} className="space-y-4">
                <FormField control={alimentForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="entree">Entrée (achat)</SelectItem>
                        <SelectItem value="sortie">Sortie (consommation)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={alimentForm.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Désignation</FormLabel><FormControl><Input placeholder="ex: Aliment démarrage" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={alimentForm.control} name="quantiteKg" render={({ field }) => (
                    <FormItem><FormLabel>Quantité (kg)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={alimentForm.control} name="prixUnitaire" render={({ field }) => (
                    <FormItem><FormLabel>Prix unitaire (FCFA)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={alimentForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={alimentForm.control} name="fournisseur" render={({ field }) => (
                  <FormItem><FormLabel>Fournisseur (optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createAliment.isPending}>Enregistrer</Button>
              </form>
            </Form>
          ) : (
            <Form {...medicamentForm}>
              <form onSubmit={medicamentForm.handleSubmit(onMedicamentSubmit)} className="space-y-4">
                <FormField control={medicamentForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="entree">Entrée (achat)</SelectItem>
                        <SelectItem value="sortie">Sortie (utilisation)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={medicamentForm.control} name="nom" render={({ field }) => (
                  <FormItem><FormLabel>Nom du produit</FormLabel><FormControl><Input placeholder="ex: Vaccin Newcastle" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={medicamentForm.control} name="quantite" render={({ field }) => (
                    <FormItem><FormLabel>Quantité</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={medicamentForm.control} name="unite" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unité</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="flacon">Flacon</SelectItem>
                          <SelectItem value="boîte">Boîte</SelectItem>
                          <SelectItem value="sachet">Sachet</SelectItem>
                          <SelectItem value="litre">Litre</SelectItem>
                          <SelectItem value="kg">Kg</SelectItem>
                          <SelectItem value="unité">Unité</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={medicamentForm.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={medicamentForm.control} name="datePeremption" render={({ field }) => (
                    <FormItem><FormLabel>Péremption</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={medicamentForm.control} name="fournisseur" render={({ field }) => (
                  <FormItem><FormLabel>Fournisseur (optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMedicament.isPending}>Enregistrer</Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
