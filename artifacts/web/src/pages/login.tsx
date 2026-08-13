import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { UserPlus, Lock, User, ArrowRight } from "lucide-react";
import { useLogin, useGetMe } from "@workspace/api-client-react";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { saveOfflineUser } from "@/offline/auth";
import { prefetchOfflineData } from "@/offline/prefetch";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useNomFerme } from "@/lib/ferme";

const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

const registerSchema = z.object({
  nom: z.string().min(2, "Le nom complet est requis"),
  username: z.string().min(3, "Minimum 3 caracteres"),
  password: z.string().min(6, "Minimum 6 caracteres"),
  passwordConfirm: z.string().min(1, "Confirmez le mot de passe"),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Les mots de passe ne correspondent pas",
  path: ["passwordConfirm"],
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const loginMutation = useLogin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const nomFerme = useNomFerme();

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { nom: "", username: "", password: "", passwordConfirm: "" },
  });

async function onSubmit(values: z.infer<typeof loginSchema>) {
  try {
    const result = await loginMutation.mutateAsync({
      data: values,
    });

    await saveOfflineUser({
      id: result.user.id,
      username: result.user.username,
      nom: result.user.nom,
      role: result.user.role,
    });

    await prefetchOfflineData(queryClient);

    console.log(
      "[offline-auth] Utilisateur sauvegardé :",
      result.user,
    );

    await queryClient.invalidateQueries({
      queryKey: getGetMeQueryKey(),
    });

    toast({
      title: "Connexion reussie",
      description: "Bienvenue dans l'espace de gestion.",
    });

    setLocation("/dashboard");
  } catch (error) {
    console.error("[login] Erreur :", error);

    toast({
      title: "Erreur de connexion",
      description: "Verifiez vos identifiants.",
      variant: "destructive",
    });
  }
}

  async function onRegister(values: z.infer<typeof registerSchema>) {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: values.nom, username: values.username, password: values.password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast({ title: "Compte cree", description: "Vous pouvez maintenant vous connecter." });
      setIsRegistering(false);
      form.reset({ username: values.username, password: "" });
      registerForm.reset();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de creer le compte.", variant: "destructive" });
    }
  }

  if (isUserLoading || user) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-primary">Chargement...</div>;
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/farm-hero.jpg`}
          alt="Ferme avicole"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/20" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
              {nomFerme}
            </h1>
            <p className="text-xl text-white/80 leading-relaxed mb-2">
              Plateforme de gestion avicole
            </p>
            <p className="text-base text-white/60 leading-relaxed">
              Suivez vos bandes de poulets, vos depenses de construction, vos investissements et la rentabilite de votre exploitation.
            </p>
            <div className="flex gap-6 mt-8 pt-8 border-t border-white/20">
              <div>
                <div className="text-2xl font-bold">100%</div>
                <div className="text-sm text-white/60">Suivi en temps reel</div>
              </div>
              <div>
                <div className="text-2xl font-bold">PDF</div>
                <div className="text-sm text-white/60">Rapports detailles</div>
              </div>
              <div>
                <div className="text-2xl font-bold">Multi</div>
                <div className="text-sm text-white/60">Utilisateurs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 bg-[#FAFAF7]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-10 text-center">
            <h1 className="text-3xl font-bold text-foreground">{nomFerme}</h1>
            <p className="text-muted-foreground mt-1">Plateforme de gestion avicole</p>
          </div>

          {!isRegistering ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Bon retour</h2>
                <p className="text-muted-foreground mt-1">Connectez-vous a votre espace de gestion</p>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Nom d'utilisateur</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Votre identifiant" className="pl-10 h-11 bg-white border-border/80" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="password" placeholder="Votre mot de passe" className="pl-10 h-11 bg-white border-border/80" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full h-11 text-base font-semibold gap-2" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Connexion en cours..." : (
                      <>Se connecter <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              </Form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-[#FAFAF7] px-3 text-muted-foreground">ou</span></div>
              </div>
              <button type="button" onClick={() => setIsRegistering(true)} className="w-full flex items-center justify-center gap-2 h-11 rounded-md border border-border/80 bg-white text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
                <UserPlus className="h-4 w-4" />
                Creer un nouveau compte
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Creer un compte</h2>
                <p className="text-muted-foreground mt-1">Votre compte sera en lecture seule par defaut</p>
              </div>
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <FormField control={registerForm.control} name="nom" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Nom complet</FormLabel>
                      <FormControl><Input placeholder="Ex: Jean Dupont" className="h-11 bg-white border-border/80" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Nom d'utilisateur</FormLabel>
                      <FormControl><Input placeholder="Ex: jean" className="h-11 bg-white border-border/80" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Mot de passe</FormLabel>
                      <FormControl><Input type="password" placeholder="Minimum 6 caracteres" className="h-11 bg-white border-border/80" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="passwordConfirm" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Confirmer le mot de passe</FormLabel>
                      <FormControl><Input type="password" placeholder="Retapez le mot de passe" className="h-11 bg-white border-border/80" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full h-11 text-base font-semibold">
                    Creer mon compte
                  </Button>
                </form>
              </Form>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                Deja un compte ? Se connecter
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/60 mt-8">
            {nomFerme} &mdash; Gestion avicole
          </p>
        </div>
      </div>
    </div>
  );
}
