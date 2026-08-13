import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, ArrowLeft, Construction, Package2, CheckCircle2, Clock, ChevronRight, ChevronDown, Building2, Wrench, MapPin, TrendingDown, Lock, MessageSquare, Search, FileDown, FileSpreadsheet } from "lucide-react";
import { exportConstructionPDF, exportConstructionExcel } from "@/lib/export";

const API = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Erreur API"); }
  return res.json();
}

const CATEGORIES_CONSTRUCTION = [
  { value: "materiaux", label: "Matériaux" },
  { value: "main_oeuvre", label: "Main d'oeuvre" },
  { value: "transport", label: "Transport" },
  { value: "carburant", label: "Carburant" },
  { value: "divers", label: "Divers" },
];

const categoryColors: Record<string, string> = {
  materiaux: "bg-blue-100 text-blue-800 border-blue-200",
  main_oeuvre: "bg-orange-100 text-orange-800 border-orange-200",
  transport: "bg-purple-100 text-purple-800 border-purple-200",
  carburant: "bg-red-100 text-red-800 border-red-200",
  divers: "bg-gray-100 text-gray-800 border-gray-200",
};

const TYPE_ACTIF = [
  { value: "terrain", label: "Terrain", icon: MapPin },
  { value: "batiment", label: "Bâtiment", icon: Building2 },
  { value: "materiel", label: "Matériel", icon: Wrench },
];

const typeLabel = (t: string) => TYPE_ACTIF.find(x => x.value === t)?.label || t;
const catLabel = (v: string) => CATEGORIES_CONSTRUCTION.find(c => c.value === v)?.label || v;

const typeColors: Record<string, string> = {
  terrain: "bg-green-100 text-green-800 border-green-200",
  batiment: "bg-blue-100 text-blue-800 border-blue-200",
  materiel: "bg-orange-100 text-orange-800 border-orange-200",
};

const chantierSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  dateDebut: z.string().optional(),
});

const depenseSchema = z.object({
  designation: z.string().min(1, "La désignation est requise"),
  quantite: z.coerce.number().min(0.01),
  prixUnitaire: z.coerce.number().min(0),
  categorie: z.string().optional(),
  date: z.string().optional(),
  commentaire: z.string().optional(),
  lotId: z.coerce.number().optional(),
});

const lotSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
});

const devisLigneSchema = z.object({
  poste: z.string().min(1, "Le poste est requis"),
  montantPrevu: z.coerce.number().min(0),
});

const actifSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  type: z.string().min(1, "Le type est requis"),
  valeur: z.coerce.number().min(0),
  tauxAmortissementAnnuel: z.coerce.number().min(0),
  dateAcquisition: z.string().min(1, "La date est requise"),
  description: z.string().optional(),
});

const clotureSchema = z.object({
  tauxAmortissement: z.coerce.number().min(0).max(100),
  dateAcquisition: z.string().min(1, "La date est requise"),
});

type ChantierSummary = { id: number; nom: string; description?: string; statut: string; dateDebut?: string; dateCloture?: string; totalReel: number; totalPrevu: number; nbDepenses: number; createdAt: string };
type DepenseItem = { id: number; chantierId: number; lotId?: number | null; designation: string; quantite: string; prixUnitaire: string; prixTotal: number; categorie?: string; date?: string; commentaire?: string };
type DevisLigne = { id: number; chantierId: number; lotId?: number | null; poste: string; montantPrevu: string; ordre: number };
type LotDetail = { id: number; chantierId: number; nom: string; description?: string; ordre: number; depenses: DepenseItem[]; devisLignes: DevisLigne[]; totalReel: number; totalPrevu: number };
type ChantierDetail = ChantierSummary & { depenses: DepenseItem[]; devisLignes: DevisLigne[]; lots: LotDetail[] };
type Actif = { id: number; nom: string; type: string; valeur: number; tauxAmortissementAnnuel: number; dateAcquisition: string; description?: string; chantierId?: number; createdAt: string };

function useChantiers() {
  return useQuery<ChantierSummary[]>({ queryKey: ["/api/chantiers"], queryFn: () => apiFetch("/chantiers") });
}
function useChantier(id: number | null) {
  return useQuery<ChantierDetail>({ queryKey: ["/api/chantiers", id], queryFn: () => apiFetch(`/chantiers/${id}`), enabled: id !== null });
}
function useActifs() {
  return useQuery<Actif[]>({ queryKey: ["/api/actifs"], queryFn: () => apiFetch("/actifs") });
}

