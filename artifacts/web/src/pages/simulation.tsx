import { useState, useEffect } from "react";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, TrendingDown, Target, AlertTriangle, History, Droplets, Wheat } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

interface HistoriqueMoyennes {
  nbBandes: number;
  avgSujetsDepart: number;
  avgTauxMortalite: number;
  avgDureeJours: number;
  avgPoidsFinalG: number;
  aliment: {
    totalParSujet: number;
    demarrage: { parSujet: number; totalKg: number; pctTotal: number };
    croissance: { parSujet: number; totalKg: number; pctTotal: number };
    finition: { parSujet: number; totalKg: number; pctTotal: number };
  };
  eau: {
    totalParSujet: number;
    demarrage: { parSujet: number };
    croissance: { parSujet: number };
    finition: { parSujet: number };
  };
  mortalite: {
    demarrage: number;
    croissance: number;
    finition: number;
  };
}

export default function Simulation() {
  const [historique, setHistorique] = useState<HistoriqueMoyennes | null>(null);
  const [loadingHist, setLoadingHist] = useState(true);

  const [nbSujets, setNbSujets] = useState(1000);
  const [prixPoussin, setPrixPoussin] = useState(550);
  const [tauxMortalite, setTauxMortalite] = useState(5);
  const [prixVenteParPoulet, setPrixVenteParPoulet] = useState(3500);
  const [dureeJours, setDureeJours] = useState(45);

  const [alimentDemarrageKg, setAlimentDemarrageKg] = useState(0.5);
  const [alimentCroissanceKg, setAlimentCroissanceKg] = useState(1.5);
  const [alimentFinitionKg, setAlimentFinitionKg] = useState(2.5);
  const [prixAlimDemarrage, setPrixAlimDemarrage] = useState(400);
  const [prixAlimCroissance, setPrixAlimCroissance] = useState(350);
  const [prixAlimFinition, setPrixAlimFinition] = useState(320);

  const [eauDemarrageL, setEauDemarrageL] = useState(2);
  const [eauCroissanceL, setEauCroissanceL] = useState(5);
  const [eauFinitionL, setEauFinitionL] = useState(8);

  const [coutVeterinaire, setCoutVeterinaire] = useState(150);
  const [coutMainOeuvre, setCoutMainOeuvre] = useState(110000);
  const [coutTransport, setCoutTransport] = useState(50000);
  const [autresDepenses, setAutresDepenses] = useState(100000);
  const [valeurMateriel, setValeurMateriel] = useState(600000);
  const [loyer, setLoyer] = useState(0);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || "/";
    fetch(`${base}api/bandes/historique-moyennes`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then(data => {
        if (!data || typeof data.nbBandes !== "number") throw new Error("Invalid data");
        setHistorique(data);
        if (data.nbBandes > 0) {
          setTauxMortalite(data.avgTauxMortalite);
          setDureeJours(data.avgDureeJours);
          if (data.aliment.demarrage.parSujet > 0) setAlimentDemarrageKg(data.aliment.demarrage.parSujet);
          if (data.aliment.croissance.parSujet > 0) setAlimentCroissanceKg(data.aliment.croissance.parSujet);
          if (data.aliment.finition.parSujet > 0) setAlimentFinitionKg(data.aliment.finition.parSujet);
          if (data.eau.demarrage.parSujet > 0) setEauDemarrageL(data.eau.demarrage.parSujet);
          if (data.eau.croissance.parSujet > 0) setEauCroissanceL(data.eau.croissance.parSujet);
          if (data.eau.finition.parSujet > 0) setEauFinitionL(data.eau.finition.parSujet);
        }
        setLoadingHist(false);
      })
      .catch(() => setLoadingHist(false));
  }, []);

  const consommationTotalKg = alimentDemarrageKg + alimentCroissanceKg + alimentFinitionKg;
  const eauTotalL = eauDemarrageL + eauCroissanceL + eauFinitionL;

  const sujetsVendus = Math.round(nbSujets * (1 - tauxMortalite / 100));
  const coutPoussins = nbSujets * prixPoussin;
  const coutAlimDemarrage = nbSujets * alimentDemarrageKg * prixAlimDemarrage;
  const coutAlimCroissance = nbSujets * alimentCroissanceKg * prixAlimCroissance;
  const coutAlimFinition = nbSujets * alimentFinitionKg * prixAlimFinition;
  const coutAlimTotal = coutAlimDemarrage + coutAlimCroissance + coutAlimFinition;
  const coutVeto = nbSujets * coutVeterinaire;
  const totalDepenses = coutPoussins + coutAlimTotal + coutVeto + coutMainOeuvre + coutTransport + autresDepenses;
  const depreciation = valeurMateriel * 0.10;
  const imprevus = totalDepenses * 0.05;
  const chargesFixes = depreciation + imprevus + loyer;
  const totalCouts = totalDepenses + chargesFixes;
  const totalRecettes = sujetsVendus * prixVenteParPoulet;
  const beneficeNet = totalRecettes - totalCouts;
  const marge = totalRecettes > 0 ? (beneficeNet / totalRecettes * 100) : 0;
  const coutParSujet = nbSujets > 0 ? totalCouts / nbSujets : 0;
  const coutParSujetVendu = sujetsVendus > 0 ? totalCouts / sujetsVendus : 0;
  const seuilRentabilite = prixVenteParPoulet > 0 ? Math.ceil(totalCouts / prixVenteParPoulet) : 0;
  const prixMinVente = sujetsVendus > 0 ? Math.ceil(totalCouts / sujetsVendus) : 0;

  const totalAlimKgBande = nbSujets * consommationTotalKg;
  const totalEauLBande = nbSujets * eauTotalL;
  const sacsAlimDemarrage = Math.ceil(nbSujets * alimentDemarrageKg / 50);
  const sacsAlimCroissance = Math.ceil(nbSujets * alimentCroissanceKg / 50);
  const sacsAlimFinition = Math.ceil(nbSujets * alimentFinitionKg / 50);
  const sacsTotaux = sacsAlimDemarrage + sacsAlimCroissance + sacsAlimFinition;

  const chartData = [
    { name: "Poussins", value: coutPoussins, color: "#f59e0b" },
    { name: "Alim. Démarrage", value: coutAlimDemarrage, color: "#34d399" },
    { name: "Alim. Croissance", value: coutAlimCroissance, color: "#10b981" },
    { name: "Alim. Finition", value: coutAlimFinition, color: "#059669" },
    { name: "Prophylaxie", value: coutVeto, color: "#6366f1" },
    { name: "Main-d'oeuvre", value: coutMainOeuvre, color: "#ec4899" },
    { name: "Transport", value: coutTransport, color: "#8b5cf6" },
    { name: "Autres", value: autresDepenses, color: "#78716c" },
    { name: "Charges fixes", value: chargesFixes, color: "#ef4444" },
  ];

  const alimentPieData = [
    { name: "Démarrage", value: coutAlimDemarrage, color: "#34d399" },
    { name: "Croissance", value: coutAlimCroissance, color: "#10b981" },
    { name: "Finition", value: coutAlimFinition, color: "#059669" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Simulation de rentabilité</h1>
        <p className="text-muted-foreground mt-1">Estimez les coûts et recettes avant de lancer une bande</p>
      </div>

      {historique && historique.nbBandes > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Moyennes historiques ({historique.nbBandes} bandes terminées)
            </CardTitle>
            <CardDescription>Valeurs pré-remplies à partir des données réelles de vos bandes passées</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Taux mortalité moyen</span>
                <div className="font-bold text-lg">{historique.avgTauxMortalite}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">Durée moyenne</span>
                <div className="font-bold text-lg">{historique.avgDureeJours} jours</div>
              </div>
              <div>
                <span className="text-muted-foreground">Aliment total / sujet</span>
                <div className="font-bold text-lg">{historique.aliment.totalParSujet} kg</div>
              </div>
              <div>
                <span className="text-muted-foreground">Poids final moyen</span>
                <div className="font-bold text-lg">{historique.avgPoidsFinalG} g</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="p-2 bg-background rounded border">
                <div className="font-medium text-green-700">Démarrage (J1-15)</div>
                <div>Aliment : {historique.aliment.demarrage.parSujet} kg/sujet ({historique.aliment.demarrage.pctTotal}%)</div>
                <div>Mortalité : {historique.mortalite.demarrage}% des décès</div>
              </div>
              <div className="p-2 bg-background rounded border">
                <div className="font-medium text-green-700">Croissance (J16-28)</div>
                <div>Aliment : {historique.aliment.croissance.parSujet} kg/sujet ({historique.aliment.croissance.pctTotal}%)</div>
                <div>Mortalité : {historique.mortalite.croissance}% des décès</div>
              </div>
              <div className="p-2 bg-background rounded border">
                <div className="font-medium text-green-700">Finition (J29+)</div>
                <div>Aliment : {historique.aliment.finition.parSujet} kg/sujet ({historique.aliment.finition.pctTotal}%)</div>
                <div>Mortalité : {historique.mortalite.finition}% des décès</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Paramètres de production</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Nombre de sujets</label>
                  <Input type="number" value={nbSujets} onChange={e => setNbSujets(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Durée (jours)</label>
                  <Input type="number" value={dureeJours} onChange={e => setDureeJours(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Prix poussin (FCFA)</label>
                  <Input type="number" value={prixPoussin} onChange={e => setPrixPoussin(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Taux mortalité (%)</label>
                  <Input type="number" step="0.1" value={tauxMortalite} onChange={e => setTauxMortalite(Number(e.target.value))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Wheat className="h-5 w-5" /> Alimentation par phase
              </CardTitle>
              <CardDescription>Consommation et prix par type d'aliment (sacs de 50 kg)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-green-700">Démarrage (J1-15)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">kg / sujet</label>
                    <Input type="number" step="0.01" value={alimentDemarrageKg} onChange={e => setAlimentDemarrageKg(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Prix / kg (FCFA)</label>
                    <Input type="number" value={prixAlimDemarrage} onChange={e => setPrixAlimDemarrage(Number(e.target.value))} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  = {sacsAlimDemarrage} sacs, {Math.round(nbSujets * alimentDemarrageKg)} kg, {formatFCFA(coutAlimDemarrage)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-green-700">Croissance (J16-28)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">kg / sujet</label>
                    <Input type="number" step="0.01" value={alimentCroissanceKg} onChange={e => setAlimentCroissanceKg(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Prix / kg (FCFA)</label>
                    <Input type="number" value={prixAlimCroissance} onChange={e => setPrixAlimCroissance(Number(e.target.value))} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  = {sacsAlimCroissance} sacs, {Math.round(nbSujets * alimentCroissanceKg)} kg, {formatFCFA(coutAlimCroissance)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-green-700">Finition (J29+)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">kg / sujet</label>
                    <Input type="number" step="0.01" value={alimentFinitionKg} onChange={e => setAlimentFinitionKg(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Prix / kg (FCFA)</label>
                    <Input type="number" value={prixAlimFinition} onChange={e => setPrixAlimFinition(Number(e.target.value))} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  = {sacsAlimFinition} sacs, {Math.round(nbSujets * alimentFinitionKg)} kg, {formatFCFA(coutAlimFinition)}
                </div>
              </div>
              <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                <span>Total aliment : {consommationTotalKg.toFixed(2)} kg/sujet, {sacsTotaux} sacs</span>
                <span>{formatFCFA(coutAlimTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Droplets className="h-5 w-5" /> Eau par phase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Démarrage (L/sujet)</label>
                  <Input type="number" step="0.1" value={eauDemarrageL} onChange={e => setEauDemarrageL(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Croissance (L/sujet)</label>
                  <Input type="number" step="0.1" value={eauCroissanceL} onChange={e => setEauCroissanceL(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Finition (L/sujet)</label>
                  <Input type="number" step="0.1" value={eauFinitionL} onChange={e => setEauFinitionL(Number(e.target.value))} />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Total : {eauTotalL.toFixed(1)} L/sujet = {Math.round(totalEauLBande).toLocaleString("fr-FR")} L pour {nbSujets} sujets
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Autres coûts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Coût prophylaxie / sujet</label>
                  <Input type="number" value={coutVeterinaire} onChange={e => setCoutVeterinaire(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Main-d'oeuvre totale</label>
                  <Input type="number" value={coutMainOeuvre} onChange={e => setCoutMainOeuvre(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Transport</label>
                  <Input type="number" value={coutTransport} onChange={e => setCoutTransport(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Autres dépenses</label>
                  <Input type="number" value={autresDepenses} onChange={e => setAutresDepenses(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Valeur matériel fixe</label>
                  <Input type="number" value={valeurMateriel} onChange={e => setValeurMateriel(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Loyer</label>
                  <Input type="number" value={loyer} onChange={e => setLoyer(Number(e.target.value))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Recettes estimées</CardTitle></CardHeader>
            <CardContent>
              <div>
                <label className="text-sm font-medium">Prix de vente par poulet (FCFA)</label>
                <Input type="number" value={prixVenteParPoulet} onChange={e => setPrixVenteParPoulet(Number(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <Card className={`border-t-4 ${beneficeNet >= 0 ? 'border-t-green-500' : 'border-t-red-500'}`}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                {beneficeNet >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                Bénéfice net estimé
              </CardTitle></CardHeader>
              <CardContent><div className={`text-2xl font-bold ${beneficeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatFCFA(beneficeNet)}</div></CardContent>
            </Card>
            <Card className="border-t-4 border-t-primary">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Marge</CardTitle></CardHeader>
              <CardContent><div className={`text-2xl font-bold ${marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>{marge.toFixed(1)}%</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Résumé financier</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Sujets au départ</span><span className="font-medium">{nbSujets}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Sujets vendus (estimés)</span><span className="font-medium">{sujetsVendus}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Coût poussins</span><span className="font-medium text-red-600">{formatFCFA(coutPoussins)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Coût aliments total</span><span className="font-medium text-red-600">{formatFCFA(coutAlimTotal)}</span></div>
              <div className="flex justify-between py-1 border-b pl-4 text-xs"><span className="text-muted-foreground">Démarrage</span><span>{formatFCFA(coutAlimDemarrage)}</span></div>
              <div className="flex justify-between py-1 border-b pl-4 text-xs"><span className="text-muted-foreground">Croissance</span><span>{formatFCFA(coutAlimCroissance)}</span></div>
              <div className="flex justify-between py-1 border-b pl-4 text-xs"><span className="text-muted-foreground">Finition</span><span>{formatFCFA(coutAlimFinition)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Coût prophylaxie</span><span className="font-medium text-red-600">{formatFCFA(coutVeto)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Charges fixes</span><span className="font-medium text-red-600">{formatFCFA(chargesFixes)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground font-semibold">Coût total</span><span className="font-bold text-red-600">{formatFCFA(totalCouts)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Recettes totales</span><span className="font-medium text-green-600">{formatFCFA(totalRecettes)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Coût par sujet</span><span className="font-medium">{formatFCFA(coutParSujet)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Coût par sujet vendu</span><span className="font-medium">{formatFCFA(coutParSujetVendu)}</span></div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader><CardTitle className="text-lg font-serif flex items-center gap-2"><Target className="h-5 w-5" /> Seuil de rentabilité</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Poulets minimum à vendre</span>
                <span className="font-bold">{seuilRentabilite} poulets</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Prix minimum de vente</span>
                <span className="font-bold">{formatFCFA(prixMinVente)} / poulet</span>
              </div>
              {seuilRentabilite > sujetsVendus && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 rounded text-red-700 text-sm dark:bg-red-900/20">
                  <AlertTriangle className="h-4 w-4" /> Le seuil de rentabilité dépasse le nombre de sujets vendus estimés
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Besoins en aliments</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Aliment démarrage</span>
                <span className="font-medium">{sacsAlimDemarrage} sacs ({Math.round(nbSujets * alimentDemarrageKg)} kg)</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Aliment croissance</span>
                <span className="font-medium">{sacsAlimCroissance} sacs ({Math.round(nbSujets * alimentCroissanceKg)} kg)</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Aliment finition</span>
                <span className="font-medium">{sacsAlimFinition} sacs ({Math.round(nbSujets * alimentFinitionKg)} kg)</span>
              </div>
              <div className="flex justify-between py-1 border-b font-semibold">
                <span>Total aliment</span>
                <span>{sacsTotaux} sacs ({Math.round(totalAlimKgBande)} kg)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Eau totale estimée</span>
                <span className="font-medium">{Math.round(totalEauLBande).toLocaleString("fr-FR")} litres</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Répartition des coûts</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatFCFA(value)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Répartition alimentation</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={alimentPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {alimentPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatFCFA(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
