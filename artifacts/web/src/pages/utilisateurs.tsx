import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Shield, Users } from "lucide-react";

type UserInfo = {
  id: number;
  username: string;
  nom: string;
  role: string;
  createdAt: string;
};

type NewUserForm = {
  nom: string;
  username: string;
  password: string;
  role: string;
};

const ROLES = [
  { value: "admin", label: "Administrateur", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "gestionnaire", label: "Gestionnaire", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "investisseur", label: "Investisseur", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "lecteur", label: "Lecteur", color: "bg-gray-100 text-gray-800 border-gray-200" },
];

const EMPTY_FORM: NewUserForm = {
  nom: "",
  username: "",
  password: "",
  role: "lecteur",
};

export default function Utilisateurs() {
  const { data: currentUser } = useGetMe();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(EMPTY_FORM);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
  const isAdmin = currentUser?.role === "admin";

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${baseUrl}/auth/users`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);

    try {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUser),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de créer le compte");

      toast({
        title: "Utilisateur créé",
        description: `${data.user.nom} peut maintenant se connecter avec l'identifiant ${data.user.username}.`,
      });
      setDialogOpen(false);
      setNewUser(EMPTY_FORM);
      await fetchUsers();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const res = await fetch(`${baseUrl}/auth/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Rôle mis à jour" });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (userId: number, nom: string) => {
    if (!confirm(`Supprimer le compte de ${nom} ? Cette action est irréversible.`)) return;
    try {
      const res = await fetch(`${baseUrl}/auth/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Compte supprimé" });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-serif text-foreground">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les comptes et les droits d'accès</p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open && !creating) setNewUser(EMPTY_FORM);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateUser}>
                <DialogHeader>
                  <DialogTitle>Ajouter un utilisateur</DialogTitle>
                  <DialogDescription>
                    Créez un compte et définissez directement son rôle dans l'application.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-user-name">Nom complet</Label>
                    <Input
                      id="new-user-name"
                      value={newUser.nom}
                      onChange={(e) => setNewUser(prev => ({ ...prev, nom: e.target.value }))}
                      placeholder="Ex. Jean Dupont"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-user-username">Identifiant</Label>
                    <Input
                      id="new-user-username"
                      value={newUser.username}
                      onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Ex. jean.dupont"
                      autoComplete="username"
                      minLength={3}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-user-password">Mot de passe temporaire</Label>
                    <Input
                      id="new-user-password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="6 caractères minimum"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Rôle</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(role) => setNewUser(prev => ({ ...prev, role }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={creating}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Création..." : "Créer le compte"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role.value).length;
          return (
            <Card key={role.value} className="shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{role.label}s</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
                <Badge variant="outline" className={role.color}>{role.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tous les utilisateurs ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nom</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Inscription</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => {
                const isCurrentUser = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.nom}
                      {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(vous)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.username}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(val) => handleRoleChange(u.id, val)}
                        disabled={isCurrentUser}
                      >
                        <SelectTrigger className="w-[160px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.createdAt ? format(new Date(u.createdAt), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isCurrentUser && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u.id, u.nom)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-l-4 border-l-blue-400">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Shield className="h-4 w-4" /> Description des rôles</h3>
          <div className="grid gap-2 text-sm">
            <div><span className="font-medium">Administrateur</span> : Accès complet à toutes les fonctionnalités, gestion des utilisateurs</div>
            <div><span className="font-medium">Gestionnaire</span> : Peut ajouter et modifier les dépenses, bandes, ventes</div>
            <div><span className="font-medium">Investisseur</span> : Consultation du financement, historique caisse, comparaisons</div>
            <div><span className="font-medium">Lecteur</span> : Accès en lecture seule au tableau de bord et aux données principales</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