function ChantierFormDialog({ onSuccess, trigger }: { onSuccess: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof chantierSchema>>({ resolver: zodResolver(chantierSchema), defaultValues: { nom: "", description: "", dateDebut: new Date().toISOString().split("T")[0] } });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof chantierSchema>) => apiFetch("/chantiers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: "Chantier créé" }); setOpen(false); form.reset(); onSuccess(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau chantier</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="nom" render={({ field }) => (
              <FormItem><FormLabel>Nom du chantier</FormLabel><FormControl><Input placeholder="Ex : Bâtiment C" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description (optionnel)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="dateDebut" render={({ field }) => (
              <FormItem><FormLabel>Date de début</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={mutation.isPending} className="w-full">Créer le chantier</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DepenseFormDialog({ chantierId, depense, lots, defaultLotId, onSuccess, trigger }: { chantierId: number; depense?: DepenseItem; lots?: LotDetail[]; defaultLotId?: number; onSuccess: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!depense;
  const form = useForm<z.infer<typeof depenseSchema>>({
    resolver: zodResolver(depenseSchema),
    defaultValues: depense
      ? { designation: depense.designation, quantite: parseFloat(depense.quantite), prixUnitaire: parseFloat(depense.prixUnitaire), categorie: depense.categorie || "materiaux", date: depense.date || "", commentaire: depense.commentaire || "", lotId: depense.lotId || undefined }
      : { designation: "", quantite: 1, prixUnitaire: 0, categorie: "materiaux", date: "", commentaire: "", lotId: defaultLotId },
  });
  const currentCategorie = form.watch("categorie");
  const { data: designationsSuggested } = useQuery<string[]>({
    queryKey: ["/api/chantiers/designations", currentCategorie],
    queryFn: () => apiFetch(`/chantiers/designations?categorie=${encodeURIComponent(currentCategorie || "materiaux")}`),
    enabled: open && currentCategorie === "materiaux",
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof depenseSchema>) => isEdit
      ? apiFetch(`/chantiers/${chantierId}/depenses/${depense!.id}`, { method: "PUT", body: JSON.stringify(data) })
      : apiFetch(`/chantiers/${chantierId}/depenses`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: isEdit ? "Dépense mise à jour" : "Dépense ajoutée" }); setOpen(false); if (!isEdit) form.reset({ designation: "", quantite: 1, prixUnitaire: 0, categorie: "materiaux", date: "", commentaire: "", lotId: defaultLotId }); onSuccess(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Modifier la dépense" : "Ajouter une dépense"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="designation" render={({ field }) => (
              <FormItem>
                <FormLabel>Désignation</FormLabel>
                <FormControl>
                  <Input {...field} list={currentCategorie === "materiaux" ? "designations-materiaux" : undefined} autoComplete="off" />
                </FormControl>
                {currentCategorie === "materiaux" && designationsSuggested && designationsSuggested.length > 0 && (
                  <datalist id="designations-materiaux">
                    {designationsSuggested.map((d) => <option key={d} value={d} />)}
                  </datalist>
                )}
                {currentCategorie === "materiaux" && (
                  <p className="text-xs text-muted-foreground">Astuce : choisissez dans la liste pour éviter les doublons (ex : "Parpaings" / "parpaing")</p>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="quantite" render={({ field }) => (
                <FormItem><FormLabel>Quantité</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="prixUnitaire" render={({ field }) => (
                <FormItem><FormLabel>Prix unitaire</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="categorie" render={({ field }) => (
                <FormItem><FormLabel>Catégorie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{CATEGORIES_CONSTRUCTION.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              {lots && lots.length > 0 && (
                <FormField control={form.control} name="lotId" render={({ field }) => (
                  <FormItem><FormLabel>Lot</FormLabel>
                    <Select onValueChange={v => field.onChange(parseInt(v))} defaultValue={field.value ? String(field.value) : undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                      <SelectContent>{lots.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date (optionnel)</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="commentaire" render={({ field }) => (
                <FormItem><FormLabel>Commentaire</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <Button type="submit" disabled={mutation.isPending} className="w-full">{isEdit ? "Mettre à jour" : "Ajouter"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DevisLigneFormDialog({ chantierId, ligne, lots, defaultLotId, onSuccess, trigger }: { chantierId: number; ligne?: DevisLigne; lots?: LotDetail[]; defaultLotId?: number; onSuccess: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!ligne;
  const form = useForm<z.infer<typeof devisLigneSchema>>({
    resolver: zodResolver(devisLigneSchema),
    defaultValues: ligne ? { poste: ligne.poste, montantPrevu: parseFloat(ligne.montantPrevu) } : { poste: "", montantPrevu: 0 },
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof devisLigneSchema>) => isEdit
      ? apiFetch(`/chantiers/${chantierId}/devis/${ligne!.id}`, { method: "PUT", body: JSON.stringify(data) })
      : apiFetch(`/chantiers/${chantierId}/devis`, { method: "POST", body: JSON.stringify({ ...data, lotId: defaultLotId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: isEdit ? "Ligne mise à jour" : "Ligne ajoutée" }); setOpen(false); if (!isEdit) form.reset(); onSuccess(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Modifier le poste" : "Ajouter un poste budgétaire"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="poste" render={({ field }) => (
              <FormItem><FormLabel>Poste</FormLabel><FormControl><Input placeholder="Ex : Fondations, Toiture..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="montantPrevu" render={({ field }) => (
              <FormItem><FormLabel>Montant prévu (FCFA)</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" disabled={mutation.isPending} className="w-full">{isEdit ? "Mettre à jour" : "Ajouter"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function LotFormDialog({ chantierId, lot, onSuccess, trigger }: { chantierId: number; lot?: LotDetail; onSuccess: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!lot;
  const form = useForm<z.infer<typeof lotSchema>>({
    resolver: zodResolver(lotSchema),
    defaultValues: lot ? { nom: lot.nom, description: lot.description || "" } : { nom: "", description: "" },
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof lotSchema>) => isEdit
      ? apiFetch(`/chantiers/${chantierId}/lots/${lot!.id}`, { method: "PUT", body: JSON.stringify(data) })
      : apiFetch(`/chantiers/${chantierId}/lots`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: isEdit ? "Lot mis à jour" : "Lot ajouté" }); setOpen(false); form.reset(); onSuccess(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Modifier le lot" : "Nouveau lot"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="nom" render={({ field }) => (
              <FormItem><FormLabel>Nom du lot</FormLabel><FormControl><Input placeholder="Ex : Bâtiment principal, Forage..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description (optionnel)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={mutation.isPending} className="w-full">{isEdit ? "Mettre à jour" : "Créer le lot"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ClotureDialog({ chantier, onSuccess }: { chantier: ChantierSummary; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof clotureSchema>>({
    resolver: zodResolver(clotureSchema),
    defaultValues: { tauxAmortissement: 5, dateAcquisition: new Date().toISOString().split("T")[0] },
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof clotureSchema>) => apiFetch(`/chantiers/${chantier.id}/cloture`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); qc.invalidateQueries({ queryKey: ["/api/actifs"] }); toast({ title: "Chantier clôturé — actif créé" }); setOpen(false); onSuccess(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm"><CheckCircle2 className="h-4 w-4 mr-2" />Clôturer le chantier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Clôturer le chantier</DialogTitle></DialogHeader>
        <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
          <p className="font-medium mb-1">Coût total réel : {formatFCFA(chantier.totalReel)}</p>
          <p className="text-muted-foreground">Ce montant sera enregistré comme valeur de l'actif dans le registre Actifs & Patrimoine.</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="dateAcquisition" render={({ field }) => (
              <FormItem><FormLabel>Date de clôture</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="tauxAmortissement" render={({ field }) => (
              <FormItem><FormLabel>Taux d'amortissement annuel (%)</FormLabel><FormControl><Input type="number" step="0.5" min={0} max={100} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" disabled={mutation.isPending} className="w-full">Confirmer la clôture</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DepenseGroupSection({
  category, label, items, isCollapsed, onToggle, isCloture, chantierId, lots, onDelete,
}: {
  category: string; label: string; items: DepenseItem[]; isCollapsed: boolean;
  onToggle: () => void; isCloture: boolean; chantierId: number; lots?: LotDetail[]; onDelete: (id: number) => void;
}) {
  const total = items.reduce((s, d) => s + d.prixTotal, 0);
  return (
    <>
      <TableRow className="bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors" onClick={onToggle}>
        <TableCell className="w-10 px-3">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
        <TableCell colSpan={2} className="font-semibold">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={categoryColors[category] || categoryColors.divers}>{label}</Badge>
            <span className="text-muted-foreground text-sm">({items.length} {items.length > 1 ? "lignes" : "ligne"})</span>
          </div>
        </TableCell>
        <TableCell className="text-right font-semibold text-sm text-muted-foreground">Sous-total</TableCell>
        <TableCell className="text-right font-semibold">{formatFCFA(total)}</TableCell>
        {!isCloture && <TableCell />}
      </TableRow>
      {!isCollapsed && items.map(d => (
        <TableRow key={d.id} className="hover:bg-muted/10">
          <TableCell />
          <TableCell>
            <div>
              <span className="font-medium">{d.designation}</span>
              {d.commentaire && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MessageSquare className="h-3 w-3" />{d.commentaire}
                </div>
              )}
              {d.date && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(d.date + "T00:00:00"), "dd/MM/yyyy", { locale: fr })}
                </div>
              )}
            </div>
          </TableCell>
          <TableCell className="text-right text-sm">{parseFloat(d.quantite)}</TableCell>
          <TableCell className="text-right text-sm">{formatFCFA(parseFloat(d.prixUnitaire))}</TableCell>
          <TableCell className="text-right font-medium">{formatFCFA(d.prixTotal)}</TableCell>
          {!isCloture && (
            <TableCell>
              <div className="flex justify-end gap-1">
                <DepenseFormDialog chantierId={chantierId} depense={d} lots={lots} onSuccess={() => {}} trigger={
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                } />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3 w-3" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle><AlertDialogDescription>{d.designation} — {formatFCFA(d.prixTotal)}</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(d.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  );
}

function GroupedDepensesTable({ items, isCloture, chantierId, lots, onDelete }: {
  items: DepenseItem[]; isCloture: boolean; chantierId: number; lots?: LotDetail[]; onDelete: (id: number) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? items.filter(d => d.designation.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  const grouped = CATEGORIES_CONSTRUCTION.reduce((acc, cat) => {
    const catItems = filtered.filter(d => (d.categorie || "materiaux") === cat.value);
    if (catItems.length > 0) acc[cat.value] = catItems;
    return acc;
  }, {} as Record<string, DepenseItem[]>);

  const grandTotal = filtered.reduce((s, d) => s + d.prixTotal, 0);
  const toggle = (cat: string) => setCollapsedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher une désignation..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10" />
              <TableHead>Désignation</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Prix unit.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {!isCloture && <TableHead className="text-right w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isCloture ? 5 : 6} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Aucun résultat pour cette recherche" : "Aucune dépense enregistrée"}
                </TableCell>
              </TableRow>
            ) : (
              CATEGORIES_CONSTRUCTION.map(cat => {
                const catItems = grouped[cat.value];
                if (!catItems) return null;
                return (
                  <DepenseGroupSection
                    key={cat.value}
                    category={cat.value}
                    label={cat.label}
                    items={catItems}
                    isCollapsed={!!collapsedGroups[cat.value]}
                    onToggle={() => toggle(cat.value)}
                    isCloture={isCloture}
                    chantierId={chantierId}
                    lots={lots}
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
                {!isCloture && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

function LotTabContent({ lot, chantier, isCloture, onDeleteDepense, onDeleteDevis }: {
  lot: LotDetail; chantier: ChantierDetail; isCloture: boolean;
  onDeleteDepense: (id: number) => void; onDeleteDevis: (id: number) => void;
}) {
  const ecart = lot.totalReel - lot.totalPrevu;
  const ecartPct = lot.totalPrevu > 0 ? (ecart / lot.totalPrevu) * 100 : 0;
  return (
    <div className="space-y-4">
      {lot.totalPrevu > 0 && (
        <div className="p-4 border rounded-lg bg-card space-y-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Budget prévu</div>
              <div className="font-bold">{formatFCFA(lot.totalPrevu)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Dépensé</div>
              <div className="font-bold">{formatFCFA(lot.totalReel)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Écart</div>
              <div className={`font-bold ${ecart > 0 ? "text-red-600" : ecart < 0 ? "text-green-600" : ""}`}>
                {ecart > 0 ? "+" : ""}{formatFCFA(ecart)}
              </div>
            </div>
          </div>
          <Progress value={lot.totalPrevu > 0 ? Math.min(100, (lot.totalReel / lot.totalPrevu) * 100) : 0} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{lot.totalPrevu > 0 ? Math.round((lot.totalReel / lot.totalPrevu) * 100) : 0}% du budget utilisé</span>
            <span className={ecart > 0 ? "text-red-600" : "text-green-600"}>
              Écart : {ecart > 0 ? "+" : ""}{ecartPct.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <Tabs defaultValue="depenses">
        <TabsList className="h-8">
          <TabsTrigger value="depenses" className="text-xs">Dépenses ({lot.depenses.length})</TabsTrigger>
          <TabsTrigger value="devis" className="text-xs">Budget ({lot.devisLignes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="depenses" className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">{lot.depenses.length} ligne(s) — {formatFCFA(lot.totalReel)}</span>
            {!isCloture && (
              <DepenseFormDialog chantierId={chantier.id} lots={chantier.lots} defaultLotId={lot.id} onSuccess={() => {}} trigger={
                <Button size="sm"><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
              } />
            )}
          </div>
          {lot.depenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/10">
              <Construction className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune dépense pour ce lot</p>
            </div>
          ) : (
            <GroupedDepensesTable items={lot.depenses} isCloture={isCloture} chantierId={chantier.id} lots={chantier.lots} onDelete={onDeleteDepense} />
          )}
        </TabsContent>

        <TabsContent value="devis" className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">{lot.devisLignes.length} poste(s) — {formatFCFA(lot.totalPrevu)}</span>
            {!isCloture && (
              <DevisLigneFormDialog chantierId={chantier.id} defaultLotId={lot.id} onSuccess={() => {}} trigger={
                <Button size="sm"><Plus className="h-3 w-3 mr-1" />Ajouter un poste</Button>
              } />
            )}
          </div>
          {lot.devisLignes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/10">
              <p className="text-sm">Aucun poste budgétaire pour ce lot</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Poste</TableHead>
                  <TableHead className="text-right">Montant prévu</TableHead>
                  {!isCloture && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lot.devisLignes.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.poste}</TableCell>
                    <TableCell className="text-right">{formatFCFA(parseFloat(l.montantPrevu))}</TableCell>
                    {!isCloture && (
                      <TableCell>
                        <div className="flex gap-1">
                          <DevisLigneFormDialog chantierId={chantier.id} ligne={l} onSuccess={() => {}} trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Supprimer ce poste ?</AlertDialogTitle><AlertDialogDescription>{l.poste}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteDevis(l.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow><TableCell className="font-bold">Total prévu</TableCell><TableCell className="text-right font-bold">{formatFCFA(lot.totalPrevu)}</TableCell>{!isCloture && <TableCell />}</TableRow>
              </TableFooter>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChantierDetail({ chantierId, onBack }: { chantierId: number; onBack: () => void }) {
  const { data: chantier, isLoading } = useChantier(chantierId);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [exportScope, setExportScope] = useState<string>("all");

  const deleteDepense = useMutation({
    mutationFn: (depId: number) => apiFetch(`/chantiers/${chantierId}/depenses/${depId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: "Dépense supprimée" }); },
  });
  const deleteDevisLigne = useMutation({
    mutationFn: (lgId: number) => apiFetch(`/chantiers/${chantierId}/devis/${lgId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: "Ligne supprimée" }); },
  });
  const deleteLot = useMutation({
    mutationFn: (lotId: number) => apiFetch(`/chantiers/${chantierId}/lots/${lotId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: "Lot supprimé" }); },
  });

  if (isLoading || !chantier) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;

  const isCloture = chantier.statut === "cloture";
  const totalPrevu = chantier.devisLignes.reduce((s, l) => s + parseFloat(l.montantPrevu), 0);
  const totalReel = chantier.depenses.reduce((s, d) => s + d.prixTotal, 0);
  const ecart = totalReel - totalPrevu;
  const ecartPct = totalPrevu > 0 ? (ecart / totalPrevu) * 100 : 0;
  const hasLots = chantier.lots.length > 0;

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{chantier.nom}</h2>
            <Badge variant="outline" className={isCloture ? "bg-green-100 text-green-800 border-green-200" : "bg-orange-100 text-orange-800 border-orange-200"}>
              {isCloture ? "Clôturé" : "En cours"}
            </Badge>
          </div>
          {chantier.description && <p className="text-sm text-muted-foreground mt-0.5">{chantier.description}</p>}
        </div>
        {(() => {
          const filteredDepenses = exportScope === "all"
            ? chantier.depenses
            : chantier.depenses.filter(d => String(d.lotId) === exportScope);
          const scopedTitle = exportScope === "all"
            ? chantier.nom
            : `${chantier.nom} - ${chantier.lots.find(l => String(l.id) === exportScope)?.nom || "Lot"}`;
          return (
            <>
              {hasLots && (
                <Select value={exportScope} onValueChange={setExportScope}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout le chantier</SelectItem>
                    {chantier.lots.map(l => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={filteredDepenses.length === 0}
                onClick={() => exportConstructionPDF(filteredDepenses, scopedTitle)}
              >
                <FileDown className="h-4 w-4" />PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={filteredDepenses.length === 0}
                onClick={() => exportConstructionExcel(filteredDepenses, scopedTitle)}
              >
                <FileSpreadsheet className="h-4 w-4" />Excel
              </Button>
            </>
          );
        })()}
        {!isCloture && <ClotureDialog chantier={chantier} onSuccess={onBack} />}
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Budget global prévu</div>
            <div className="text-lg font-bold">{formatFCFA(totalPrevu)}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Total dépensé</div>
            <div className="text-lg font-bold">{formatFCFA(totalReel)}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Écart global</div>
            <div className={`text-lg font-bold ${ecart > 0 ? "text-red-600" : ecart < 0 ? "text-green-600" : ""}`}>
              {ecart > 0 ? "+" : ""}{formatFCFA(ecart)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Avancement</div>
            <div className="text-lg font-bold">{totalPrevu > 0 ? Math.round((totalReel / totalPrevu) * 100) : 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets : Vue globale + un par lot */}
      <Tabs defaultValue={hasLots ? `lot-${chantier.lots[0].id}` : "global"}>
        <div className="flex items-center gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="global">Vue globale</TabsTrigger>
            {chantier.lots.map(lot => (
              <TabsTrigger key={lot.id} value={`lot-${lot.id}`}>{lot.nom}</TabsTrigger>
            ))}
          </TabsList>
          {!isCloture && (
            <LotFormDialog chantierId={chantierId} onSuccess={() => {}} trigger={
              <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" />Nouveau lot</Button>
            } />
          )}
        </div>

        {/* Vue globale */}
        <TabsContent value="global" className="mt-4">
          <Tabs defaultValue="depenses">
            <TabsList className="h-8">
              <TabsTrigger value="depenses" className="text-xs">Toutes les dépenses ({chantier.depenses.length})</TabsTrigger>
              <TabsTrigger value="devis" className="text-xs">Budget global ({chantier.devisLignes.length})</TabsTrigger>
              {totalPrevu > 0 && <TabsTrigger value="comparatif" className="text-xs">Comparatif</TabsTrigger>}
            </TabsList>

            <TabsContent value="depenses" className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">{chantier.depenses.length} dépense(s) — {formatFCFA(totalReel)}</span>
                {!isCloture && (
                  <DepenseFormDialog chantierId={chantierId} lots={chantier.lots} onSuccess={() => {}} trigger={
                    <Button size="sm"><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
                  } />
                )}
              </div>
              {chantier.depenses.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/10">
                  <Construction className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune dépense enregistrée</p>
                </div>
              ) : (
                <GroupedDepensesTable items={chantier.depenses} isCloture={isCloture} chantierId={chantierId} lots={chantier.lots} onDelete={id => deleteDepense.mutate(id)} />
              )}
            </TabsContent>

            <TabsContent value="devis" className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">{chantier.devisLignes.length} poste(s) — {formatFCFA(totalPrevu)}</span>
                {!isCloture && (
                  <DevisLigneFormDialog chantierId={chantierId} onSuccess={() => {}} trigger={
                    <Button size="sm"><Plus className="h-3 w-3 mr-1" />Ajouter un poste</Button>
                  } />
                )}
              </div>
              {chantier.devisLignes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/10">
                  <p className="text-sm">Aucun poste budgétaire défini</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Poste</TableHead>
                      {hasLots && <TableHead>Lot</TableHead>}
                      <TableHead className="text-right">Montant prévu</TableHead>
                      {!isCloture && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chantier.devisLignes.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.poste}</TableCell>
                        {hasLots && (
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {chantier.lots.find(lot => lot.id === l.lotId)?.nom || "—"}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right">{formatFCFA(parseFloat(l.montantPrevu))}</TableCell>
                        {!isCloture && (
                          <TableCell>
                            <div className="flex gap-1">
                              <DevisLigneFormDialog chantierId={chantierId} ligne={l} onSuccess={() => {}} trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>} />
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Supprimer ce poste ?</AlertDialogTitle><AlertDialogDescription>{l.poste}</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteDevisLigne.mutate(l.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow><TableCell colSpan={hasLots ? 2 : 1} className="font-bold">Total prévu</TableCell><TableCell className="text-right font-bold">{formatFCFA(totalPrevu)}</TableCell>{!isCloture && <TableCell />}</TableRow>
                  </TableFooter>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="comparatif" className="mt-3">
              <div className="space-y-3">
                {hasLots ? chantier.lots.map(lot => (
                  <div key={lot.id} className="p-3 border rounded-lg bg-muted/10">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold">{lot.nom}</span>
                      <div className="text-right text-xs text-muted-foreground">
                        <span>Prévu : {formatFCFA(lot.totalPrevu)}</span>
                        <span className="mx-2">·</span>
                        <span>Réel : {formatFCFA(lot.totalReel)}</span>
                      </div>
                    </div>
                    <Progress value={lot.totalPrevu > 0 ? Math.min(100, (lot.totalReel / lot.totalPrevu) * 100) : 0} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{lot.totalPrevu > 0 ? Math.round((lot.totalReel / lot.totalPrevu) * 100) : 0}%</span>
                      <span className={(lot.totalReel - lot.totalPrevu) > 0 ? "text-red-600" : "text-green-600"}>
                        Écart : {lot.totalReel - lot.totalPrevu > 0 ? "+" : ""}{formatFCFA(lot.totalReel - lot.totalPrevu)}
                      </span>
                    </div>
                  </div>
                )) : chantier.devisLignes.map(l => (
                  <div key={l.id} className="p-3 border rounded-lg bg-muted/10">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{l.poste}</span>
                      <span className="text-muted-foreground">Prévu : {formatFCFA(parseFloat(l.montantPrevu))}</span>
                    </div>
                  </div>
                ))}
                <div className="p-4 border rounded-lg bg-card">
                  <div className="flex justify-between mb-3">
                    <span className="font-semibold">Total général</span>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Prévu : {formatFCFA(totalPrevu)}</div>
                      <div className="font-bold">Réel : {formatFCFA(totalReel)}</div>
                    </div>
                  </div>
                  <Progress value={totalPrevu > 0 ? Math.min(100, (totalReel / totalPrevu) * 100) : 0} className="h-2 mb-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{totalPrevu > 0 ? Math.round((totalReel / totalPrevu) * 100) : 0}% utilisé</span>
                    <span className={ecart > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                      Écart : {ecart > 0 ? "+" : ""}{formatFCFA(ecart)} ({ecartPct > 0 ? "+" : ""}{ecartPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Onglet par lot */}
        {chantier.lots.map(lot => (
          <TabsContent key={lot.id} value={`lot-${lot.id}`} className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold">{lot.nom}</h3>
                {lot.description && <p className="text-xs text-muted-foreground">{lot.description}</p>}
              </div>
              {!isCloture && (
                <div className="flex gap-2">
                  <LotFormDialog chantierId={chantierId} lot={lot} onSuccess={() => {}} trigger={
                    <Button variant="outline" size="sm"><Pencil className="h-3 w-3 mr-1" />Modifier</Button>
                  } />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50"><Trash2 className="h-3 w-3 mr-1" />Supprimer</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Supprimer ce lot ?</AlertDialogTitle><AlertDialogDescription>Les dépenses associées ne seront pas supprimées, elles perdront simplement leur affectation.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteLot.mutate(lot.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
            <LotTabContent
              lot={lot}
              chantier={chantier}
              isCloture={isCloture}
              onDeleteDepense={id => deleteDepense.mutate(id)}
              onDeleteDevis={id => deleteDevisLigne.mutate(id)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ActifFormDialog({ actif, onSuccess, trigger }: { actif?: Actif; onSuccess: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!actif;
  const form = useForm<z.infer<typeof actifSchema>>({
    resolver: zodResolver(actifSchema),
    defaultValues: actif
      ? { nom: actif.nom, type: actif.type, valeur: actif.valeur, tauxAmortissementAnnuel: actif.tauxAmortissementAnnuel, dateAcquisition: actif.dateAcquisition, description: actif.description || "" }
      : { nom: "", type: "batiment", valeur: 0, tauxAmortissementAnnuel: 5, dateAcquisition: new Date().toISOString().split("T")[0], description: "" },
  });
  const typeWatch = form.watch("type");
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof actifSchema>) => isEdit
      ? apiFetch(`/actifs/${actif!.id}`, { method: "PUT", body: JSON.stringify(data) })
      : apiFetch(`/actifs`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/actifs"] }); toast({ title: isEdit ? "Actif mis à jour" : "Actif créé" }); setOpen(false); if (!isEdit) form.reset(); onSuccess(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Modifier l'actif" : "Ajouter un actif"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="nom" render={({ field }) => (
              <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Ex : Terrain principal" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem><FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{TYPE_ACTIF.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="valeur" render={({ field }) => (
              <FormItem><FormLabel>Valeur d'acquisition (FCFA)</FormLabel><FormControl><Input type="number" step="1000" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {typeWatch !== "terrain" && (
              <FormField control={form.control} name="tauxAmortissementAnnuel" render={({ field }) => (
                <FormItem><FormLabel>Taux d'amortissement annuel (%)</FormLabel><FormControl><Input type="number" step="0.5" min={0} max={100} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="dateAcquisition" render={({ field }) => (
              <FormItem><FormLabel>Date d'acquisition</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description (optionnel)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={mutation.isPending} className="w-full">{isEdit ? "Mettre à jour" : "Ajouter l'actif"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ChantiersTab() {
  const { data: chantiers = [], isLoading } = useChantiers();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const deleteChantier = useMutation({
    mutationFn: (id: number) => apiFetch(`/chantiers/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/chantiers"] }); toast({ title: "Chantier supprimé" }); },
  });

  if (selectedId !== null) return <ChantierDetail chantierId={selectedId} onBack={() => setSelectedId(null)} />;

  const enCours = chantiers.filter(c => c.statut === "en_cours");
  const clotures = chantiers.filter(c => c.statut === "cloture");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Chantiers de construction</h3>
          <p className="text-sm text-muted-foreground">{enCours.length} en cours · {clotures.length} clôturé(s)</p>
        </div>
        <ChantierFormDialog onSuccess={() => {}} trigger={<Button><Plus className="h-4 w-4 mr-2" />Nouveau chantier</Button>} />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Chargement...</div>
      ) : chantiers.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/10">
          <Construction className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Aucun chantier</p>
          <p className="text-sm text-muted-foreground mt-1">Créez un nouveau chantier pour commencer le suivi</p>
          <ChantierFormDialog onSuccess={() => {}} trigger={<Button className="mt-4"><Plus className="h-4 w-4 mr-2" />Créer un chantier</Button>} />
        </div>
      ) : (
        <div className="space-y-4">
          {enCours.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-muted-foreground">En cours</span>
              </div>
              <div className="space-y-2">
                {enCours.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group" onClick={() => setSelectedId(c.id)}>
                    <Construction className="h-5 w-5 text-orange-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{c.nom}</div>
                      {c.description && <div className="text-xs text-muted-foreground truncate">{c.description}</div>}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.nbDepenses} dépense(s) · Réel : {formatFCFA(c.totalReel)}{c.totalPrevu > 0 ? ` · Budget : ${formatFCFA(c.totalPrevu)}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {clotures.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">Clôturés</span>
              </div>
              <div className="space-y-2">
                {clotures.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group opacity-75" onClick={() => setSelectedId(c.id)}>
                    <Lock className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{c.nom}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Coût final : {formatFCFA(c.totalReel)} · Clôturé le {c.dateCloture ? format(new Date(c.dateCloture + "T00:00:00"), "dd/MM/yyyy") : "—"}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActifsTab() {
  const { data: actifs = [], isLoading } = useActifs();
  const { toast } = useToast();
  const qc = useQueryClient();
  const deleteActif = useMutation({
    mutationFn: (id: number) => apiFetch(`/actifs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/actifs"] }); toast({ title: "Actif supprimé" }); },
  });

  const totalValeur = actifs.reduce((s, a) => s + a.valeur, 0);
  const byType = TYPE_ACTIF.map(t => ({ ...t, actifs: actifs.filter(a => a.type === t.value), total: actifs.filter(a => a.type === t.value).reduce((s, a) => s + a.valeur, 0) }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Actifs & Patrimoine</h3>
          <p className="text-sm text-muted-foreground">Valeur totale : {formatFCFA(totalValeur)}</p>
        </div>
        <ActifFormDialog onSuccess={() => {}} trigger={<Button><Plus className="h-4 w-4 mr-2" />Ajouter un actif</Button>} />
      </div>

      {totalValeur > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {byType.map(t => (
            <Card key={t.value} className="border-0 bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t.label}s</span>
                </div>
                <div className="font-bold">{formatFCFA(t.total)}</div>
                <div className="text-xs text-muted-foreground">{t.actifs.length} actif(s)</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Chargement...</div>
      ) : actifs.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/10">
          <Package2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Aucun actif enregistré</p>
          <p className="text-sm text-muted-foreground mt-1">Ajoutez vos terrains, bâtiments et matériels</p>
          <ActifFormDialog onSuccess={() => {}} trigger={<Button className="mt-4"><Plus className="h-4 w-4 mr-2" />Ajouter un actif</Button>} />
        </div>
      ) : (
        <div className="space-y-4">
          {byType.filter(t => t.actifs.length > 0).map(t => (
            <div key={t.value}>
              <div className="flex items-center gap-2 mb-2">
                <t.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{t.label}s</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Nom</TableHead>
                    <TableHead>Date acquisition</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead className="text-right">Taux annuel</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {t.actifs.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.nom}</div>
                        {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                        {a.chantierId && <Badge variant="outline" className="text-xs mt-0.5">Issu d'un chantier</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(a.dateAcquisition + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(a.valeur)}</TableCell>
                      <TableCell className="text-right text-sm">{a.type === "terrain" ? "—" : `${a.tauxAmortissementAnnuel}%`}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <ActifFormDialog actif={a} onSuccess={() => {}} trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Supprimer cet actif ?</AlertDialogTitle><AlertDialogDescription>{a.nom} — {formatFCFA(a.valeur)}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteActif.mutate(a.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Infrastructure() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Infrastructure</h1>
        <p className="text-muted-foreground text-sm mt-1">Suivi des chantiers, budget prévu vs réel, et registre du patrimoine de l'exploitation</p>
      </div>
      <Tabs defaultValue="chantiers">
        <TabsList>
          <TabsTrigger value="chantiers"><Construction className="h-4 w-4 mr-2" />Chantiers</TabsTrigger>
          <TabsTrigger value="actifs"><Package2 className="h-4 w-4 mr-2" />Actifs & Patrimoine</TabsTrigger>
        </TabsList>
        <TabsContent value="chantiers" className="mt-6"><ChantiersTab /></TabsContent>
        <TabsContent value="actifs" className="mt-6"><ActifsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
