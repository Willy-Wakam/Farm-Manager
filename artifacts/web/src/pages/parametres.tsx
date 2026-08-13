import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, RotateCcw } from "lucide-react";
import { setNomFerme } from "@/lib/ferme";

type Parametre = {
  id: number;
  cle: string;
  valeur: string;
  description: string;
  categorie: string;
  updatedAt: string;
};

const CATEGORY_ORDER = [
  "Identité",
  "Charges fixes",
  "Alertes",
  "Indice de conversion",
  "Budget construction",
  "Calendrier vaccinal",
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Identité": "Nom de l'exploitation et devise, repris dans l'application et sur les rapports exportés",
  "Charges fixes": "Taux utilisés pour calculer les charges fixes des bandes de poulets",
  "Alertes": "Seuils de déclenchement des alertes sur le tableau de bord et les fiches de bandes",
  "Indice de conversion": "Bornes pour qualifier l'indice de conversion alimentaire (IC)",
  "Budget construction": "Montants par défaut si aucun devis n'a été saisi",
  "Calendrier vaccinal": "Programme de vaccination appliqué automatiquement aux nouvelles bandes",
};

const UNIT_LABELS: Record<string, string> = {
  taux_depreciation_materiel: "%",
  taux_imprevus: "%",
  seuil_mortalite_alerte_jour: "%",
  seuil_mortalite_alerte_cumul: "%",
  seuil_poids_alerte: "%",
  budget_batiment_defaut: "FCFA",
  budget_carburant_defaut: "FCFA",
};

export default function Parametres() {
  const { data: user } = useGetMe();
  const { toast } = useToast();
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    loadParametres();
  }, []);

  async function loadParametres() {
    try {
      const res = await fetch(`${baseUrl}/parametres`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setParametres(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function saveParametre(cle: string) {
    const newValue = editedValues[cle];
    if (newValue === undefined) return;

    setSaving(cle);
    try {
      const res = await fetch(`${baseUrl}/parametres/${cle}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ valeur: newValue }),
      });
      if (res.ok) {
        const updated = await res.json();
        setParametres(prev => prev.map(p => p.cle === cle ? updated : p));
        if (cle === "nom_ferme") setNomFerme(updated.valeur);
        setEditedValues(prev => {
          const next = { ...prev };
          delete next[cle];
          return next;
        });
        toast({ title: "Paramètre mis à jour" });
      } else {
        const err = await res.json();
        toast({ title: "Erreur", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur de connexion", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  function resetEdit(cle: string) {
    setEditedValues(prev => {
      const next = { ...prev };
      delete next[cle];
      return next;
    });
  }

  function getDisplayValue(p: Parametre) {
    return editedValues[p.cle] !== undefined ? editedValues[p.cle] : p.valeur;
  }

  function isModified(cle: string) {
    return editedValues[cle] !== undefined;
  }

  const grouped: Record<string, Parametre[]> = {};
  for (const p of parametres) {
    if (!grouped[p.categorie]) grouped[p.categorie] = [];
    grouped[p.categorie].push(p);
  }

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Valeurs et formules configurables de l'application" : "Consultation des valeurs et formules de l'application"}
        </p>
      </div>

      {sortedCategories.map(cat => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              {cat}
            </CardTitle>
            {CATEGORY_DESCRIPTIONS[cat] && (
              <CardDescription>{CATEGORY_DESCRIPTIONS[cat]}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {grouped[cat].map(p => (
                <div key={p.cle} className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{p.description}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">{p.cle}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin ? (
                      <>
                        <div className="relative">
                          <Input
                            className="w-40 text-right pr-12"
                            value={getDisplayValue(p)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === p.valeur) {
                                resetEdit(p.cle);
                              } else {
                                setEditedValues(prev => ({ ...prev, [p.cle]: val }));
                              }
                            }}
                          />
                          {UNIT_LABELS[p.cle] && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {UNIT_LABELS[p.cle]}
                            </span>
                          )}
                        </div>
                        {isModified(p.cle) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetEdit(p.cle)}
                              disabled={saving === p.cle}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveParametre(p.cle)}
                              disabled={saving === p.cle}
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              {saving === p.cle ? "..." : "Enregistrer"}
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                        {p.valeur}
                        {UNIT_LABELS[p.cle] && (
                          <span className="text-muted-foreground ml-1">{UNIT_LABELS[p.cle]}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
