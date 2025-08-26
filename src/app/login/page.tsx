
'use client';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { Landmark, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email({ message: "Por favor, introduce un correo válido." }),
  password: z.string().min(1, { message: "La contraseña no puede estar vacía." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { signInWithEmailAndPassword, user, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);
    
    if (loading || user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const onSubmit = async (data: LoginFormValues) => {
        setIsSubmitting(true);
        try {
            await signInWithEmailAndPassword(data.email, data.password);
            // onAuthStateChanged will handle the redirect
        } catch (error: any) {
             toast({
                title: "Error de autenticación",
                description: "Las credenciales son incorrectas. Por favor, inténtelo de nuevo.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm text-center">
                <div className="flex justify-center items-center gap-2 mb-8">
                     <Landmark className="h-8 w-8 text-primary" />
                     <h1 className="text-3xl font-bold tracking-tight">LendEasy</h1>
                </div>
                <Card className="bg-card p-8 rounded-lg shadow-lg border text-left">
                     <h2 className="text-2xl font-semibold mb-2 text-center">Bienvenido de Nuevo</h2>
                     <p className="text-muted-foreground mb-6 text-center">Ingresa tus credenciales para acceder.</p>
                     <Form {...form}>
                         <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Correo Electrónico</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="tu@correo.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contraseña</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <Button type="submit" className="w-full" disabled={isSubmitting}>
                                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                 Iniciar Sesión
                            </Button>
                         </form>
                     </Form>
                     <p className="text-sm text-muted-foreground mt-6 text-center">
                         ¿No tienes una cuenta?{' '}
                         <Link href="/signup" className="font-semibold text-primary hover:underline">
                             Regístrate
                         </Link>
                     </p>
                </Card>
                <p className="text-xs text-muted-foreground mt-8">© {new Date().getFullYear()} LendEasy. Todos los derechos reservados.</p>
            </div>
        </div>
    );
}
