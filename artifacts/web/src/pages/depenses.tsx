import { useState, useMemo, useEffect } from "react";
import { 
  useListBatimentItems, 
  useCreateBatimentItem, 
  useUpdateBatimentItem, 
  useDeleteBatimentItem,
  useListDepensesPuitsItems,
  useCreateDepensesPuitsItem,
  useUpdateDepensesPuitsItem,
  useDeleteDepensesPuitsItem,
  useGetDashboardSummary,
  useListDevis,
  useGetMe,
  getListBatimentItemsQueryKey,
  getListDepensesPuitsItemsQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Construction, Droplets, Wallet, Search, ChevronDown, ChevronRight, MessageSquare, FileText, FileSpreadsheet } from "lucide-react";
import DesignationCombobox from "@/components/designation-combobox";
import { exportConstructionPDF, exportConstructionExcel } from "@/lib/export";

const CATEGORIES = [
  { value: "materiaux", label: "Matériaux" },
  { value: "main_oeuvre", label: "Main d'oeuvre" },
  { value: "transport", label: "Transport" },
  { value: "carburant", label: "Carburant" },
  { value: "divers", label: "Divers" },
] as const;

const categoryColors: Record<string, string> = {
  materiaux: "bg-blue-100 text-blue-800 border-blue-200",
  main_oeuvre: "bg-orange-100 text-orange-800 border-orange-200",
  transport: "bg-purple-100 text-purple-800 border-purple-200",
  carburant: "bg-red-100 text-red-800 border-red-200",
  divers: "bg-gray-100 text-gray-800 border-gray-200",
};

function getCategoryLabel(value: string) {
  return CATEGORIES.find(c => c.value === value)?.label || value;
}

const depenseSchema = z.object({
  designation: z.string().min(1, "La désignation est requise"),
  quantite: z.coerce.number().min(0.01, "La quantité doit être supérieure à 0"),
  prixUnitaire: z.coerce.number().min(0, "Le prix unitaire doit être positif"),
  categorie: z.string().optional(),
  date: z.string().optional(),
  commentaire: z.string().optional(),
});

type DepenseItem = {
  id: number;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  prixTotal: number;
  categorie?: string;
  date?: string | null;
  commentaire?: string | null;
};

