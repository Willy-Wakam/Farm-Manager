import { useState } from "react";
import { useListDevis, useUpdateDevis, useCreatePuitsItem, useUpdatePuitsItem, useDeletePuitsItem, useListFinancements, getListDevisQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const puitsItemSchema = z.object({
  designation: z.string().min(1, "La désignation est requise"),
  quantite: z.coerce.number().min(1, "La quantité doit être supérieure à 0"),
  prixUnitaire: z.coerce.number().min(0, "Le prix unitaire doit être positif"),
});

export default function Devis() {
  const { data: devis, isLoading: isLoadingDevis } = useListDevis();
  const { data: financements } = useListFinancements();
  const updateDevis = useUpdateDevis();
  const createPuitsItem = useCreatePuitsItem();
  const updatePuitsItem = useUpdatePuitsItem();
  const deletePuitsItem = useDeletePuitsItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPuitsDialogOpen, setIsPuitsDialogOpen] = useState(false);
  const [editingPuitsId, setEditingPuitsId] = useState<number | null>(null);

  const [batimentEstime, setBatimentEstime] = useState(devis?.batimentEstime?.toString() || "0");
  const [batimentNotes, setBatimentNotes] = useState(devis?.batimentNotes || "");
  const [carburantEstime, setCarburantEstime] = useState(devis?.carburantEstime?.toString() || "0");

  const puitsForm = useForm<z.infer<typeof puitsItemSchema>>({
    resolver: zodResolver(puitsItemSchema),
    defaultValues: { designation: "", quantite: 1, prixUnitaire: 0 },
  });

  const totalFinance = financements?.reduce((acc, curr) => acc + curr.montant, 0) || 0;
  const isBudgetDeficit = (devis?.totalGeneral || 0) > totalFinance;

  const handleUpdateDevisBase = async () => {
    try {
      await updateDevis.mutateAsync({
        data: {
          batimentEstime: Number(batimentEstime),
          batimentNotes,
          carburantEstime: Number(carburantEstime)
        }
      });
      toast({ title: "Devis mis à jour" });
      queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const onPuitsSubmit = async (values: z.infer<typeof puitsItemSchema>) => {
    try {
      if (editingPuitsId) {
        await updatePuitsItem.mutateAsync({ id: editingPuitsId, data: values });
        toast({ title: "Ligne mise à jour" });
      } else {
        await createPuitsItem.mutateAsync({ data: values });
        toast({ title: "Ligne ajoutée" });
      }
      queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
      setIsPuitsDialogOpen(false);
      puitsForm.reset();
      setEditingPuitsId(null);
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleEditPuits = (item: any) => {
    setEditingPuitsId(item.id);
    puitsForm.reset({
      designation: item.designation,
      quantite: item.quantite,
      prixUnitaire: item.prixUnitaire,
    });
    setIsPuitsDialogOpen(true);
  };

  const handleDeletePuits = async (id: number) => {
    if (confirm("Supprimer cette ligne ?")) {
      try {
        await deletePuitsItem.mutateAsync({ id });
        toast({ title: "Ligne supprimée" });
        queryClient.invalidateQueries({ queryKey: getListDevisQueryKey() });
      } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  if (isLoadingDevis) return <div>Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Devis Construction</h1>
        <p className="text-muted-foreground mt-1">Estimations et budgets prévisionnels</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-t-4 border-t-primary shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total financement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(totalFinance)}</div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-sidebar-primary shadow-sm bg-sidebar-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total devis (général)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(devis?.totalGeneral || 0)}</div>
          </CardContent>
        </Card>

        <Card className={`border-t-4 shadow-sm ${isBudgetDeficit ? 'border-t-destructive bg-destructive/5' : 'border-t-secondary bg-secondary/5'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde prévisionnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isBudgetDeficit ? 'text-destructive' : 'text-secondary'}`}>
              {formatFCFA(totalFinance - (devis?.totalGeneral || 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isBudgetDeficit ? 'Déficit budgétaire' : 'Excédent budgétaire'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-serif">Bâtiment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant estimé (FCFA)</label>
              <Input 
                type="number" 
                value={batimentEstime} 
                onChange={(e) => setBatimentEstime(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes / détails</label>
              <Textarea 
                rows={4}
                value={batimentNotes} 
                onChange={(e) => setBatimentNotes(e.target.value)} 
                placeholder="Détails du bâtiment..."
              />
            </div>
            <Button onClick={handleUpdateDevisBase} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-serif">Carburant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant estimé (FCFA)</label>
              <Input 
                type="number" 
                value={carburantEstime} 
                onChange={(e) => setCarburantEstime(e.target.value)} 
              />
            </div>
            <Button onClick={handleUpdateDevisBase} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-serif">Puits et eau</CardTitle>
          <Dialog open={isPuitsDialogOpen} onOpenChange={(open) => {
            setIsPuitsDialogOpen(open);
            if (!open) {
              puitsForm.reset();
              setEditingPuitsId(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPuitsId ? "Modifier la ligne" : "Ajouter une ligne"}</DialogTitle>
                <DialogDescription>Saisissez les détails de l'estimation pour le puits.</DialogDescription>
              </DialogHeader>
              <Form {...puitsForm}>
                <form onSubmit={puitsForm.handleSubmit(onPuitsSubmit)} className="space-y-4">
                  <FormField control={puitsForm.control} name="designation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Désignation</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={puitsForm.control} name="quantite" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={puitsForm.control} name="prixUnitaire" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix unitaire (FCFA)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createPuitsItem.isPending || updatePuitsItem.isPending}>
                    {editingPuitsId ? "Mettre à jour" : "Enregistrer"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devis?.puitsItems?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune ligne pour le puits.</TableCell>
                  </TableRow>
                ) : (
                  devis?.puitsItems?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.designation}</TableCell>
                      <TableCell className="text-right">{item.quantite}</TableCell>
                      <TableCell className="text-right">{formatFCFA(item.prixUnitaire)}</TableCell>
                      <TableCell className="text-right font-medium">{formatFCFA(item.prixTotal)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditPuits(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePuits(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/5">
                  <TableCell colSpan={3} className="font-bold">Total puits</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatFCFA(devis?.totalPuits || 0)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}