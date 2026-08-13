import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getNomFerme } from "./ferme";

interface AggregatedDepense {
  categorie: string;
  designation: string;
  quantite: number;
  montant: number;
  prixUnitaireMoyen: number;
}

function aggregateDepenses(depenses: any[]): AggregatedDepense[] {
  const map = new Map<string, AggregatedDepense>();
  for (const d of depenses) {
    const key = `${d.categorie}||${d.designation}`;
    const existing = map.get(key);
    const qte = parseFloat(d.quantite) || 0;
    const montant = parseFloat(d.montant) || (qte * parseFloat(d.prixUnitaire));
    if (existing) {
      existing.quantite += qte;
      existing.montant += montant;
    } else {
      map.set(key, {
        categorie: d.categorie,
        designation: d.designation,
        quantite: qte,
        montant,
        prixUnitaireMoyen: 0,
      });
    }
  }
  const result: AggregatedDepense[] = [];
  for (const item of map.values()) {
    item.prixUnitaireMoyen = item.quantite > 0 ? item.montant / item.quantite : 0;
    result.push(item);
  }
  result.sort((a, b) => a.categorie.localeCompare(b.categorie) || b.montant - a.montant);
  return result;
}

export function exportBandePDF(detail: any, depenses: any[], ventes: any[], chargesFixes: any, mortalite: any[], pesees: any[], consommation: any) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(getNomFerme(), 14, 20);
  doc.setFontSize(14);
  doc.text(`Rapport - ${detail.nom}`, 14, 30);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 37);

  doc.setFontSize(12);
  doc.text("Résumé", 14, 50);

  autoTable(doc, {
    startY: 55,
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Sujets au départ", String(detail.sujetsDepart)],
      ["Décès", String(detail.nombreDeces)],
      ["Sujets restants", String(detail.sujetsRestants)],
      ["Coût de production", formatFCFA(detail.totalDepenses)],
      ["Charges fixes", formatFCFA(detail.chargesFixesTotal)],
      ["Recettes", formatFCFA(detail.totalRecettes)],
      ["Bénéfice net", formatFCFA(detail.beneficeNet)],
      ["Coût par sujet", formatFCFA(detail.coutParSujet)],
    ],
    theme: "striped",
  });

  if (depenses.length > 0) {
    const aggregated = aggregateDepenses(depenses);
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(12);
    doc.text("Dépenses de production (agrégées)", 14, finalY + 10);

    const rows: any[][] = [];
    let currentCat = "";
    let catTotal = 0;
    const addCatTotal = () => {
      if (currentCat && catTotal > 0) {
        rows.push([{ content: `Sous-total ${currentCat}`, colSpan: 4, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }, { content: formatFCFA(catTotal), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]);
      }
    };

    for (const d of aggregated) {
      if (d.categorie !== currentCat) {
        addCatTotal();
        currentCat = d.categorie;
        catTotal = 0;
      }
      catTotal += d.montant;
      rows.push([
        d.categorie,
        d.designation,
        String(Math.round(d.quantite * 100) / 100),
        formatFCFA(Math.round(d.prixUnitaireMoyen)),
        formatFCFA(d.montant),
      ]);
    }
    addCatTotal();

    const grandTotal = aggregated.reduce((s, d) => s + d.montant, 0);
    rows.push([{ content: "TOTAL GÉNÉRAL", colSpan: 4, styles: { fontStyle: "bold", fillColor: [220, 230, 220] } }, { content: formatFCFA(grandTotal), styles: { fontStyle: "bold", fillColor: [220, 230, 220] } }]);

    autoTable(doc, {
      startY: finalY + 15,
      head: [["Catégorie", "Désignation", "Qté totale", "Prix U. moyen", "Montant total"]],
      body: rows,
      theme: "striped",
    });
  }

  if (ventes.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text("Ventes", 14, 20);

    autoTable(doc, {
      startY: 25,
      head: [["Date", "Quantité", "Prix U.", "Montant"]],
      body: ventes.map(v => [
        v.date,
        String(v.quantiteVendue),
        formatFCFA(v.prixUnitaire),
        formatFCFA(v.montant),
      ]),
      theme: "striped",
    });
  }

  doc.save(`rapport_${detail.nom.replace(/\s+/g, "_")}.pdf`);
}

