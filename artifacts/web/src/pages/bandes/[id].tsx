import { useState, useEffect, Fragment, useMemo } from "react";
import { useParams } from "wouter";
import { 
  useGetBande,
  useListBandeDepenses,
  useCreateBandeDepense,
  useUpdateBandeDepense,
  useDeleteBandeDepense,
  useListBandeVentes,
  useCreateBandeVente,
  useUpdateBandeVente,
  useDeleteBandeVente,
  useGetBandeChargesFixe,
  useUpdateBandeChargesFixe,
  useListBandeDepensesVente,
  useCreateBandeDepenseVente,
  useUpdateBandeDepenseVente,
  useDeleteBandeDepenseVente,
  useGetBandeConsommation,
  useCreateBandeConsommation,
  useDeleteBandeConsommation,
  useUpdateBandeVaccination,
  useUpdateBande,
  useGetMe,
  getGetBandeQueryKey,
  getListBandeDepensesQueryKey,
  getListBandeVentesQueryKey,
  getGetBandeChargesFixeQueryKey,
  getListBandeDepensesVenteQueryKey,
  getGetBandeMortaliteQueryKey,
  getGetBandePeseesQueryKey,
  getGetBandeConsommationQueryKey,
  getGetBandeVaccinationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, PageHeaderContent } from "@/components/ui/responsive-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ArrowLeft, Receipt, ShoppingCart, Info, CheckSquare, Skull, Scale, Wheat, Syringe, Check, Download, Droplets, Pill, BookOpen, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Link } from "wouter";
import { BandeDetail } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area } from "recharts";
import { CreateBandeDepenseBodyCategorie } from "@workspace/api-client-react";
import { exportBandePDF, exportBandeExcel } from "@/lib/export";
import { useBandeMortaliteOffline, useCreateBandeMortaliteOffline, useDeleteBandeMortaliteOffline, useBandePeseesOffline, useCreateBandePeseeOffline, useDeleteBandePeseeOffline, useBandeVaccinationsOffline, useCreateBandeVaccinationOffline, useDeleteBandeVaccinationOffline, useConsommationEau, useCreateConsommationEau, useDeleteConsommationEau, useTraitements, useCreateTraitement, useDeleteTraitement, useObservations, useCreateObservation, useDeleteObservation, useReferencePoids } from "@/lib/bande-extras-api";
import ScanFiche from "@/components/scan-fiche";
import DesignationCombobox from "@/components/designation-combobox";

const PHASES = [
  { nom: "Demarrage", label: "Démarrage", min: 1, max: 15, color: "#3b82f6" },
  { nom: "Croissance", label: "Croissance", min: 16, max: 28, color: "#22c55e" },
  { nom: "Finition", label: "Finition", min: 29, max: 45, color: "#f59e0b" },
  { nom: "Reforme", label: "Réformé", min: 46, max: 999, color: "#8b5cf6" },
];

function getPhase(ageJours: number) {
  return PHASES.find(p => ageJours >= p.min && ageJours <= p.max) || PHASES[3];
}

const depenseSchema = z.object({
  designation: z.string().min(1, "La désignation est requise"),
  categorie: z.nativeEnum(CreateBandeDepenseBodyCategorie),
  quantite: z.coerce.number().min(0, "La quantité doit être positive"),
  prixUnitaire: z.coerce.number().min(0, "Le prix unitaire doit être positif"),
});

const venteSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  quantiteVendue: z.coerce.number().min(1, "La quantité doit être supérieure à 0"),
  prixUnitaire: z.coerce.number().min(0, "Le prix unitaire doit être positif"),
});

const depenseVenteSchema = z.object({
  designation: z.string().min(1, "La désignation est requise"),
  montant: z.coerce.number().min(0, "Le montant doit être positif"),
});

const chargesFixesSchema = z.object({
  loyer: z.coerce.number().min(0, "Le loyer doit être positif"),
});

const mortaliteSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  ageJours: z.coerce.number().min(1, "L'âge est requis"),
  decesJour: z.coerce.number().min(0, "Le nombre de décès est requis"),
});

const peseeSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  ageJours: z.coerce.number().min(1, "L'âge est requis"),
  poidsMoyenG: z.coerce.number().min(0, "Le poids est requis"),
  objectifPoidsG: z.coerce.number().optional(),
});

const consommationSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  quantiteKg: z.coerce.number().min(0, "La quantité est requise"),
});

const vaccinSchema = z.object({
  jourPrevu: z.coerce.number().min(0, "Le jour est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
});

const eauSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  ageJours: z.coerce.number().min(1, "L'âge est requis"),
  quantiteLitres: z.coerce.number().min(0, "La quantité est requise"),
});

const traitementSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  ageJours: z.coerce.number().min(1, "L'âge est requis"),
  produit: z.string().min(1, "Le produit est requis"),
  type: z.string().default("traitement"),
  dosage: z.string().optional(),
  observations: z.string().optional(),
});

const observationSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  ageJours: z.coerce.number().min(1, "L'âge est requis"),
  contenu: z.string().min(1, "Le contenu est requis"),
});

const PROD_CAT_LABELS: Record<string, string> = {
  poussins: "Poussins", aliments: "Aliments", concentre: "Concentré",
  prophylaxie: "Prophylaxie", medicaments: "Prophylaxie", veterinaire: "Prophylaxie",
  carburant: "Carburant", salaires: "Salaires", transport: "Transport",
  main_oeuvre: "Main-d'œuvre", autre: "Autre",
};
const PROD_CAT_ORDER = ["poussins", "aliments", "concentre", "prophylaxie", "carburant", "salaires", "transport", "main_oeuvre", "autre"];
const PROD_CAT_COLORS: Record<string, string> = {
  poussins: "bg-yellow-100 text-yellow-800 border-yellow-200",
  aliments: "bg-green-100 text-green-800 border-green-200",
  concentre: "bg-lime-100 text-lime-800 border-lime-200",
  prophylaxie: "bg-blue-100 text-blue-800 border-blue-200",
  medicaments: "bg-blue-100 text-blue-800 border-blue-200",
  veterinaire: "bg-blue-100 text-blue-800 border-blue-200",
  carburant: "bg-red-100 text-red-800 border-red-200",
  salaires: "bg-purple-100 text-purple-800 border-purple-200",
  transport: "bg-orange-100 text-orange-800 border-orange-200",
  main_oeuvre: "bg-indigo-100 text-indigo-800 border-indigo-200",
  autre: "bg-gray-100 text-gray-800 border-gray-200",
};

