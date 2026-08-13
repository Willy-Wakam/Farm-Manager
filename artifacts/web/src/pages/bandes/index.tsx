import { useRef, useState } from "react";
import { Link } from "wouter";
import { 
  useListBandes, 
  useCreateBande, 
  useDeleteBande, 
  useGetMe,
  getListBandesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchBandeDetail } from "@/offline/prefetch";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowRight, Bird, Upload } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CreateBandeBodyStatut } from "@workspace/api-client-react";
import { PageHeader, PageHeaderActions, PageHeaderContent } from "@/components/ui/responsive-layout";

const bandeSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  dateDeDepart: z.string().min(1, "La date de démarrage est requise"),
  sujetsDepart: z.coerce.number().min(1, "Il faut au moins 1 sujet"),
  statut: z.enum([CreateBandeBodyStatut.active, CreateBandeBodyStatut.terminee]).default(CreateBandeBodyStatut.active),
});

export default function Bandes() {
  const { data: bandes, isLoading } = useListBandes();
  const { data: user } = useGetMe();
  const createBande = useCreateBande();
  const deleteBande = useDeleteBande();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fichierInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = user?.role === "investisseur" || user?.role === "lecteur";

  const handleFichierHistorique = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    if (!confirm(`Importer l'historique depuis "${fichier.name}" ? Chaque feuille du classeur créera une bande avec ses données de suivi.`)) return;

    setImporting(true);
    try {
      const base = import.meta.env.BASE_URL || "/";
      const body = new FormData();
      body.append("fichier", fichier);
      const resp = await fetch(`${base}api/import-historical`, { method: "POST", credentials: "include", body });
      const data = await resp.json();
      if (data.success) {
        const imported = data.results.filter((r: any) => r.status === "imported");
        const ignorees = data.results.length - imported.length;
        toast({
          title: `${imported.length} bande(s) importée(s)`,
          description: ignorees > 0 ? `${ignorees} feuille(s) ignorée(s) (déjà importée ou sans données).` : undefined,
        });
        queryClient.invalidateQueries({ queryKey: getListBandesQueryKey() });
      } else {
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur d'import", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const form = useForm<z.infer<typeof bandeSchema>>({
    resolver: zodResolver(bandeSchema),
    defaultValues: {
      nom: "",
      dateDeDepart: new Date().toISOString().split("T")[0],
      sujetsDepart: 1000,
      statut: CreateBandeBodyStatut.active,
    },
  });

 const onSubmit = async (values: z.infer<typeof bandeSchema>) => {
  try {
    const bande = await createBande.mutateAsync({
      data: values,
    });

    toast({
      title: "Bande créée",
    });

    await queryClient.invalidateQueries({
      queryKey: getListBandesQueryKey(),
    });

    await prefetchBandeDetail(
      queryClient,
      bande.id,
    );

    setIsDialogOpen(false);
    form.reset();
  } catch (e) {
    toast({
      title: "Erreur",
      variant: "destructive",
    });
  }
};

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Voulez-vous vraiment supprimer cette bande ?")) {
      try {
        await deleteBande.mutateAsync({ id });
        toast({ title: "Bande supprimée" });
        queryClient.invalidateQueries({ queryKey: getListBandesQueryKey() });
      } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="truncate text-2xl font-bold tracking-tight font-serif text-foreground sm:text-3xl">Bandes de poulets</h1>
          <p className="text-muted-foreground mt-1">Gestion des cycles de production</p>
        </PageHeaderContent>
        {!isReadOnly && (
          <PageHeaderActions>
            <input
              ref={fichierInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFichierHistorique}
            />
            <Button
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              onClick={() => fichierInputRef.current?.click()}
              disabled={importing}
              title="Importer un classeur Excel de suivi : une feuille par bande"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{importing ? "Import en cours..." : "Importer historique"}</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) form.reset();
            }}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2 sm:w-auto">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">Nouvelle bande</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer une bande</DialogTitle>
                  <DialogDescription>Initialisez un nouveau lot de production.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la bande (ex: Bande A1)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateDeDepart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de démarrage</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sujetsDepart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de sujets au départ</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="statut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut initial</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner le statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={CreateBandeBodyStatut.active}>Active</SelectItem>
                            <SelectItem value={CreateBandeBodyStatut.terminee}>Terminée</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    <Button type="submit" className="min-h-10 w-full" disabled={createBande.isPending}>
                      Créer
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </PageHeaderActions>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bandes?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
            <Bird className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Aucune bande enregistrée.</p>
          </div>
        ) : (
          bandes?.map(bande => (
            <Link key={bande.id} href={`/bandes/${bande.id}`} className="block group">
              <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${bande.statut === 'terminee' ? 'opacity-80 bg-muted/30' : ''}`}>
                <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg font-serif transition-colors group-hover:text-primary sm:text-xl">
                      {bande.nom}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      N° {bande.numero} • Démarré le {format(new Date(bande.dateDeDepart + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <span className={`inline-flex w-fit shrink-0 items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bande.statut === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                    {bande.statut === 'active' ? 'Active' : 'Terminée'}
                  </span>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sujets départ:</span>
                    <span className="font-medium">{bande.sujetsDepart}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Décès:</span>
                    <span className="font-medium text-destructive">{bande.nombreDeces}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-3 rounded-b-xl border-t bg-muted/10 pt-3">
                  <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-primary">
                    Voir détails <ArrowRight className="h-3 w-3" />
                  </span>
                  {!isReadOnly && user?.role === 'admin' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                      onClick={(e) => handleDelete(e, bande.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
