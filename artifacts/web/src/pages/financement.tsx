import { useState } from "react";
import { useListFinancements, useCreateFinancement, useUpdateFinancement, useDeleteFinancement, useGetMe, useGetRemboursements, useCreateRemboursement, useDeleteRemboursement, getListFinancementsQueryKey, getGetDashboardSummaryQueryKey, getGetRemboursementsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

const financementSchema = z.object({
  nom: z.string().min(2, "Le nom est requis"),
  montant: z.coerce.number().min(1, "Le montant doit être supérieur à 0"),
  date: z.string().min(1, "La date est requise"),
});

const remboursementSchema = z.object({
  investisseurNom: z.string().min(1, "Sélectionnez un investisseur"),
  montant: z.coerce.number().min(1, "Le montant doit être supérieur à 0"),
  date: z.string().min(1, "La date est requise"),
  commentaire: z.string().optional(),
});

export default function Financement() {
  const { data: financements, isLoading } = useListFinancements();
  const { data: rembData } = useGetRemboursements();
  const { data: user } = useGetMe();
  const createFinancement = useCreateFinancement();
  const updateFinancement = useUpdateFinancement();
  const deleteFinancement = useDeleteFinancement();
  const createRemboursement = useCreateRemboursement();
  const deleteRemboursement = useDeleteRemboursement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRembDialogOpen, setIsRembDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const isAdmin = user?.role === "admin";
  const isReadOnly = user?.role === "investisseur" || user?.role === "gestionnaire" || user?.role === "lecteur";

  const form = useForm<z.infer<typeof financementSchema>>({
    resolver: zodResolver(financementSchema),
    defaultValues: { nom: "", montant: 0, date: new Date().toISOString().split("T")[0] },
  });

  const rembForm = useForm<z.infer<typeof remboursementSchema>>({
    resolver: zodResolver(remboursementSchema),
    defaultValues: { investisseurNom: "", montant: 0, date: new Date().toISOString().split("T")[0], commentaire: "" },
  });

  const onSubmit = async (values: z.infer<typeof financementSchema>) => {
    try {
      if (editingId) {
        await updateFinancement.mutateAsync({ id: editingId, data: values });
        toast({ title: "Financement mis à jour" });
      } else {
        await createFinancement.mutateAsync({ data: values });
        toast({ title: "Financement ajouté" });
      }
      queryClient.invalidateQueries({ queryKey: getListFinancementsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRemboursementsQueryKey() });
      setIsDialogOpen(false);
      form.reset();
      setEditingId(null);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const onRembSubmit = async (values: z.infer<typeof remboursementSchema>) => {
    try {
      await createRemboursement.mutateAsync({ data: values });
      toast({ title: "Remboursement enregistré" });
      queryClient.invalidateQueries({ queryKey: getGetRemboursementsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setIsRembDialogOpen(false);
      rembForm.reset();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleEdit = (item: { id: number; nom: string; montant: number; date: string }) => {
    setEditingId(item.id);
    form.reset({ nom: item.nom, montant: item.montant, date: new Date(item.date).toISOString().split("T")[0] });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Voulez-vous vraiment supprimer cet apport ?")) {
      try {
        await deleteFinancement.mutateAsync({ id });
        toast({ title: "Financement supprimé" });
        queryClient.invalidateQueries({ queryKey: getListFinancementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      } catch {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  const handleDeleteRemb = async (id: number) => {
    if (confirm("Supprimer ce remboursement ?")) {
      try {
        await deleteRemboursement.mutateAsync({ id });
        toast({ title: "Remboursement supprimé" });
        queryClient.invalidateQueries({ queryKey: getGetRemboursementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      } catch {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  const totalInvesti = financements?.reduce((acc, curr) => acc + curr.montant, 0) || 0;
  const investisseurNoms = [...new Set(financements?.map(f => f.nom) || [])];

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Financement</h1>
        <p className="text-muted-foreground mt-1">Suivi des apports et remboursements</p>
      </div>

      <Tabs defaultValue="investissements">
        <TabsList>
          <TabsTrigger value="investissements">Investissements</TabsTrigger>
          <TabsTrigger value="remboursements">Remboursements</TabsTrigger>
          <TabsTrigger value="soldes">Soldes investisseurs</TabsTrigger>
        </TabsList>

        <TabsContent value="investissements" className="space-y-4">
          <div className="flex justify-end">
            {!isReadOnly && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { form.reset(); setEditingId(null); } }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />Nouvel apport</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Modifier l'apport" : "Ajouter un apport"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="nom" render={({ field }) => (
                        <FormItem><FormLabel>Nom du membre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="montant" render={({ field }) => (
                        <FormItem><FormLabel>Montant (FCFA)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createFinancement.isPending || updateFinancement.isPending}>
                        {editingId ? "Mettre à jour" : "Enregistrer"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {financements?.length === 0 ? (
                  <TableRow><TableCell colSpan={isReadOnly ? 3 : 4} className="text-center py-8 text-muted-foreground">Aucun financement enregistré.</TableCell></TableRow>
                ) : (
                  financements?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{item.nom}</TableCell>
                      <TableCell className="text-right font-medium">{formatFCFA(item.montant)}</TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableCell colSpan={2} className="font-bold text-lg">Total investi</TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">{formatFCFA(totalInvesti)}</TableCell>
                  {!isReadOnly && <TableCell></TableCell>}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="remboursements" className="space-y-4">
          <div className="flex justify-end">
            {!isReadOnly && (
              <Dialog open={isRembDialogOpen} onOpenChange={(open) => { setIsRembDialogOpen(open); if (!open) rembForm.reset(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><ArrowDownRight className="h-4 w-4" />Nouveau remboursement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Enregistrer un remboursement</DialogTitle></DialogHeader>
                  <Form {...rembForm}>
                    <form onSubmit={rembForm.handleSubmit(onRembSubmit)} className="space-y-4">
                      <FormField control={rembForm.control} name="investisseurNom" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investisseur</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {investisseurNoms.map(nom => <SelectItem key={nom} value={nom}>{nom}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={rembForm.control} name="montant" render={({ field }) => (
                        <FormItem><FormLabel>Montant (FCFA)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={rembForm.control} name="date" render={({ field }) => (
                        <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={rembForm.control} name="commentaire" render={({ field }) => (
                        <FormItem><FormLabel>Commentaire</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createRemboursement.isPending}>Enregistrer</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Investisseur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Commentaire</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!rembData?.remboursements || rembData.remboursements.length === 0) ? (
                  <TableRow><TableCell colSpan={isReadOnly ? 4 : 5} className="text-center py-8 text-muted-foreground">Aucun remboursement enregistré.</TableCell></TableRow>
                ) : (
                  rembData.remboursements.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{r.investisseurNom}</TableCell>
                      <TableCell className="text-right font-medium">{formatFCFA(r.montant)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.commentaire || "-"}</TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteRemb(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="soldes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rembData?.soldesInvestisseurs?.map((s) => (
              <Card key={s.nom} className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{s.nom}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total investi</span>
                    <span className="font-medium">{formatFCFA(s.totalInvesti)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total remboursé</span>
                    <span className="font-medium text-green-700">{formatFCFA(s.totalRembourse)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Solde restant dû</span>
                    <span className={`font-bold text-lg ${s.soldeRestant > 0 ? "text-orange-600" : "text-green-700"}`}>{formatFCFA(s.soldeRestant)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!rembData?.soldesInvestisseurs || rembData.soldesInvestisseurs.length === 0) && (
              <div className="col-span-full text-center py-8 text-muted-foreground">Aucune donnée de financement.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