export function exportBandeExcel(detail: any, depenses: any[], ventes: any[], chargesFixes: any) {
  import("xlsx").then(XLSX => {
    const wb = XLSX.utils.book_new();

    const resumeData = [
      ["Indicateur", "Valeur"],
      ["Nom", detail.nom],
      ["Sujets au départ", detail.sujetsDepart],
      ["Décès", detail.nombreDeces],
      ["Sujets restants", detail.sujetsRestants],
      ["Coût de production", detail.totalDepenses],
      ["Charges fixes", detail.chargesFixesTotal],
      ["Recettes", detail.totalRecettes],
      ["Bénéfice net", detail.beneficeNet],
      ["Coût par sujet", detail.coutParSujet],
    ];
    const wsResume = XLSX.utils.aoa_to_sheet(resumeData);
    XLSX.utils.book_append_sheet(wb, wsResume, "Résumé");

    if (depenses.length > 0) {
      const aggregated = aggregateDepenses(depenses);
      const depData: any[][] = [
        ["Catégorie", "Désignation", "Quantité totale", "Prix Unitaire moyen", "Montant total"],
      ];

      let currentCat = "";
      let catTotal = 0;
      for (const d of aggregated) {
        if (d.categorie !== currentCat) {
          if (currentCat && catTotal > 0) {
            depData.push([`Sous-total ${currentCat}`, "", "", "", catTotal]);
          }
          currentCat = d.categorie;
          catTotal = 0;
        }
        catTotal += d.montant;
        depData.push([d.categorie, d.designation, Math.round(d.quantite * 100) / 100, Math.round(d.prixUnitaireMoyen), d.montant]);
      }
      if (currentCat && catTotal > 0) {
        depData.push([`Sous-total ${currentCat}`, "", "", "", catTotal]);
      }
      depData.push(["TOTAL GÉNÉRAL", "", "", "", aggregated.reduce((s, d) => s + d.montant, 0)]);

      const wsDep = XLSX.utils.aoa_to_sheet(depData);
      XLSX.utils.book_append_sheet(wb, wsDep, "Dépenses");
    }

    if (ventes.length > 0) {
      const ventData = [
        ["Date", "Quantité", "Prix Unitaire", "Montant"],
        ...ventes.map(v => [v.date, v.quantiteVendue, v.prixUnitaire, v.montant]),
      ];
      const wsVent = XLSX.utils.aoa_to_sheet(ventData);
      XLSX.utils.book_append_sheet(wb, wsVent, "Ventes");
    }

    XLSX.writeFile(wb, `rapport_${detail.nom.replace(/\s+/g, "_")}.xlsx`);
  });
}

export function exportConstructionPDF(items: any[], title: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(getNomFerme(), 14, 20);
  doc.setFontSize(14);
  doc.text(`Rapport - ${title}`, 14, 30);
  doc.setFontSize(10);
  doc.text(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, 14, 37);

  if (items.length > 0) {
    const aggregated = aggregateDepenses(items.map(i => ({
      categorie: i.categorie || "materiaux",
      designation: i.designation,
      quantite: i.quantite,
      prixUnitaire: i.prixUnitaire,
    })));

    const rows: any[][] = [];
    let currentCat = "";
    let catTotal = 0;
    const addCatTotal = () => {
      if (currentCat && catTotal > 0) {
        rows.push([{ content: `Sous-total ${currentCat}`, colSpan: 4, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }, { content: formatFCFA(catTotal), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]);
      }
    };

    for (const d of aggregated) {
      if (d.categorie !== currentCat) {
        addCatTotal();
        currentCat = d.categorie;
        catTotal = 0;
      }
      catTotal += d.montant;
      rows.push([
        d.categorie,
        d.designation,
        String(Math.round(d.quantite * 100) / 100),
        formatFCFA(Math.round(d.prixUnitaireMoyen)),
        formatFCFA(d.montant),
      ]);
    }
    addCatTotal();

    const grandTotal = aggregated.reduce((s, d) => s + d.montant, 0);
    rows.push([{ content: "TOTAL GENERAL", colSpan: 4, styles: { fontStyle: "bold", fillColor: [220, 230, 220] } }, { content: formatFCFA(grandTotal), styles: { fontStyle: "bold", fillColor: [220, 230, 220] } }]);

    autoTable(doc, {
      startY: 45,
      head: [["Categorie", "Designation", "Qte totale", "Prix U. moyen", "Montant total"]],
      body: rows,
      theme: "striped",
    });
  }

  doc.save(`rapport_${title.replace(/\s+/g, "_")}.pdf`);
}

export function exportConstructionExcel(items: any[], title: string) {
  import("xlsx").then(XLSX => {
    const wb = XLSX.utils.book_new();

    if (items.length > 0) {
      const aggregated = aggregateDepenses(items.map(i => ({
        categorie: i.categorie || "materiaux",
        designation: i.designation,
        quantite: i.quantite,
        prixUnitaire: i.prixUnitaire,
      })));

      const depData: any[][] = [
        ["Categorie", "Designation", "Quantite totale", "Prix Unitaire moyen", "Montant total"],
      ];

      let currentCat = "";
      let catTotal = 0;
      for (const d of aggregated) {
        if (d.categorie !== currentCat) {
          if (currentCat && catTotal > 0) {
            depData.push([`Sous-total ${currentCat}`, "", "", "", catTotal]);
          }
          currentCat = d.categorie;
          catTotal = 0;
        }
        catTotal += d.montant;
        depData.push([d.categorie, d.designation, Math.round(d.quantite * 100) / 100, Math.round(d.prixUnitaireMoyen), d.montant]);
      }
      if (currentCat && catTotal > 0) {
        depData.push([`Sous-total ${currentCat}`, "", "", "", catTotal]);
      }
      depData.push(["TOTAL GENERAL", "", "", "", aggregated.reduce((s, d) => s + d.montant, 0)]);

      const ws = XLSX.utils.aoa_to_sheet(depData);
      XLSX.utils.book_append_sheet(wb, ws, "Depenses");
    }

    XLSX.writeFile(wb, `rapport_${title.replace(/\s+/g, "_")}.xlsx`);
  });
}

function formatFCFA(n: number): string {
  const formatted = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return formatted + " FCFA";
}
