import { useState } from "react";
import { useListBandes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Loader2, Check } from "lucide-react";

interface DayEntry {
  mortalite: string;
  alimentKg: string;
  eauLitres: string;
  saving: boolean;
  saved: boolean;
}

export default function SaisieRapide() {
  const { data: bandes } = useListBandes();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const [entries, setEntries] = useState<Record<number, DayEntry>>({});

  const activeBandes = ((bandes as any[]) || []).filter((b: any) => b.statut === "active");

  function getEntry(id: number): DayEntry {
    return entries[id] ?? { mortalite: "", alimentKg: "", eauLitres: "", saving: false, saved: false };
  }

  function update(id: number, field: keyof DayEntry, value: string) {
    setEntries(prev => ({ ...prev, [id]: { ...getEntry(id), [field]: value, saved: false } }));
  }

  async function save(bande: any) {
    const entry = getEntry(bande.id);
    const base = import.meta.env.BASE_URL || "/";
    const startDate = new Date(bande.dateDeDepart + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");
    const ageJours = Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) + 1;

    if (!entry.mortalite && !entry.alimentKg && !entry.eauLitres) {
      toast({ title: "Aucune donnée à enregistrer", variant: "destructive" });
      return;
    }

    setEntries(prev => ({ ...prev, [bande.id]: { ...getEntry(bande.id), saving: true } }));
    const errors: string[] = [];

    try {
      if (entry.mortalite && Number(entry.mortalite) >= 0) {
        const r = await fetch(`${base}api/bandes/${bande.id}/mortalite`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: today, ageJours, decesJour: Number(entry.mortalite) }),
        });
        if (!r.ok) errors.push("mortalité");
      }
      if (entry.alimentKg && Number(entry.alimentKg) > 0) {
        const r = await fetch(`${base}api/bandes/${bande.id}/consommation`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: today, quantiteKg: Number(entry.alimentKg), typeAliment: "Standard" }),
        });
        if (!r.ok) errors.push("aliment");
      }
      if (entry.eauLitres && Number(entry.eauLitres) > 0) {
        const r = await fetch(`${base}api/bandes/${bande.id}/consommation-eau`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: today, ageJours, quantiteLitres: Number(entry.eauLitres) }),
        });
        if (!r.ok) errors.push("eau");
      }
    } catch {
      errors.push("erreur réseau");
    }

    if (errors.length > 0) {
      toast({ title: `Erreur : ${errors.join(", ")}`, variant: "destructive" });
      setEntries(prev => ({ ...prev, [bande.id]: { ...getEntry(bande.id), saving: false } }));
    } else {
      toast({ title: `Données J${ageJours} enregistrées pour ${bande.nom}` });
      setEntries(prev => ({ ...prev, [bande.id]: { mortalite: "", alimentKg: "", eauLitres: "", saving: false, saved: true } }));
    }
  }

  if (activeBandes.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-primary" />
          </div>
          Saisie rapide du jour
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 text-xs text-muted-foreground px-1 pb-1 border-b">
            <span>Bande</span>
            <span className="text-center">Décès</span>
            <span className="text-center">Aliment (kg)</span>
            <span className="text-center">Eau (L)</span>
            <span></span>
          </div>
          {activeBandes.map((bande: any) => {
            const entry = getEntry(bande.id);
            const startDate = new Date(bande.dateDeDepart + "T00:00:00");
            const ageJours = Math.floor((new Date(today + "T00:00:00").getTime() - startDate.getTime()) / 86400000) + 1;
            return (
              <div key={bande.id} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center p-2 rounded-lg bg-muted/20 border">
                <div>
                  <span className="font-medium text-sm">{bande.nom}</span>
                  <span className="text-xs text-muted-foreground ml-2">J{ageJours} · {(bande.sujetsDepart - bande.nombreDeces)} sujets</span>
                </div>
                <Input
                  type="number" min="0" placeholder="0"
                  className="h-8 text-center text-sm"
                  value={entry.mortalite}
                  onChange={e => update(bande.id, "mortalite", e.target.value)}
                />
                <Input
                  type="number" min="0" step="0.5" placeholder="0"
                  className="h-8 text-center text-sm"
                  value={entry.alimentKg}
                  onChange={e => update(bande.id, "alimentKg", e.target.value)}
                />
                <Input
                  type="number" min="0" placeholder="0"
                  className="h-8 text-center text-sm"
                  value={entry.eauLitres}
                  onChange={e => update(bande.id, "eauLitres", e.target.value)}
                />
                <Button
                  size="sm" className="h-8 w-full"
                  variant={entry.saved ? "outline" : "default"}
                  disabled={entry.saving}
                  onClick={() => save(bande)}
                >
                  {entry.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : entry.saved ? <Check className="h-3.5 w-3.5 text-green-600" /> : "Enregistrer"}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
