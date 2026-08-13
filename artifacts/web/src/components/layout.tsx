import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Wallet, 
  Bird, 
  LogOut, 
  Menu,
  X,
  BarChart3,
  ClipboardList,
  Users,
  Settings,
  Package,
  Calculator,
  TrendingUp,
  CalendarDays,
  Construction,
  BookOpen,
  ServerCrash,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppNetworkStatus } from "@/offline/network-provider";
import {
  useLogout,
  UserRole,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import {
  saveOfflineUser,
  clearOfflineUser,
} from "@/offline/auth";
import {
  clearOfflineBrowserScope,
  prepareOfflineStorageForUser,
} from "@/offline/db";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNomFerme } from "@/lib/ferme";
import { syncOutbox } from "@/offline/sync";
import { useOfflineUser } from "@/offline/use-offline-user";

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    status,
    isOnline,
    isOffline,
    isServerUnavailable,
  } = useAppNetworkStatus();
  const {
    user,
    isLoading,
    isOfflineSession,
  } = useOfflineUser();
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const { toast } = useToast();
  const nomFerme = useNomFerme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== "online" || !user) {
      return;
    }

    void (async () => {
      const scopeCleared = await prepareOfflineStorageForUser(user.id);

      if (scopeCleared) {
        const meQueryKey = getGetMeQueryKey();

        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== meQueryKey[0],
        });
      }

      await saveOfflineUser({
        id: user.id,
        username: user.username,
        nom: user.nom,
        role: user.role,
      });

      if (isOnline) {
        syncOutbox();
      }
    })();

    if (
      !isLoading &&
      !user &&
      location !== "/login" &&
      location !== "/"
    ) {
      setLocation("/login");
    }
  }, [user, isLoading, location, setLocation, isOnline, status, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      await clearOfflineUser();
      await clearOfflineBrowserScope();
      queryClient.clear();

      // Remove the authenticated user from the React Query cache
      queryClient.removeQueries({
        queryKey: getGetMeQueryKey(),
        exact: true,
      });

      toast({
        title: "A bientot",
        description: "Vous etes deconnecte.",
      });

      setLocation("/login");
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de se deconnecter",
        variant: "destructive",
      });
    }
  };

  const role = user.role as UserRole;
  const allRoles = [UserRole.admin, UserRole.investisseur, UserRole.gestionnaire, "lecteur" as UserRole];

  type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: UserRole[] };
  type NavGroup = { label: string; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: "Exploitation",
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: allRoles },
        { href: "/bandes", label: "Bandes de poulets", icon: Bird, roles: [UserRole.admin, UserRole.gestionnaire, "lecteur" as UserRole] },
      ],
    },
    {
      label: "Finances",
      items: [
        { href: "/tresorerie", label: "Finances", icon: TrendingUp, roles: [UserRole.admin, UserRole.investisseur, "lecteur" as UserRole] },
        { href: "/financement", label: "Financement", icon: Wallet, roles: allRoles },
      ],
    },
    {
      label: "Infrastructure",
      items: [
        { href: "/infrastructure", label: "Infrastructure", icon: Construction, roles: [UserRole.admin, UserRole.gestionnaire] },
        { href: "/stocks", label: "Stocks", icon: Package, roles: [UserRole.admin, UserRole.gestionnaire] },
      ],
    },
    {
      label: "Outils",
      items: [
        { href: "/comparaison-bandes", label: "Comparaison", icon: BarChart3, roles: [UserRole.admin, UserRole.investisseur, "lecteur" as UserRole] },
        { href: "/simulation", label: "Simulation", icon: Calculator, roles: allRoles },
        { href: "/planification", label: "Planification", icon: CalendarDays, roles: [UserRole.admin, UserRole.gestionnaire] },
        { href: "/historique-caisse", label: "Historique caisse", icon: BookOpen, roles: [UserRole.admin, UserRole.investisseur, "lecteur" as UserRole] },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/activity-log", label: "Journal d'activite", icon: ClipboardList, roles: [UserRole.admin] },
        { href: "/utilisateurs", label: "Utilisateurs", icon: Users, roles: [UserRole.admin] },
        { href: "/parametres", label: "Parametres", icon: Settings, roles: allRoles },
      ],
    },
  ];

  const filteredGroups = navGroups.map(g => ({
    ...g,
    items: g.items.filter(item => item.roles.includes(role)),
  })).filter(g => g.items.length > 0);

  const roleLabel: Record<string, string> = {
    [UserRole.admin]: "Administrateur",
    [UserRole.investisseur]: "Investisseur",
    [UserRole.gestionnaire]: "Gestionnaire",
    "lecteur": "Lecteur",
  };
  const roleName = roleLabel[role] || "Utilisateur";
  const userInitials = user.nom ? user.nom.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "U";
  const NetworkIcon = isOffline ? WifiOff : isServerUnavailable ? ServerCrash : Wifi;
  const networkLabel = isOffline
    ? "Hors ligne"
    : isServerUnavailable
      ? "Serveur indisponible"
      : "En ligne";
  const networkClasses = isOffline
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : isServerUnavailable
      ? "border-secondary/40 bg-secondary/15 text-foreground"
      : "border-primary/25 bg-primary/10 text-primary";

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background selection:bg-primary/20">
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 cursor-default bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        id="app-mobile-sidebar"
        className={`
        fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-[280px] transform flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:max-w-none lg:translate-x-0 lg:pt-0 lg:pb-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="p-4 pb-3 sm:p-5 sm:pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20">
              <Bird className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-sidebar-primary">
                {nomFerme}
              </h1>
              <p className="text-[11px] text-sidebar-foreground/50 leading-tight">Gestion avicole</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fermer le menu"
              className="h-9 w-9 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${networkClasses}`}>
            <NetworkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{networkLabel}</span>
            {isOfflineSession && <span className="truncate text-sidebar-foreground/70">session locale</span>}
          </div>
        </div>

        <div className="mx-4 mb-3 p-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-accent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-bold shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.nom}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">{roleName}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-1 overflow-y-auto">
          {filteredGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.label}</span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href || location.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                      <div className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer
                        ${isActive 
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm" 
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}
                      `}>
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="truncate text-[13px]">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 mt-auto border-t border-sidebar-accent/50">
          <button 
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 text-[13px]"
            onClick={handleLogout}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">Se deconnecter</span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="flex min-h-16 items-center gap-3 border-b border-border bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-controls="app-mobile-sidebar"
            aria-expanded={isMobileMenuOpen}
            aria-label="Ouvrir le menu"
            className="h-10 w-10 shrink-0 bg-background shadow-sm"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{nomFerme}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.nom}</p>
          </div>
          <div className={`inline-flex max-w-[44vw] items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${networkClasses}`}>
            <NetworkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{networkLabel}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-4 md:p-8">
          <div className="mx-auto w-full max-w-6xl min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
