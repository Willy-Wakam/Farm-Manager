import { useGetActivityLog } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function ActivityLog() {
  const { data: entries, isLoading, error } = useGetActivityLog();

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Chargement...</div>;
  if (error) return <div className="text-destructive p-4">Erreur de chargement du journal d'activité.</div>;

  const items = (entries || []) as unknown as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Journal d'activité</h1>
        <p className="text-muted-foreground mt-1">Historique des actions effectuées sur la plateforme</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Dernières activités
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Aucune activité enregistrée.</div>
          ) : (
            <div className="space-y-1">
              {items.map((entry) => (
                <div key={entry.id as number} className="flex items-start gap-4 p-3 rounded-md hover:bg-muted/30 transition-colors border-b last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{entry.userNom as string}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.createdAt ? new Date(entry.createdAt as string).toLocaleString("fr-FR") : ""}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5">{entry.action as string}</p>
                    {Boolean(entry.details) && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.details as string}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
