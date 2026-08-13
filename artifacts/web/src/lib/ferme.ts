import { useEffect, useState } from "react";

export const NOM_FERME_DEFAUT = "Ma Ferme";

type Parametre = { cle: string; valeur: string };

/**
 * Nom de l'exploitation, réglable dans /parametres (clé `nom_ferme`).
 *
 * Il est mis en cache dans le module puis dans sessionStorage pour que les
 * exports PDF (fonctions synchrones) puissent le lire sans requête réseau.
 */
let nomFermeCache: string | null = null;

const STORAGE_KEY = "nom_ferme";

function lireCache(): string {
  if (nomFermeCache) return nomFermeCache;
  try {
    const stocke = sessionStorage.getItem(STORAGE_KEY);
    if (stocke) {
      nomFermeCache = stocke;
      return stocke;
    }
  } catch {
    // sessionStorage indisponible (navigation privée, iframe) — on ignore.
  }
  return NOM_FERME_DEFAUT;
}

const EVENEMENT_CHANGEMENT = "nom-ferme-change";

function ecrireCache(nom: string) {
  const change = nomFermeCache !== nom;
  nomFermeCache = nom;
  try {
    sessionStorage.setItem(STORAGE_KEY, nom);
  } catch {
    // idem
  }
  if (change) {
    window.dispatchEvent(new CustomEvent(EVENEMENT_CHANGEMENT, { detail: nom }));
  }
}

/** À appeler après modification du paramètre `nom_ferme` pour rafraîchir toute l'interface. */
export function setNomFerme(nom: string) {
  ecrireCache(nom.trim() || NOM_FERME_DEFAUT);
}

/** Lecture synchrone, pour les exports PDF/Excel. */
export function getNomFerme(): string {
  return lireCache();
}

export async function fetchNomFerme(): Promise<string> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
  try {
    const res = await fetch(`${baseUrl}/parametres`, { credentials: "include" });
    if (!res.ok) return lireCache();
    const parametres: Parametre[] = await res.json();
    const nom = parametres.find((p) => p.cle === "nom_ferme")?.valeur?.trim();
    if (nom) {
      ecrireCache(nom);
      return nom;
    }
  } catch {
    // hors ligne ou API indisponible — on garde la dernière valeur connue
  }
  return lireCache();
}

/**
 * Hook React : renvoie le nom de la ferme et met à jour le titre de l'onglet.
 * Rend d'abord la valeur en cache, puis la valeur fraîche de l'API.
 */
export function useNomFerme(): string {
  const [nom, setNom] = useState<string>(lireCache);

  useEffect(() => {
    let annule = false;
    fetchNomFerme().then((valeur) => {
      if (!annule) setNom(valeur);
    });

    const surChangement = (e: Event) => setNom((e as CustomEvent<string>).detail);
    window.addEventListener(EVENEMENT_CHANGEMENT, surChangement);

    return () => {
      annule = true;
      window.removeEventListener(EVENEMENT_CHANGEMENT, surChangement);
    };
  }, []);

  useEffect(() => {
    document.title = nom;
  }, [nom]);

  return nom;
}