function DepensesGroupedTable({
  items,
  isReadOnly,
  onEdit,
  onDelete,
}: {
  items: Array<{ id: number; designation: string; categorie: string; quantite: number; prixUnitaire: number; montant: number }>;
  isReadOnly: boolean;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.designation.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    for (const item of filtered) {
      const cat = item.categorie || "autre";
      if (!g[cat]) g[cat] = [];
      g[cat].push(item);
    }
    return g;
  }, [filtered]);

  const sortedCats = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      const ai = PROD_CAT_ORDER.indexOf(a); const bi = PROD_CAT_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }), [grouped]);

  const filteredTotal = filtered.reduce((s, i) => s + (i.montant || 0), 0);
  const colCount = isReadOnly ? 5 : 6;

  return (
    <div className="space-y-0">
      <div className="flex flex-col gap-3 border-b px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:px-6">
        <div className="relative w-full flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Rechercher une désignation..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="text-left text-xs text-muted-foreground hover:text-foreground sm:text-center" onClick={() => setSearch("")}>Effacer</button>
        )}
      </div>
      <div className="overflow-hidden">
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
                <TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground">
                  {search ? "Aucun résultat pour cette recherche" : "Aucune dépense enregistrée"}
                </TableCell>
              </TableRow>
            ) : (
              sortedCats.map(cat => {
                const catItems = grouped[cat]!;
                const subtotal = catItems.reduce((s, i) => s + (i.montant || 0), 0);
                const isCollapsed = collapsed[cat];
                const label = PROD_CAT_LABELS[cat] || cat.replace('_', ' ');
                const badgeColor = PROD_CAT_COLORS[cat] || PROD_CAT_COLORS.autre;
                return (
                  <Fragment key={cat}>
                    <TableRow
                      className="bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    >
                      <TableCell className="w-10 px-3">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell colSpan={2} className="font-semibold">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${badgeColor}`}>{label}</span>
                          <span className="text-muted-foreground text-sm font-normal">
                            ({catItems.length} {catItems.length > 1 ? "lignes" : "ligne"})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground font-medium">Sous-total</TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(subtotal)}</TableCell>
                      {!isReadOnly && <TableCell></TableCell>}
                    </TableRow>
                    {!isCollapsed && catItems.map(item => (
                      <TableRow key={item.id} className="hover:bg-muted/10">
                        <TableCell></TableCell>
                        <TableCell className="font-medium text-sm">{item.designation}</TableCell>
                        <TableCell className="text-right text-sm">{item.quantite}</TableCell>
                        <TableCell className="text-right text-sm">{formatFCFA(item.prixUnitaire)}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatFCFA(item.montant)}</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); onEdit(item); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); onDelete(item.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow className="bg-primary/5">
                <TableCell colSpan={4} className="font-bold">Total Dépenses</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatFCFA(filteredTotal)}</TableCell>
                {!isReadOnly && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

function VentesGroupedTable({
  items,
  isReadOnly,
  onEdit,
  onDelete,
}: {
  items: Array<{ id: number; date: string; quantiteVendue: number; prixUnitaire: number; montant: number }>;
  isReadOnly: boolean;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sorted = useMemo(() =>
    [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [items]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(i =>
      format(new Date(i.date), "dd/MM/yyyy").includes(q) ||
      format(new Date(i.date), "EEEE d MMMM yyyy", { locale: fr }).toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    for (const item of filtered) {
      const key = item.date.slice(0, 10);
      if (!g[key]) g[key] = [];
      g[key].push(item);
    }
    return g;
  }, [filtered]);

  const sortedDates = useMemo(() =>
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  const filteredTotal = filtered.reduce((s, i) => s + (i.montant || 0), 0);
  const colCount = isReadOnly ? 4 : 5;

  return (
    <div className="space-y-0">
      <div className="flex flex-col gap-3 border-b px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:px-6">
        <div className="relative w-full flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Rechercher par date..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="text-left text-xs text-muted-foreground hover:text-foreground sm:text-center" onClick={() => setSearch("")}>Effacer</button>
        )}
      </div>
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10"></TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              {!isReadOnly && <TableHead className="text-right w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground">
                  {search ? "Aucun résultat pour cette recherche" : "Aucune vente enregistrée"}
                </TableCell>
              </TableRow>
            ) : (
              sortedDates.map(dateKey => {
                const dayItems = grouped[dateKey]!;
                const subtotal = dayItems.reduce((s, i) => s + (i.montant || 0), 0);
                const totalQty = dayItems.reduce((s, i) => s + (i.quantiteVendue || 0), 0);
                const isCollapsed = collapsed[dateKey];
                const dateLabel = format(new Date(dateKey), "EEEE d MMMM yyyy", { locale: fr });
                const dateCourt = format(new Date(dateKey), "dd/MM/yyyy");
                return (
                  <Fragment key={dateKey}>
                    <TableRow
                      className="bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setCollapsed(prev => ({ ...prev, [dateKey]: !prev[dateKey] }))}
                    >
                      <TableCell className="w-10 px-3">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell colSpan={2} className="font-semibold">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium bg-emerald-100 text-emerald-800 border-emerald-200 capitalize">{dateLabel}</span>
                          <span className="text-muted-foreground text-sm font-normal">
                            ({dayItems.length} {dayItems.length > 1 ? "transactions" : "transaction"} — {totalQty} sujets)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground font-medium">Sous-total</span>
                          <span className="font-semibold">{formatFCFA(subtotal)}</span>
                        </div>
                      </TableCell>
                      {!isReadOnly && <TableCell></TableCell>}
                    </TableRow>
                    {!isCollapsed && dayItems.map(item => (
                      <TableRow key={item.id} className="hover:bg-muted/10">
                        <TableCell></TableCell>
                        <TableCell className="text-right text-sm">{item.quantiteVendue} sujets</TableCell>
                        <TableCell className="text-right text-sm">{formatFCFA(item.prixUnitaire)} / sujet</TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatFCFA(item.montant)}</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); onEdit(item); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); onDelete(item.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow className="bg-primary/5">
                <TableCell colSpan={3} className="font-bold">Total Recettes</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatFCFA(filteredTotal)}</TableCell>
                {!isReadOnly && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

type BandeActifAllocation = {
  id: number;
  actifId: number;
  bandeId: number;
  fractionUtilisee: number;
  amortissement: number;
  actif: { id: number; nom: string; type: string; valeur: number; tauxAmortissementAnnuel: number; dateAcquisition: string };
};

function BandeChargesFixesPanel({ bandeId, isReadOnly, chargesFixes, detail }: {
  bandeId: number;
  isReadOnly: boolean;
  chargesFixes: any;
  detail: any;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addingActif, setAddingActif] = useState(false);
  const [selectedActifId, setSelectedActifId] = useState<string>("");
  const [fraction, setFraction] = useState<string>("100");

  const { data: allocations = [] } = useQuery<BandeActifAllocation[]>({
    queryKey: ["/api/bandes", bandeId, "actifs"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}api/bandes/${bandeId}/actifs`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const { data: actifsDisponibles = [] } = useQuery<any[]>({
    queryKey: ["/api/actifs"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}api/actifs`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const addAllocation = useMutation({
    mutationFn: async ({ actifId, fractionUtilisee }: { actifId: number; fractionUtilisee: number }) => {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}api/bandes/${bandeId}/actifs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actifId, fractionUtilisee }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bandes", bandeId, "actifs"] }); toast({ title: "Actif ajouté" }); setAddingActif(false); setSelectedActifId(""); setFraction("100"); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const removeAllocation = useMutation({
    mutationFn: async (allocationId: number) => {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}api/bandes/${bandeId}/actifs/${allocationId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bandes", bandeId, "actifs"] }); toast({ title: "Actif retiré" }); },
  });

  const updateAllocation = useMutation({
    mutationFn: async ({ id, fractionUtilisee }: { id: number; fractionUtilisee: number }) => {
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}api/bandes/${bandeId}/actifs/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fractionUtilisee }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bandes", bandeId, "actifs"] }); toast({ title: "Fraction mise à jour" }); },
  });

  const totalAmortissementActifs = allocations.reduce((s: number, a: BandeActifAllocation) => s + a.amortissement, 0);
  const loyerLegacy = chargesFixes?.loyer || 0;
  const imprevus = chargesFixes?.imprévus || 0;
  const totalCharges = totalAmortissementActifs + loyerLegacy + imprevus;

  const actifsDejaAlloues = new Set(allocations.map((a: BandeActifAllocation) => a.actifId));
  const actifsDispo = actifsDisponibles.filter((a: any) => !actifsDejaAlloues.has(a.id));

  const typeLabel: Record<string, string> = { terrain: "Terrain", batiment: "Bâtiment", materiel: "Matériel" };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Actifs utilisés pour cette bande</CardTitle>
            {!isReadOnly && !addingActif && actifsDispo.length > 0 && (
              <Button size="sm" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => setAddingActif(true)}>
                <Plus className="h-4 w-4 shrink-0" />Associer un actif
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Sélectionnez les actifs (bâtiments, matériel) utilisés par cette bande et indiquez la fraction allouée. L'amortissement est calculé automatiquement.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {addingActif && (
            <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
              <div className="font-medium text-sm">Ajouter un actif</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Actif</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={selectedActifId}
                    onChange={e => setSelectedActifId(e.target.value)}
                  >
                    <option value="">Choisir un actif...</option>
                    {actifsDispo.map((a: any) => (
                      <option key={a.id} value={String(a.id)}>{a.nom} ({typeLabel[a.type] || a.type}) — {formatFCFA(a.valeur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fraction utilisée (%)</label>
                  <Input type="number" min={1} max={100} step={1} value={fraction} onChange={e => setFraction(e.target.value)} />
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button size="sm" className="w-full sm:w-auto" disabled={!selectedActifId || addAllocation.isPending} onClick={() => addAllocation.mutate({ actifId: parseInt(selectedActifId), fractionUtilisee: parseFloat(fraction) / 100 })}>Confirmer</Button>
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setAddingActif(false)}>Annuler</Button>
              </div>
            </div>
          )}
          {allocations.length === 0 && !addingActif ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>Aucun actif associé à cette bande</p>
              {!isReadOnly && actifsDisponibles.length === 0 && (
                <p className="text-xs mt-1">Ajoutez d'abord des actifs dans le module Infrastructure</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {allocations.map((a: BandeActifAllocation) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{a.actif.nom}</div>
                    <div className="text-xs text-muted-foreground">
                      {typeLabel[a.actif.type] || a.actif.type} · {formatFCFA(a.actif.valeur)} · Taux : {a.actif.tauxAmortissementAnnuel}%/an
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-semibold">{formatFCFA(a.amortissement)}</div>
                    <div className="text-xs text-muted-foreground">{Math.round(a.fractionUtilisee * 100)}% utilisé</div>
                  </div>
                  {!isReadOnly && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeAllocation.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {allocations.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t font-semibold">
              <span>Total amortissement actifs</span>
              <span>{formatFCFA(totalAmortissementActifs)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader><CardTitle className="text-lg">Récapitulatif charges fixes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Amortissement actifs</span>
            <span className="font-medium">{formatFCFA(totalAmortissementActifs)}</span>
          </div>
          {loyerLegacy > 0 && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Autres charges fixes (loyer hérité)</span>
              <span className="font-medium">{formatFCFA(loyerLegacy)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Imprévus (5% des dépenses)</span>
            <span className="font-medium">{formatFCFA(imprevus)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 font-bold text-base">
            <span>Total Charges Fixes</span>
            <span className="text-destructive">{formatFCFA(chargesFixes?.total || 0)}</span>
          </div>
          {totalAmortissementActifs > 0 && (
            <p className="text-xs text-muted-foreground italic pt-1">
              Note : Le total affiché dans le récapitulatif vient du calcul du serveur (basé sur loyer + matériel). L'amortissement actifs sera intégré dans un prochain calcul unifié.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BandeDetailView() {
  const params = useParams<{ id: string }>();
  const bandeId = Number(params.id);

  const { data: user } = useGetMe();
  const { data: bande, isLoading: isLoadingBande } = useGetBande(bandeId, {
    query: { enabled: !!bandeId, queryKey: getGetBandeQueryKey(bandeId) }
  });
  
  const { data: depenses } = useListBandeDepenses(bandeId);
  const { data: ventes } = useListBandeVentes(bandeId);
  const { data: chargesFixes } = useGetBandeChargesFixe(bandeId);
  const { data: depensesVente } = useListBandeDepensesVente(bandeId);
  const { data: mortaliteData } = useBandeMortaliteOffline(bandeId);
  const { data: peseesData } = useBandePeseesOffline(bandeId);
  const { data: consommationData } = useGetBandeConsommation(bandeId);
  const { data: vaccinationsData } = useBandeVaccinationsOffline(bandeId);
  const { data: eauData } = useConsommationEau(bandeId);
  const { data: traitementsData } = useTraitements(bandeId);
  const { data: observationsData } = useObservations(bandeId);
  const { data: referencePoids } = useReferencePoids();

  const createDepense = useCreateBandeDepense();
  const updateDepense = useUpdateBandeDepense();
  const deleteDepense = useDeleteBandeDepense();
  const createVente = useCreateBandeVente();
  const updateVente = useUpdateBandeVente();
  const deleteVente = useDeleteBandeVente();
  const updateChargesFixes = useUpdateBandeChargesFixe();
  const updateBande = useUpdateBande();
  const createDepenseVente = useCreateBandeDepenseVente();
  const updateDepenseVente = useUpdateBandeDepenseVente();
  const deleteDepenseVente = useDeleteBandeDepenseVente();
  const createMortalite = useCreateBandeMortaliteOffline();
  const deleteMortalite = useDeleteBandeMortaliteOffline();
  const createPesee = useCreateBandePeseeOffline();
  const deletePesee = useDeleteBandePeseeOffline();
  const createConsommation = useCreateBandeConsommation();
  const deleteConsommation = useDeleteBandeConsommation();
  const createVaccination = useCreateBandeVaccinationOffline();
  const deleteVaccination = useDeleteBandeVaccinationOffline();
  const updateVaccination = useUpdateBandeVaccination();
  const createEau = useCreateConsommationEau(bandeId);
  const deleteEau = useDeleteConsommationEau(bandeId);
  const createTraitement = useCreateTraitement(bandeId);
  const deleteTraitement = useDeleteTraitement(bandeId);
  const createObservation = useCreateObservation(bandeId);
  const deleteObservation = useDeleteObservation(bandeId);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("resume");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogType, setDialogType] = useState<string>("");
  const [designationSuggestions, setDesignationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || "/";
    fetch(`${base}api/bandes/designations-suggestions`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setDesignationSuggestions(data); })
      .catch(() => {});
  }, []);

  const isReadOnly = user?.role === "investisseur" || user?.role === "lecteur";

  const depenseForm = useForm<z.infer<typeof depenseSchema>>({
    resolver: zodResolver(depenseSchema),
    defaultValues: { designation: "", categorie: CreateBandeDepenseBodyCategorie.aliments, quantite: 1, prixUnitaire: 0 },
  });
  const venteForm = useForm<z.infer<typeof venteSchema>>({
    resolver: zodResolver(venteSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], quantiteVendue: 1, prixUnitaire: 0 },
  });
  const depenseVenteForm = useForm<z.infer<typeof depenseVenteSchema>>({
    resolver: zodResolver(depenseVenteSchema),
    defaultValues: { designation: "", montant: 0 },
  });
  const chargesFixesForm = useForm<z.infer<typeof chargesFixesSchema>>({
    resolver: zodResolver(chargesFixesSchema),
    defaultValues: { loyer: 0 },
  });
  const mortaliteForm = useForm<z.infer<typeof mortaliteSchema>>({
    resolver: zodResolver(mortaliteSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], ageJours: 1, decesJour: 0 },
  });
  const peseeForm = useForm<z.infer<typeof peseeSchema>>({
    resolver: zodResolver(peseeSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], ageJours: 1, poidsMoyenG: 0 },
  });
  const consommationForm = useForm<z.infer<typeof consommationSchema>>({
    resolver: zodResolver(consommationSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], quantiteKg: 0 },
  });
  const vaccinForm = useForm<z.infer<typeof vaccinSchema>>({
    resolver: zodResolver(vaccinSchema),
    defaultValues: { jourPrevu: 1, nom: "", description: "" },
  });
  const eauForm = useForm<z.infer<typeof eauSchema>>({
    resolver: zodResolver(eauSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], ageJours: 1, quantiteLitres: 0 },
  });
  const traitementForm = useForm<z.infer<typeof traitementSchema>>({
    resolver: zodResolver(traitementSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], ageJours: 1, produit: "", type: "traitement", dosage: "", observations: "" },
  });
  const observationForm = useForm<z.infer<typeof observationSchema>>({
    resolver: zodResolver(observationSchema),
    defaultValues: { date: new Date().toISOString().split("T")[0], ageJours: 1, contenu: "" },
  });

  const [loyerInitialized, setLoyerInitialized] = useState(false);
  if (chargesFixes && !loyerInitialized) {
    chargesFixesForm.reset({ loyer: chargesFixes.loyer });
    setLoyerInitialized(true);
  }

  const resetForms = () => {
    depenseForm.reset({ designation: "", categorie: CreateBandeDepenseBodyCategorie.aliments, quantite: 1, prixUnitaire: 0 });
    venteForm.reset({ date: new Date().toISOString().split("T")[0], quantiteVendue: 1, prixUnitaire: 0 });
    depenseVenteForm.reset({ designation: "", montant: 0 });
    mortaliteForm.reset({ date: new Date().toISOString().split("T")[0], ageJours: 1, decesJour: 0 });
    peseeForm.reset({ date: new Date().toISOString().split("T")[0], ageJours: 1, poidsMoyenG: 0 });
    consommationForm.reset({ date: new Date().toISOString().split("T")[0], quantiteKg: 0 });
    vaccinForm.reset({ jourPrevu: 1, nom: "", description: "" });
    eauForm.reset({ date: new Date().toISOString().split("T")[0], ageJours: 1, quantiteLitres: 0 });
    traitementForm.reset({ date: new Date().toISOString().split("T")[0], ageJours: 1, produit: "", type: "traitement", dosage: "", observations: "" });
    observationForm.reset({ date: new Date().toISOString().split("T")[0], ageJours: 1, contenu: "" });
    setEditingId(null);
    setDialogType("");
  };

  const invalidateBandeData = () => {
    queryClient.invalidateQueries({ queryKey: getGetBandeQueryKey(bandeId) });
  };

  const onDepenseSubmit = async (values: z.infer<typeof depenseSchema>) => {
    try {
      if (editingId) await updateDepense.mutateAsync({ id: bandeId, depenseId: editingId, data: values as any });
      else await createDepense.mutateAsync({ id: bandeId, data: values as any });
      queryClient.invalidateQueries({ queryKey: getListBandeDepensesQueryKey(bandeId) });
      invalidateBandeData();
      toast({ title: "Dépense enregistrée" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onVenteSubmit = async (values: z.infer<typeof venteSchema>) => {
    try {
      if (editingId) await updateVente.mutateAsync({ id: bandeId, venteId: editingId, data: values as any });
      else await createVente.mutateAsync({ id: bandeId, data: values as any });
      queryClient.invalidateQueries({ queryKey: getListBandeVentesQueryKey(bandeId) });
      invalidateBandeData();
      toast({ title: "Vente enregistrée" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onDepenseVenteSubmit = async (values: z.infer<typeof depenseVenteSchema>) => {
    try {
      if (editingId) await updateDepenseVente.mutateAsync({ id: bandeId, depenseId: editingId, data: values as any });
      else await createDepenseVente.mutateAsync({ id: bandeId, data: values as any });
      queryClient.invalidateQueries({ queryKey: getListBandeDepensesVenteQueryKey(bandeId) });
      invalidateBandeData();
      toast({ title: "Frais de vente enregistré" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onChargesFixesSubmit = async (values: z.infer<typeof chargesFixesSchema>) => {
    try {
      await updateChargesFixes.mutateAsync({ id: bandeId, data: values });
      queryClient.invalidateQueries({ queryKey: getGetBandeChargesFixeQueryKey(bandeId) });
      invalidateBandeData();
      setLoyerInitialized(false);
      toast({ title: "Charges fixes mises à jour" });
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onMortaliteSubmit = async (values: z.infer<typeof mortaliteSchema>) => {
    try {
      const result = await createMortalite.mutateAsync({ id: bandeId, data: values });
      if (!(result as any)._pendingSync) {
        queryClient.invalidateQueries({ queryKey: getGetBandeMortaliteQueryKey(bandeId) });
        invalidateBandeData();
      }
      toast({ title: "Mortalité enregistrée" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onPeseeSubmit = async (values: z.infer<typeof peseeSchema>) => {
    try {
      const result = await createPesee.mutateAsync({ id: bandeId, data: values });
      if (!(result as any)._pendingSync) {
        queryClient.invalidateQueries({ queryKey: getGetBandePeseesQueryKey(bandeId) });
      }
      toast({ title: "Pesée enregistrée" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onConsommationSubmit = async (values: z.infer<typeof consommationSchema>) => {
    try {
      await createConsommation.mutateAsync({ id: bandeId, data: values });
      queryClient.invalidateQueries({ queryKey: getGetBandeConsommationQueryKey(bandeId) });
      toast({ title: "Consommation enregistrée" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onVaccinSubmit = async (values: z.infer<typeof vaccinSchema>) => {
    try {
      const result = await createVaccination.mutateAsync({ id: bandeId, data: values });
      if (!(result as any)._pendingSync) {
        queryClient.invalidateQueries({ queryKey: getGetBandeVaccinationsQueryKey(bandeId) });
      }
      toast({ title: "Vaccin ajouté" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onEauSubmit = async (values: z.infer<typeof eauSchema>) => {
    try {
      await createEau.mutateAsync(values);
      toast({ title: "Consommation d'eau enregistrée" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const onTraitementSubmit = async (values: z.infer<typeof traitementSchema>) => {
    try {
      await createTraitement.mutateAsync(values);
      toast({ title: "Traitement enregistré" });
      setIsDialogOpen(false);
      resetForms();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

const onObservationSubmit = async (
  values: z.infer<typeof observationSchema>,
) => {
  try {
    console.log("[observation] submit:", values);

    const result = await createObservation.mutateAsync(values);

    console.log("[observation] mutation réussie:", result);

    toast({
      title: "Observation enregistrée",
    });

    setIsDialogOpen(false);
    resetForms();
  } catch (error) {
    console.error(
      "[observation] erreur pendant la création:",
      error,
    );

    toast({
      title: "Erreur",
      variant: "destructive",
    });
  }
};

  const handleMarkVaccinDone = async (vaccId: number) => {
    try {
      await updateVaccination.mutateAsync({ id: bandeId, vaccId, data: { fait: "oui", dateFait: new Date().toISOString().split("T")[0] } });
      queryClient.invalidateQueries({ queryKey: getGetBandeVaccinationsQueryKey(bandeId) });
      toast({ title: "Vaccin marqué comme fait" });
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const handleEdit = (item: any, type: 'depense' | 'vente' | 'depenseVente') => {
    setEditingId(item.id);
    if (type === 'depense') {
      depenseForm.reset({ designation: item.designation, categorie: item.categorie as CreateBandeDepenseBodyCategorie, quantite: item.quantite, prixUnitaire: item.prixUnitaire });
    } else if (type === 'vente') {
      venteForm.reset({ date: new Date(item.date).toISOString().split("T")[0], quantiteVendue: item.quantiteVendue, prixUnitaire: item.prixUnitaire });
    } else if (type === 'depenseVente') {
      depenseVenteForm.reset({ designation: item.designation, montant: item.montant });
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number, type: 'depense' | 'vente' | 'depenseVente') => {
    if (!confirm("Voulez-vous vraiment supprimer cet élément ?")) return;
    try {
      if (type === 'depense') {
        await deleteDepense.mutateAsync({ id: bandeId, depenseId: id });
        queryClient.invalidateQueries({ queryKey: getListBandeDepensesQueryKey(bandeId) });
      } else if (type === 'vente') {
        await deleteVente.mutateAsync({ id: bandeId, venteId: id });
        queryClient.invalidateQueries({ queryKey: getListBandeVentesQueryKey(bandeId) });
      } else if (type === 'depenseVente') {
        await deleteDepenseVente.mutateAsync({ id: bandeId, depenseId: id });
        queryClient.invalidateQueries({ queryKey: getListBandeDepensesVenteQueryKey(bandeId) });
      }
      invalidateBandeData();
      toast({ title: "Élément supprimé" });
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  if (isLoadingBande) return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Chargement de la bande...</div>;
  if (!bande) return <div>Bande introuvable.</div>;

  const detail = bande as BandeDetail;
  const mortaliteItems = (mortaliteData || []) as unknown as Array<Record<string, unknown>>;
  const peseesItems = (peseesData || []) as unknown as Array<Record<string, unknown>>;
  const consResp = (consommationData || {}) as Record<string, unknown>;
  const consEntries = (consResp.entries || []) as unknown as Array<Record<string, unknown>>;
  const vaccinItems = (vaccinationsData || []) as unknown as Array<Record<string, unknown>>;
  const eauItems = (eauData || []) as unknown as Array<Record<string, unknown>>;
  const traitementItems = (traitementsData || []) as unknown as Array<Record<string, unknown>>;
  const observationItems = (observationsData || []) as unknown as Array<Record<string, unknown>>;
  const refPoids = (referencePoids || []) as Array<{ ageJours: number; poidsG: number }>;

  const mortaliteParPhase = PHASES.map(phase => {
    const items = mortaliteItems.filter((m: any) => m.ageJours >= phase.min && m.ageJours <= phase.max);
    const totalDeces = items.reduce((s: number, m: any) => s + (m.decesJour || 0), 0);
    return { ...phase, totalDeces, count: items.length };
  }).filter(p => p.totalDeces > 0);

  const icParPhase = (() => {
    const result: Array<{ label: string; color: string; alimentKg: number; poidsGagne: number; ic: number | null }> = [];
    for (const phase of PHASES) {
      const alimentEntries = consEntries.filter((c: any) => {
        const d = new Date(c.date as string);
        const startDate = new Date(detail.dateDeDepart);
        const age = Math.floor((d.getTime() - startDate.getTime()) / 86400000) + 1;
        return age >= phase.min && age <= phase.max;
      });
      const alimentKg = alimentEntries.reduce((s: number, c: any) => s + (c.quantiteKg as number || 0), 0);

      const peseesPhase = peseesItems.filter((p: any) => p.ageJours >= phase.min && p.ageJours <= phase.max);
      const peseesPrev = peseesItems.filter((p: any) => p.ageJours < phase.min);
      const poidsDebut = peseesPrev.length > 0 ? (peseesPrev[peseesPrev.length - 1] as any).poidsMoyenG : 42;
      const poidsFin = peseesPhase.length > 0 ? (peseesPhase[peseesPhase.length - 1] as any).poidsMoyenG : null;
      const poidsGagne = poidsFin ? (poidsFin - poidsDebut) / 1000 : 0;
      const ic = poidsGagne > 0 && alimentKg > 0 ? alimentKg / (poidsGagne * (detail.sujetsRestants || 1)) : null;

      if (alimentKg > 0 || (peseesPhase.length > 0)) {
        result.push({ label: phase.label, color: phase.color, alimentKg, poidsGagne, ic: ic ? Math.round(ic * 100) / 100 : null });
      }
    }
    return result;
  })();

  const openDialog = (type: string) => {
    setDialogType(type);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader className="sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/bandes">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeaderContent>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 max-w-full truncate text-2xl font-bold tracking-tight font-serif text-foreground sm:text-3xl">{detail.nom}</h1>
              <span className={`inline-flex w-fit shrink-0 items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detail.statut === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {detail.statut === 'active' ? 'Active' : 'Terminée'}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>N° {detail.numero}</span>
              <span>Départ : {detail.sujetsDepart} sujets</span>
              <span>Restants : {detail.sujetsRestants} sujets</span>
            </p>
          </PageHeaderContent>
        </div>
      </PageHeader>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForms(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "mortalite" && "Ajouter une entrée de mortalité"}
              {dialogType === "pesee" && "Ajouter une pesée"}
              {dialogType === "consommation" && "Ajouter consommation aliment"}
              {dialogType === "vaccin" && "Ajouter un vaccin"}
              {dialogType === "eau" && "Ajouter consommation d'eau"}
              {dialogType === "traitement" && "Ajouter un traitement"}
              {dialogType === "observation" && "Ajouter une observation"}
              {dialogType === "depense" && (editingId ? "Modifier la dépense" : "Ajouter une dépense")}
              {dialogType === "vente" && (editingId ? "Modifier la vente" : "Enregistrer une vente")}
              {dialogType === "depenseVente" && (editingId ? "Modifier le frais" : "Ajouter un frais de vente")}
            </DialogTitle>
          </DialogHeader>

          {dialogType === "mortalite" && (
            <Form {...mortaliteForm}>
              <form onSubmit={mortaliteForm.handleSubmit(onMortaliteSubmit)} className="space-y-4">
                <FormField control={mortaliteForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={mortaliteForm.control} name="ageJours" render={({ field }) => (
                  <FormItem><FormLabel>Âge (jours)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={mortaliteForm.control} name="decesJour" render={({ field }) => (
                  <FormItem><FormLabel>Décès ce jour</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "pesee" && (
            <Form {...peseeForm}>
              <form onSubmit={peseeForm.handleSubmit(onPeseeSubmit)} className="space-y-4">
                <FormField control={peseeForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={peseeForm.control} name="ageJours" render={({ field }) => (
                  <FormItem><FormLabel>Âge (jours)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={peseeForm.control} name="poidsMoyenG" render={({ field }) => (
                  <FormItem><FormLabel>Poids moyen (g)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={peseeForm.control} name="objectifPoidsG" render={({ field }) => (
                  <FormItem><FormLabel>Objectif poids (g) - optionnel</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "consommation" && (
            <Form {...consommationForm}>
              <form onSubmit={consommationForm.handleSubmit(onConsommationSubmit)} className="space-y-4">
                <FormField control={consommationForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={consommationForm.control} name="quantiteKg" render={({ field }) => (
                  <FormItem><FormLabel>Quantité aliment (kg)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "vaccin" && (
            <Form {...vaccinForm}>
              <form onSubmit={vaccinForm.handleSubmit(onVaccinSubmit)} className="space-y-4">
                <FormField control={vaccinForm.control} name="jourPrevu" render={({ field }) => (
                  <FormItem><FormLabel>Jour prévu (J+)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={vaccinForm.control} name="nom" render={({ field }) => (
                  <FormItem><FormLabel>Nom du vaccin</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={vaccinForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description (optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "eau" && (
            <Form {...eauForm}>
              <form onSubmit={eauForm.handleSubmit(onEauSubmit)} className="space-y-4">
                <FormField control={eauForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={eauForm.control} name="ageJours" render={({ field }) => (
                  <FormItem><FormLabel>Jour (J+)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={eauForm.control} name="quantiteLitres" render={({ field }) => (
                  <FormItem><FormLabel>Quantité (litres)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "traitement" && (
            <Form {...traitementForm}>
              <form onSubmit={traitementForm.handleSubmit(onTraitementSubmit)} className="space-y-4">
                <FormField control={traitementForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={traitementForm.control} name="ageJours" render={({ field }) => (
                  <FormItem><FormLabel>Jour (J+)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={traitementForm.control} name="produit" render={({ field }) => (
                  <FormItem><FormLabel>Produit</FormLabel><FormControl><Input placeholder="ex: Anticoc, Bipestos..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={traitementForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="traitement">Traitement</SelectItem>
                        <SelectItem value="vaccin">Vaccin</SelectItem>
                        <SelectItem value="complement">Complément</SelectItem>
                        <SelectItem value="preventif">Préventif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={traitementForm.control} name="dosage" render={({ field }) => (
                  <FormItem><FormLabel>Dosage (optionnel)</FormLabel><FormControl><Input placeholder="ex: 1g/L" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={traitementForm.control} name="observations" render={({ field }) => (
                  <FormItem><FormLabel>Observations (optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "observation" && (
            <Form {...observationForm}>
              <form onSubmit={observationForm.handleSubmit(onObservationSubmit)} className="space-y-4">
                <FormField control={observationForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={observationForm.control} name="ageJours" render={({ field }) => (
                  <FormItem><FormLabel>Jour (J+)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={observationForm.control} name="contenu" render={({ field }) => (
                  <FormItem><FormLabel>Observation</FormLabel><FormControl><Textarea placeholder="Notes du jour..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "depense" && (
            <Form {...depenseForm}>
              <form onSubmit={depenseForm.handleSubmit(onDepenseSubmit)} className="space-y-4">
                <FormField control={depenseForm.control} name="categorie" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(CreateBandeDepenseBodyCategorie).map(cat => {
                          const labels: Record<string, string> = { poussins: "Poussins", aliments: "Aliments", concentre: "Concentré", prophylaxie: "Prophylaxie", carburant: "Carburant", salaires: "Salaires", transport: "Transport", main_oeuvre: "Main-d'oeuvre", autre: "Autre" };
                          return <SelectItem key={cat} value={cat}>{labels[cat] || cat}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={depenseForm.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Désignation</FormLabel><FormControl><DesignationCombobox value={field.value} onChange={field.onChange} suggestions={designationSuggestions} placeholder="Ex: Aliment démarrage" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={depenseForm.control} name="quantite" render={({ field }) => (
                    <FormItem><FormLabel>Quantité</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={depenseForm.control} name="prixUnitaire" render={({ field }) => (
                    <FormItem><FormLabel>Prix U. (FCFA)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "vente" && (
            <Form {...venteForm}>
              <form onSubmit={venteForm.handleSubmit(onVenteSubmit)} className="space-y-4">
                <FormField control={venteForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={venteForm.control} name="quantiteVendue" render={({ field }) => (
                    <FormItem><FormLabel>Quantité vendue</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={venteForm.control} name="prixUnitaire" render={({ field }) => (
                    <FormItem><FormLabel>Prix unitaire (FCFA)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}

          {dialogType === "depenseVente" && (
            <Form {...depenseVenteForm}>
              <form onSubmit={depenseVenteForm.handleSubmit(onDepenseVenteSubmit)} className="space-y-4">
                <FormField control={depenseVenteForm.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Désignation</FormLabel><FormControl><Input placeholder="ex: Ticket, Sanitaire..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={depenseVenteForm.control} name="montant" render={({ field }) => (
                  <FormItem><FormLabel>Montant (FCFA)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="min-h-10 w-full">Enregistrer</Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
        <TabsList className="mb-6 flex h-11 w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-muted/50 p-1">
          <TabsTrigger value="resume" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Info className="h-4 w-4 shrink-0" /><span>Résumé</span></TabsTrigger>
          <TabsTrigger value="depenses" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Receipt className="h-4 w-4 shrink-0" /><span>Dépenses</span></TabsTrigger>
          <TabsTrigger value="ventes" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><ShoppingCart className="h-4 w-4 shrink-0" /><span>Ventes</span></TabsTrigger>
          <TabsTrigger value="mortalite" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Skull className="h-4 w-4 shrink-0" /><span>Mortalité</span></TabsTrigger>
          <TabsTrigger value="pesees" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Scale className="h-4 w-4 shrink-0" /><span>Pesées & IC</span></TabsTrigger>
          <TabsTrigger value="vaccinations" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Syringe className="h-4 w-4 shrink-0" /><span>Vaccins</span></TabsTrigger>
          <TabsTrigger value="eau" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Droplets className="h-4 w-4 shrink-0" /><span>Eau</span></TabsTrigger>
          <TabsTrigger value="traitements" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><Pill className="h-4 w-4 shrink-0" /><span>Traitements</span></TabsTrigger>
          <TabsTrigger value="journal" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><BookOpen className="h-4 w-4 shrink-0" /><span>Journal</span></TabsTrigger>
          <TabsTrigger value="charges" className="flex min-w-fit gap-1 px-2 text-xs sm:px-3 sm:text-sm"><CheckSquare className="h-4 w-4 shrink-0" /><span>Charges</span></TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <ScanFiche
              bandeId={detail.id}
              bandeStartDate={detail.dateDeDepart}
              onDataSaved={() => {
                queryClient.invalidateQueries({ queryKey: getGetBandeMortaliteQueryKey(detail.id) });
                queryClient.invalidateQueries({ queryKey: getGetBandeConsommationQueryKey(detail.id) });
                queryClient.invalidateQueries({ queryKey: getGetBandePeseesQueryKey(detail.id) });
                queryClient.invalidateQueries({ queryKey: getGetBandeQueryKey(detail.id) });
                queryClient.invalidateQueries({ queryKey: ["consommation-eau", detail.id] });
                queryClient.invalidateQueries({ queryKey: ["traitements", detail.id] });
                queryClient.invalidateQueries({ queryKey: ["observations", detail.id] });
              }}
            />
            <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={() => exportBandePDF(detail, depenses || [], ventes || [], chargesFixes, mortaliteItems, peseesItems, consResp)}>
              <Download className="h-4 w-4 shrink-0" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={() => exportBandeExcel(detail, depenses || [], ventes || [], chargesFixes)}>
              <Download className="h-4 w-4 shrink-0" /> Excel
            </Button>
          </div>

          {(() => {
            const totalVendus = (detail as any).totalVendus ?? 0;
            const dernierePesee = peseesItems.length > 0 ? peseesItems[peseesItems.length - 1] as any : null;
            const poidsActuelG = dernierePesee?.poidsMoyenG ?? null;
            const sujetsVivantsTotaux = (detail.sujetsRestants || 0) + (totalVendus || 0);
            const coutRevientKgVif = (poidsActuelG && poidsActuelG > 0 && sujetsVivantsTotaux > 0)
              ? Math.round((detail.totalDepenses + detail.chargesFixesTotal) / ((sujetsVivantsTotaux * poidsActuelG) / 1000))
              : null;

            const poidsVenteTarget = 2000;
            let estimVente: { joursRestants: number; datePrevue: string } | null = null;
            if (peseesItems.length >= 2 && poidsActuelG && poidsActuelG < poidsVenteTarget) {
              const first = peseesItems[0] as any;
              const last = peseesItems[peseesItems.length - 1] as any;
              const gainTotal = last.poidsMoyenG - first.poidsMoyenG;
              const joursTotal = last.ageJours - first.ageJours;
              if (gainTotal > 0 && joursTotal > 0) {
                const gainParJour = gainTotal / joursTotal;
                const joursRestants = Math.ceil((poidsVenteTarget - last.poidsMoyenG) / gainParJour);
                if (joursRestants > 0 && joursRestants < 90) {
                  const datePrevue = new Date(detail.dateDeDepart + "T00:00:00");
                  datePrevue.setDate(datePrevue.getDate() + last.ageJours + joursRestants - 1);
                  estimVente = { joursRestants, datePrevue: datePrevue.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) };
                }
              }
            }

            const tauxMortalite = detail.sujetsDepart > 0 ? ((detail.nombreDeces / detail.sujetsDepart) * 100).toFixed(1) : "0";

            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Card className="shadow-sm border-t-4 border-t-primary">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sujets restants</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{detail.sujetsRestants}</div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>{detail.sujetsDepart} départ − {detail.nombreDeces} décès ({tauxMortalite}%)</p>
                      {totalVendus > 0 && <p>− {totalVendus} vendus</p>}
                    </div>
                    {estimVente && (
                      <p className="text-xs text-primary mt-1 font-medium">Vente ~dans {estimVente.joursRestants}j ({estimVente.datePrevue})</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-t-4 border-t-destructive">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Coût de production</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{formatFCFA(detail.totalDepenses + detail.chargesFixesTotal)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Coût / sujet vivant : {formatFCFA(detail.coutParSujet)}</p>
                    {coutRevientKgVif && <p className="text-xs text-muted-foreground">Revient / kg vif : {formatFCFA(coutRevientKgVif)}</p>}
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-t-4 border-t-sidebar-primary">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Recettes brutes</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{formatFCFA(detail.totalRecettes)}</div>
                    {totalVendus > 0 && <p className="text-xs text-muted-foreground mt-1">{totalVendus} poulets vendus</p>}
                  </CardContent>
                </Card>
                <Card className={`shadow-sm border-t-4 ${detail.beneficeNet >= 0 ? 'border-t-green-500' : 'border-t-red-500'}`}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Bénéfice net</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${detail.beneficeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatFCFA(detail.beneficeNet)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Sans charges : {formatFCFA(detail.beneficeNetSansCharges)}</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {(() => {
            const CAT_LABELS: Record<string, string> = {
              poussins: "Poussins",
              aliments: "Aliments",
              concentre: "Concentré",
              prophylaxie: "Prophylaxie",
              medicaments: "Prophylaxie",
              veterinaire: "Prophylaxie",
              carburant: "Carburant",
              salaires: "Salaires",
              transport: "Transport",
              main_oeuvre: "Main-d'oeuvre",
              autre: "Autre",
            };
            const catTotals: Record<string, number> = {};
            (depenses || []).forEach((d: any) => {
              const cat = CAT_LABELS[d.categorie] || d.categorie?.replace('_', ' ') || 'Autre';
              catTotals[cat] = (catTotals[cat] || 0) + (d.montant || 0);
            });
            if (detail.chargesFixesTotal > 0) catTotals["Charges fixes"] = detail.chargesFixesTotal;
            const pieData = Object.entries(catTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
            const COLORS = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#d4a373", "#e07a5f", "#8b5cf6", "#64748b"];
            if (pieData.length === 0) return null;
            const total = pieData.reduce((s, d) => s + d.value, 0);
            return (
              <Card>
                <CardHeader><CardTitle className="text-lg font-serif sm:text-xl">Répartition des coûts</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-6 items-center md:grid-cols-2">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" paddingAngle={2} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatFCFA(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {pieData.map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-sm">{entry.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium">{formatFCFA(entry.value)}</span>
                            <span className="text-xs text-muted-foreground ml-2">({(entry.value / total * 100).toFixed(0)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="depenses">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="text-lg font-serif sm:text-xl">Dépenses de Production</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => { setDialogType("depense"); setIsDialogOpen(true); }}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
            </CardHeader>
            <CardContent className="p-0">
              <DepensesGroupedTable
                items={(depenses || []) as any}
                isReadOnly={isReadOnly}
                onEdit={(item) => { setDialogType("depense"); handleEdit(item, 'depense'); }}
                onDelete={(id) => handleDelete(id, 'depense')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ventes" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="text-lg font-serif sm:text-xl">Ventes de Poulets</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => { setDialogType("vente"); setIsDialogOpen(true); }}><Plus className="w-4 h-4 shrink-0" /> Vendre</Button>}
            </CardHeader>
            <CardContent className="p-0">
              <VentesGroupedTable
                items={(ventes || []) as any}
                isReadOnly={isReadOnly}
                onEdit={(item) => { setDialogType("vente"); handleEdit(item, 'vente'); }}
                onDelete={(id) => handleDelete(id, 'vente')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="text-lg font-serif sm:text-xl">Frais de Vente</CardTitle>
              {!isReadOnly && <Button size="sm" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => { setDialogType("depenseVente"); setIsDialogOpen(true); }}><Plus className="w-4 h-4 shrink-0" /> Ajouter frais</Button>}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30"><TableHead>Désignation</TableHead><TableHead className="text-right">Montant</TableHead>{!isReadOnly && <TableHead className="text-right w-24">Actions</TableHead>}</TableRow></TableHeader>
                  <TableBody>
                    {depensesVente?.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Aucun frais enregistré</TableCell></TableRow>
                    ) : (
                      depensesVente?.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.designation}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">{formatFCFA(item.montant)}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDialogType("depenseVente"); handleEdit(item, 'depenseVente'); }}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id, 'depenseVente')}><Trash2 className="h-4 w-4" /></Button>
                              </div>
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

        <TabsContent value="mortalite" className="space-y-6">
          {mortaliteItems.length > 0 && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-lg font-serif sm:text-xl">Courbe de mortalité</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={mortaliteItems.map((m: any) => ({ jour: `J${m.ageJours}`, deces: m.decesJour, cumules: m.decesCumules, taux: m.tauxMortalite }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="jour" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" unit="%" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="deces" name="Décès / jour" fill="#ef4444" />
                      <Line yAxisId="right" type="monotone" dataKey="taux" name="Taux cumulé %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {mortaliteParPhase.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg font-serif sm:text-xl">Analyse par phase</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      {mortaliteParPhase.map(phase => {
                        const taux = detail.sujetsDepart > 0 ? ((phase.totalDeces / detail.sujetsDepart) * 100).toFixed(1) : "0";
                        return (
                          <div key={phase.nom} className="p-4 rounded-lg border" style={{ borderLeftColor: phase.color, borderLeftWidth: 4 }}>
                            <div className="text-sm font-medium text-muted-foreground">{phase.label}</div>
                            <div className="text-xs text-muted-foreground mb-1">J{phase.min} - J{phase.max > 100 ? "+" : phase.max}</div>
                            <div className="text-2xl font-bold">{phase.totalDeces}</div>
                            <div className="text-xs text-muted-foreground">{taux}% du total</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><Skull className="h-5 w-5 shrink-0" /> Suivi de la mortalité</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("mortalite")}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead><TableHead className="text-right">Jour</TableHead>
                      <TableHead className="text-right">Décès</TableHead><TableHead className="text-right">Cumulés</TableHead>
                      <TableHead className="text-right">Taux %</TableHead>
                      {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mortaliteItems.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune donnée de mortalité</TableCell></TableRow>
                    ) : (
                      mortaliteItems.map((m) => (
                        <TableRow key={m.id as number} className={m.alerteRouge ? "bg-red-50" : ""}>
                          <TableCell>{m.date as string}</TableCell>
                          <TableCell className="text-right">J{m.ageJours as number}</TableCell>
                          <TableCell className="text-right font-medium">{m.decesJour as number}</TableCell>
                          <TableCell className="text-right">{m.decesCumules as number}</TableCell>
                          <TableCell className={`text-right font-medium ${(m.tauxMortalite as number) > 5 ? "text-red-600" : ""}`}>
                            {m.tauxMortalite as number}%
                            {Boolean(m.alerteRouge) && <span className="ml-1 text-xs text-red-600">ALERTE</span>}
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                if (confirm("Supprimer cette entrée ?")) {
                                  try {
                                    const result = await deleteMortalite.mutateAsync({ id: bandeId, mortaliteId: m.id as number });
                                    if (!(result as any).pendingSync && !(result as any).cancelledLocalCreate) {
                                      queryClient.invalidateQueries({ queryKey: getGetBandeMortaliteQueryKey(bandeId) });
                                      invalidateBandeData();
                                    }
                                  } catch { toast({ title: "Erreur de suppression", variant: "destructive" }); }
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

        <TabsContent value="pesees" className="space-y-6">
          {(peseesItems.length > 0 || refPoids.length > 0) && (
            <Card>
              <CardHeader><CardTitle className="text-lg font-serif sm:text-xl">Courbe de croissance (vs référence COBB 500)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={(() => {
                    const allDays = new Set<number>();
                    peseesItems.forEach((p: any) => allDays.add(p.ageJours));
                    refPoids.forEach(r => allDays.add(r.ageJours));
                    const sortedDays = Array.from(allDays).sort((a, b) => a - b);
                    return sortedDays.map(day => {
                      const pesee = peseesItems.find((p: any) => p.ageJours === day) as any;
                      const ref = refPoids.find(r => r.ageJours === day);
                      return {
                        jour: `J${day}`,
                        poids: pesee ? pesee.poidsMoyenG : null,
                        reference: ref ? ref.poidsG : null,
                      };
                    });
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="jour" />
                    <YAxis unit="g" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="poids" name="Poids réel (g)" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="reference" name="Référence COBB 500 (g)" stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
                <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><Scale className="h-5 w-5 shrink-0" /> Pesées</CardTitle>
                {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("pesee")}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead><TableHead className="text-right">Jour</TableHead>
                        <TableHead className="text-right">Poids (g)</TableHead><TableHead className="text-right">Objectif</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                        {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {peseesItems.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune pesée enregistrée</TableCell></TableRow>
                      ) : (
                        peseesItems.map((p) => (
                          <TableRow key={p.id as number} className={p.alertePoids ? "bg-orange-50" : ""}>
                            <TableCell>{p.date as string}</TableCell>
                            <TableCell className="text-right">J{p.ageJours as number}</TableCell>
                            <TableCell className="text-right font-medium">{p.poidsMoyenG as number}g</TableCell>
                            <TableCell className="text-right text-muted-foreground">{p.objectifPoidsG ? `${p.objectifPoidsG}g` : "-"}</TableCell>
                            <TableCell className={`text-right font-medium ${p.ecart && (p.ecart as number) < 0 ? "text-orange-600" : "text-green-600"}`}>
                              {p.ecart != null ? `${(p.ecart as number) > 0 ? "+" : ""}${p.ecart}g` : "-"}
                            </TableCell>
                            {!isReadOnly && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                  if (confirm("Supprimer cette pesée ?")) {
                                    try {
                                      const result = await deletePesee.mutateAsync({ id: bandeId, peseeId: p.id as number });
                                      if (!(result as any).pendingSync && !(result as any).cancelledLocalCreate) {
                                        queryClient.invalidateQueries({ queryKey: getGetBandePeseesQueryKey(bandeId) });
                                      }
                                    } catch { toast({ title: "Erreur de suppression", variant: "destructive" }); }
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

            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
                  <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><Wheat className="h-5 w-5 shrink-0" /> Consommation aliment & IC</CardTitle>
                  {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("consommation")}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground text-xs block">Total aliment</span>
                      <span className="font-bold text-lg">{consResp.totalAlimentKg as number || 0} kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block">IC</span>
                      <span className={`font-bold text-lg ${
                        consResp.ic ? ((consResp.ic as number) <= 1.8 ? "text-green-700" : (consResp.ic as number) <= 2.2 ? "text-orange-600" : "text-red-600") : ""
                      }`}>
                        {consResp.ic ? (consResp.ic as number).toFixed(2) : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block">Statut IC</span>
                      <span className={`font-bold text-sm px-2 py-0.5 rounded ${
                        consResp.icStatus === "bon" ? "bg-green-100 text-green-800" :
                        consResp.icStatus === "moyen" ? "bg-orange-100 text-orange-800" :
                        consResp.icStatus === "mauvais" ? "bg-red-100 text-red-800" : "text-muted-foreground"
                      }`}>
                        {consResp.icStatus ? (consResp.icStatus as string).toUpperCase() : "-"}
                      </span>
                    </div>
                  </div>

                  {icParPhase.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-2">IC par phase</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {icParPhase.map(phase => (
                          <div key={phase.label} className="p-3 rounded-lg border text-sm" style={{ borderLeftColor: phase.color, borderLeftWidth: 3 }}>
                            <div className="font-medium">{phase.label}</div>
                            <div className="text-muted-foreground text-xs">{phase.alimentKg.toFixed(1)} kg aliment</div>
                            <div className="font-bold text-lg">
                              {phase.ic ? (
                                <span className={phase.ic <= 1.8 ? "text-green-700" : phase.ic <= 2.2 ? "text-orange-600" : "text-red-600"}>
                                  {phase.ic}
                                </span>
                              ) : "-"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Date</TableHead><TableHead className="text-right">Quantité (kg)</TableHead>
                          {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consEntries.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Aucune consommation</TableCell></TableRow>
                        ) : (
                          consEntries.map((c) => (
                            <TableRow key={c.id as number}>
                              <TableCell>{c.date as string}</TableCell>
                              <TableCell className="text-right font-medium">{c.quantiteKg as number} kg</TableCell>
                              {!isReadOnly && (
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                    if (confirm("Supprimer ?")) {
                                      try {
                                        await deleteConsommation.mutateAsync({ id: bandeId, consId: c.id as number });
                                        queryClient.invalidateQueries({ queryKey: getGetBandeConsommationQueryKey(bandeId) });
                                      } catch { toast({ title: "Erreur de suppression", variant: "destructive" }); }
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vaccinations">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><Syringe className="h-5 w-5 shrink-0" /> Calendrier de vaccination</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("vaccin")}><Plus className="w-4 h-4 shrink-0" /> Ajouter vaccin</Button>}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Jour</TableHead><TableHead>Vaccin</TableHead>
                      <TableHead>Date prévue</TableHead><TableHead>Statut</TableHead>
                      <TableHead>Date fait</TableHead>
                      {!isReadOnly && <TableHead className="text-right w-24">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vaccinItems.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune vaccination programmée</TableCell></TableRow>
                    ) : (
                      vaccinItems.map((v) => (
                        <TableRow key={v.id as number} className={v.enRetard && v.fait !== "oui" ? "bg-red-50" : v.fait === "oui" ? "bg-green-50/50" : ""}>
                          <TableCell className="font-medium">J{v.jourPrevu as number}</TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{v.nom as string}</span>
                              {Boolean(v.description) && <span className="block text-xs text-muted-foreground">{v.description as string}</span>}
                            </div>
                          </TableCell>
                          <TableCell>{v.datePrevue as string}</TableCell>
                          <TableCell>
                            {v.fait === "oui" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-800"><Check className="h-3 w-3" /> Fait</span>
                            ) : v.enRetard ? (
                              <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">EN RETARD</span>
                            ) : (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">En attente</span>
                            )}
                          </TableCell>
                          <TableCell>{v.dateFait ? (v.dateFait as string) : "-"}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {v.fait !== "oui" && (
                                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleMarkVaccinDone(v.id as number)}>
                                    <Check className="h-3 w-3" /> Fait
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                  if (confirm("Supprimer ce vaccin ?")) {
                                    try {
                                      const result = await deleteVaccination.mutateAsync({ id: bandeId, vaccId: v.id as number });
                                      if (!(result as any).pendingSync && !(result as any).cancelledLocalCreate) {
                                        queryClient.invalidateQueries({ queryKey: getGetBandeVaccinationsQueryKey(bandeId) });
                                      }
                                    } catch { toast({ title: "Erreur de suppression", variant: "destructive" }); }
                                  }
                                }}><Trash2 className="h-4 w-4" /></Button>
                              </div>
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

        <TabsContent value="eau" className="space-y-6">
          {eauItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg font-serif sm:text-xl">Courbe de consommation d'eau</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={eauItems.map((e: any) => ({ jour: `J${e.ageJours}`, litres: e.quantiteLitres }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="jour" />
                    <YAxis unit="L" />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="litres" name="Eau (L)" fill="#3b82f6" fillOpacity={0.2} stroke="#3b82f6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><Droplets className="h-5 w-5 shrink-0" /> Consommation d'eau</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("eau")}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
            </CardHeader>
            <CardContent>
              {eauItems.length > 0 && (
                <div className="mb-4 grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground text-xs block">Total eau</span>
                    <span className="font-bold text-lg">{eauItems.reduce((s: number, e: any) => s + e.quantiteLitres, 0).toFixed(1)} L</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Moy / jour</span>
                    <span className="font-bold text-lg">
                      {(eauItems.reduce((s: number, e: any) => s + e.quantiteLitres, 0) / eauItems.length).toFixed(1)} L
                    </span>
                  </div>
                </div>
              )}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead><TableHead className="text-right">Jour</TableHead>
                      <TableHead className="text-right">Litres</TableHead>
                      {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eauItems.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune donnée de consommation d'eau</TableCell></TableRow>
                    ) : (
                      eauItems.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.date}</TableCell>
                          <TableCell className="text-right">J{e.ageJours}</TableCell>
                          <TableCell className="text-right font-medium">{e.quantiteLitres} L</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                if (confirm("Supprimer ?")) {
                                  try { await deleteEau.mutateAsync(e.id); } catch { toast({ title: "Erreur", variant: "destructive" }); }
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

        <TabsContent value="traitements">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><Pill className="h-5 w-5 shrink-0" /> Journal des traitements</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("traitement")}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead><TableHead className="text-right">Jour</TableHead>
                      <TableHead>Produit</TableHead><TableHead>Type</TableHead>
                      <TableHead>Dosage</TableHead><TableHead>Observations</TableHead>
                      {!isReadOnly && <TableHead className="text-right w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traitementItems.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun traitement enregistré</TableCell></TableRow>
                    ) : (
                      traitementItems.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.date}</TableCell>
                          <TableCell className="text-right">J{t.ageJours}</TableCell>
                          <TableCell className="font-medium">{t.produit}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              t.type === "vaccin" ? "bg-blue-100 text-blue-800" :
                              t.type === "preventif" ? "bg-green-100 text-green-800" :
                              t.type === "complement" ? "bg-purple-100 text-purple-800" :
                              "bg-orange-100 text-orange-800"
                            }`}>{t.type}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.dosage || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{t.observations || "-"}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                if (confirm("Supprimer ?")) {
                                  try { await deleteTraitement.mutateAsync(t.id); } catch { toast({ title: "Erreur", variant: "destructive" }); }
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

        <TabsContent value="journal">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-serif sm:text-xl"><BookOpen className="h-5 w-5 shrink-0" /> Journal d'observations</CardTitle>
              {!isReadOnly && <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => openDialog("observation")}><Plus className="w-4 h-4 shrink-0" /> Ajouter</Button>}
            </CardHeader>
            <CardContent>
              {observationItems.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucune observation enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {observationItems.map((o: any) => (
                    <div key={o.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">J{o.ageJours}</span>
                          <span className="text-xs text-muted-foreground">{o.date}</span>
                        </div>
                        <p className="break-words text-sm">{o.contenu}</p>
                      </div>
                      {!isReadOnly && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={async () => {
                          if (confirm("Supprimer ?")) {
                            try { await deleteObservation.mutateAsync(o.id); } catch { toast({ title: "Erreur", variant: "destructive" }); }
                          }
                        }}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charges">
          <BandeChargesFixesPanel bandeId={bandeId} isReadOnly={isReadOnly} chargesFixes={chargesFixes} detail={detail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
