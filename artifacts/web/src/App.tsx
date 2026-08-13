import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { NetworkProvider } from "@/offline/network-provider";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { queryStorage } from "@/offline/query-storage";

import { Layout } from "@/components/layout";
import { PwaStatus } from "@/offline/pwa-status";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Financement from "@/pages/financement";
import Devis from "@/pages/devis";
import Depenses from "@/pages/depenses";
import Infrastructure from "@/pages/infrastructure";
import Bandes from "@/pages/bandes/index";
import BandeDetailView from "@/pages/bandes/[id]";
import HistoriqueCaisse from "@/pages/historique-caisse";
import ComparaisonBandes from "@/pages/comparaison-bandes";
import ActivityLog from "@/pages/activity-log";
import Utilisateurs from "@/pages/utilisateurs";
import Parametres from "@/pages/parametres";
import Stocks from "@/pages/stocks";
import Simulation from "@/pages/simulation";
import Tresorerie from "@/pages/tresorerie";
import Planification from "@/pages/planification";
import "@/offline/db";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7,

      retry: (failureCount, error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          (error as { status: number }).status === 401
        ) {
          return false;
        }

        return failureCount < 2;
      },
    },
  },
});

const queryPersister = createAsyncStoragePersister({
  storage: queryStorage,
  key: "farm-manager-query-cache",
  throttleTime: 1000,
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      
      <Route path="/dashboard">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/financement">
        <Layout><Financement /></Layout>
      </Route>
      <Route path="/devis">
        <Layout><Devis /></Layout>
      </Route>
      <Route path="/depenses">
        <Layout><Depenses /></Layout>
      </Route>
      <Route path="/infrastructure">
        <Layout><Infrastructure /></Layout>
      </Route>
      <Route path="/bandes" component={() => <Layout><Bandes /></Layout>} />
      <Route path="/bandes/:id" component={() => <Layout><BandeDetailView /></Layout>} />
      <Route path="/historique-caisse">
        <Layout><HistoriqueCaisse /></Layout>
      </Route>
      <Route path="/comparaison-bandes">
        <Layout><ComparaisonBandes /></Layout>
      </Route>
      <Route path="/activity-log">
        <Layout><ActivityLog /></Layout>
      </Route>
      <Route path="/utilisateurs">
        <Layout><Utilisateurs /></Layout>
      </Route>
      <Route path="/parametres">
        <Layout><Parametres /></Layout>
      </Route>
      <Route path="/stocks">
        <Layout><Stocks /></Layout>
      </Route>
      <Route path="/simulation">
        <Layout><Simulation /></Layout>
      </Route>
      <Route path="/tresorerie">
        <Layout><Tresorerie /></Layout>
      </Route>
      <Route path="/planification">
        <Layout><Planification /></Layout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,

        dehydrateOptions: {
          shouldDehydrateMutation: () => false,

          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            query.queryKey[0] !== "/api/auth/me",
        },
    }}
  >
      <NetworkProvider>
        <TooltipProvider>
          <WouterRouter
            base={import.meta.env.BASE_URL?.replace(/\/$/, "")}
          >
            <Router />
          </WouterRouter>

          <PwaStatus />
          <Toaster />
        </TooltipProvider>
      </NetworkProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