function GroupedTable({ 
  items, 
  isReadOnly, 
  onEdit, 
  onDelete,
  searchQuery 
}: { 
  items: DepenseItem[];
  isReadOnly: boolean;
  onEdit: (item: DepenseItem) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.designation.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, { items: DepenseItem[]; total: number }> = {};
    for (const item of filtered) {
      const cat = item.categorie || "materiaux";
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push(item);
      groups[cat].total += item.prixTotal;
    }
    return groups;
  }, [filtered]);

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const grandTotal = filtered.reduce((s, i) => s + i.prixTotal, 0);
  const colCount = isReadOnly ? 5 : 6;

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10"></TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">Prix unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {!isReadOnly && <TableHead className="text-right w-24">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Aucun résultat pour cette recherche" : "Aucune dépense enregistrée"}
              </TableCell>
            </TableRow>
          ) : (
            CATEGORIES.map(cat => {
              const group = grouped[cat.value];
              if (!group) return null;
              const isCollapsed = collapsedGroups[cat.value];
              return (
                <GroupSection
                  key={cat.value}
                  category={cat.value}
                  label={cat.label}
                  items={group.items}
                  total={group.total}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleGroup(cat.value)}
                  isReadOnly={isReadOnly}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })
          )}
        </TableBody>
        {filtered.length > 0 && (
          <TableFooter>
            <TableRow className="bg-primary/5">
              <TableCell colSpan={4} className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold text-primary">{formatFCFA(grandTotal)}</TableCell>
              {!isReadOnly && <TableCell></TableCell>}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

function GroupSection({
  category,
  label,
  items,
  total,
  isCollapsed,
  onToggle,
  isReadOnly,
  onEdit,
  onDelete,
}: {
  category: string;
  label: string;
  items: DepenseItem[];
  total: number;
  isCollapsed: boolean;
  onToggle: () => void;
  isReadOnly: boolean;
  onEdit: (item: DepenseItem) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <>
      <TableRow 
        className="bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors" 
        onClick={onToggle}
      >
        <TableCell className="w-10 px-3">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
        <TableCell colSpan={2} className="font-semibold">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={categoryColors[category]}>
              {label}
            </Badge>
            <span className="text-muted-foreground text-sm">({items.length} {items.length > 1 ? "lignes" : "ligne"})</span>
          </div>
        </TableCell>
        <TableCell className="text-right font-semibold text-sm text-muted-foreground">Sous-total</TableCell>
        <TableCell className="text-right font-semibold">{formatFCFA(total)}</TableCell>
        {!isReadOnly && <TableCell></TableCell>}
      </TableRow>
      {!isCollapsed && items.map(item => (
        <TableRow key={item.id} className="hover:bg-muted/10">
          <TableCell></TableCell>
          <TableCell>
            <div>
              <span className="font-medium">{item.designation}</span>
              {item.commentaire && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MessageSquare className="h-3 w-3" />
                  {item.commentaire}
                </div>
              )}
              {item.date && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(item.date), 'dd/MM/yyyy')}
                </div>
              )}
            </div>
          </TableCell>
          <TableCell className="text-right">{item.quantite}</TableCell>
          <TableCell className="text-right">{formatFCFA(item.prixUnitaire)}</TableCell>
          <TableCell className="text-right font-medium">{formatFCFA(item.prixTotal)}</TableCell>
          {!isReadOnly && (
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  );
}

function ProgressCard({ label, icon: Icon, spent, budget, color }: { label: string; icon: React.ElementType; spent: number; budget: number; color: string }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const remaining = budget - spent;
  
  return (
    <Card className={`border-t-4 shadow-sm ${color}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-bold text-lg">{formatFCFA(spent)}</span>
          <span className="text-muted-foreground">/ {formatFCFA(budget)}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{pct.toFixed(0)}% utilise</span>
          <span>Reste: {formatFCFA(remaining)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Depenses() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: batimentItems, isLoading: isLoadingBatiment } = useListBatimentItems();
  const { data: puitsItems, isLoading: isLoadingPuits } = useListDepensesPuitsItems();
  const { data: devis, isLoading: isLoadingDevis } = useListDevis();
  const { data: user } = useGetMe();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isReadOnly = user?.role === "investisseur" || user?.role === "lecteur";

  const createBatiment = useCreateBatimentItem();
  const updateBatiment = useUpdateBatimentItem();
  const deleteBatiment = useDeleteBatimentItem();

  const createPuits = useCreateDepensesPuitsItem();
  const updatePuits = useUpdateDepensesPuitsItem();
  const deletePuits = useDeleteDepensesPuitsItem();

  const [activeTab, setActiveTab] = useState("batiment");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [designationSuggestions, setDesignationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || "/";
    fetch(`${base}api/depenses/designations-suggestions`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setDesignationSuggestions(data); })
      .catch(() => {});
  }, []);

  const form = useForm<z.infer<typeof depenseSchema>>({
    resolver: zodResolver(depenseSchema),
    defaultValues: { designation: "", quantite: 1, prixUnitaire: 0, categorie: "materiaux", date: "", commentaire: "" },
  });

  const resetForm = () => {
    form.reset({ designation: "", quantite: 1, prixUnitaire: 0, categorie: "materiaux", date: "", commentaire: "" });
    setEditingId(null);
  };

  const handleEdit = (item: DepenseItem) => {
    setEditingId(item.id);
    form.reset({
      designation: item.designation,
      quantite: item.quantite,
      prixUnitaire: item.prixUnitaire,
      categorie: item.categorie || "materiaux",
      date: item.date ? new Date(item.date).toISOString().split("T")[0] : "",
      commentaire: item.commentaire || "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof depenseSchema>) => {
    try {
      const payload = {
        designation: values.designation,
        quantite: values.quantite,
        prixUnitaire: values.prixUnitaire,
        categorie: values.categorie as any,
        date: values.date || null,
        commentaire: values.commentaire || null,
      };
      
      if (activeTab === "batiment") {
        if (editingId) await updateBatiment.mutateAsync({ id: editingId, data: payload });
        else await createBatiment.mutateAsync({ data: payload });
        queryClient.invalidateQueries({ queryKey: getListBatimentItemsQueryKey() });
      } else {
        if (editingId) await updatePuits.mutateAsync({ id: editingId, data: payload });
        else await createPuits.mutateAsync({ data: payload });
        queryClient.invalidateQueries({ queryKey: getListDepensesPuitsItemsQueryKey() });
      }
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Enregistrement réussi" });
      setIsDialogOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette ligne ?")) return;
    try {
      if (activeTab === "batiment") {
        await deleteBatiment.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListBatimentItemsQueryKey() });
      } else {
        await deletePuits.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListDepensesPuitsItemsQueryKey() });
      }
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Ligne supprimée" });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const isLoading = isLoadingSummary || isLoadingBatiment || isLoadingPuits || isLoadingDevis;

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  const totalBatiment = batimentItems?.reduce((sum, item) => sum + item.prixTotal, 0) || 0;
  const totalForage = puitsItems?.reduce((sum, item) => sum + item.prixTotal, 0) || 0;
  const budgetBatiment = devis?.batimentEstime || 0;
  const budgetForage = devis?.totalPuits || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Dépenses construction</h1>
          <p className="text-muted-foreground mt-1">Suivi des dépenses réelles vs budget prévisionnel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            const items = activeTab === "batiment" ? (batimentItems || []) : (puitsItems || []);
            const title = activeTab === "batiment" ? "Depenses Batiment" : "Depenses Forage";
            exportConstructionPDF(items, title);
          }}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            const items = activeTab === "batiment" ? (batimentItems || []) : (puitsItems || []);
            const title = activeTab === "batiment" ? "Depenses Batiment" : "Depenses Forage";
            exportConstructionExcel(items, title);
          }}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        {!isReadOnly && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle dépense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Modifier la dépense" : `Ajouter une dépense ${activeTab === "batiment" ? "bâtiment" : "forage"}`}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="designation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Désignation</FormLabel>
                      <FormControl><DesignationCombobox value={field.value} onChange={field.onChange} suggestions={designationSuggestions} placeholder="Ex: Sac de ciment, Fer de 8..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="quantite" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantité</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="prixUnitaire" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix unitaire (FCFA)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="categorie" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "materiaux"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date (optionnelle)</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="commentaire" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire (optionnel)</FormLabel>
                      <FormControl><Textarea placeholder="Note ou remarque..." className="resize-none" rows={2} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full">Enregistrer</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ProgressCard 
          label="Bâtiment" 
          icon={Construction} 
          spent={totalBatiment} 
          budget={budgetBatiment} 
          color="border-t-blue-500 bg-blue-50/50" 
        />
        <ProgressCard 
          label="Forage" 
          icon={Droplets} 
          spent={totalForage} 
          budget={budgetForage} 
          color="border-t-cyan-500 bg-cyan-50/50" 
        />
        <Card className="border-t-4 border-t-primary shadow-sm bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total construction</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{formatFCFA(totalBatiment + totalForage)}</div>
            <div className="text-xs text-muted-foreground">
              Caisse disponible : {formatFCFA(summary?.caisseDisponible || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchQuery(""); }} className="w-full">
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="batiment" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Construction className="h-4 w-4" /> Bâtiment
              <Badge variant="secondary" className="ml-1 text-xs">{batimentItems?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="forage" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Droplets className="h-4 w-4" /> Forage
              <Badge variant="secondary" className="ml-1 text-xs">{puitsItems?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="batiment">
          <Card>
            <CardContent className="p-0">
              <GroupedTable
                items={(batimentItems || []) as DepenseItem[]}
                isReadOnly={isReadOnly}
                onEdit={handleEdit}
                onDelete={handleDelete}
                searchQuery={searchQuery}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forage">
          <Card>
            <CardContent className="p-0">
              <GroupedTable
                items={(puitsItems || []) as DepenseItem[]}
                isReadOnly={isReadOnly}
                onEdit={handleEdit}
                onDelete={handleDelete}
                searchQuery={searchQuery}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
