
'use client';
import { useState, useEffect } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { FundSource } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from '@/components/ui/alert-dialog';


const fundSourceSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
});

type FundSourceFormValues = z.infer<typeof fundSourceSchema>;

export function FundSourcesManager() {
  const [fundSources, setFundSources] = useState<FundSource[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<FundSourceFormValues>({
    resolver: zodResolver(fundSourceSchema),
    defaultValues: { name: '' },
  });
  const { isSubmitting } = useFormState({ control: form.control });


  useEffect(() => {
    const q = query(collection(db, 'fundSources'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sources: FundSource[] = [];
      snapshot.forEach((doc) => {
        sources.push({ id: doc.id, ...(doc.data() as {name: string}) });
      });
      setFundSources(sources);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onSubmit = async (data: FundSourceFormValues) => {
    try {
      await addDoc(collection(db, 'fundSources'), {
        name: data.name,
        createdAt: serverTimestamp(),
      });
      toast({
        title: 'Fuente de Fondos Creada',
        description: `La fuente "${data.name}" se ha añadido exitosamente.`,
      });
      form.reset();
    } catch (error) {
      console.error('Error adding fund source: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo añadir la fuente de fondos.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, "fundSources", id));
         toast({
            title: 'Fuente Eliminada',
            description: `La fuente de fondos ha sido eliminada.`,
         });
    } catch (error) {
        console.error("Error deleting fund source: ", error);
        toast({
            title: 'Error',
            description: 'No se pudo eliminar la fuente de fondos.',
            variant: 'destructive',
        });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestionar Fuentes de Fondos</CardTitle>
        <CardDescription>
          Añade, edita o elimina las fuentes de donde proviene el dinero para los préstamos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-medium mb-4">Añadir Nueva Fuente</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Fuente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Capital Personal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Añadiendo..." : "Añadir Fuente"}
              </Button>
            </form>
          </Form>
        </div>
        <div>
          <h3 className="text-lg font-medium mb-4">Fuentes Existentes</h3>
           <div className="space-y-2">
             {loading ? <p>Cargando...</p> : 
                fundSources.length > 0 ? (
                    fundSources.map((source) => (
                        <div key={source.id} className="flex items-center justify-between p-2 rounded-md border">
                            <span className="text-sm">{source.name}</span>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Esto eliminará permanentemente la fuente de fondos.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(source.id)}>Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground">No hay fuentes de fondos creadas.</p>
                )
             }
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
