'use client';
import {useState} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {useToast} from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';


const bulkAddSchema = z.object({
  file: z.instanceof(FileList)
    .refine((files) => files?.length === 1, 'Debe seleccionar un archivo.')
    .refine((files) => files?.[0]?.type === 'text/csv', 'El archivo debe ser de tipo CSV.'),
});

type BulkAddFormValues = z.infer<typeof bulkAddSchema>;

interface BulkAddBorrowersFormProps {
  children: React.ReactNode;
}

export function BulkAddBorrowersForm({ children }: BulkAddBorrowersFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();
  const [fileName, setFileName] = useState('');
  const [borrowerCount, setBorrowerCount] = useState(0);

  const form = useForm<BulkAddFormValues>({
    resolver: zodResolver(bulkAddSchema)
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n').filter(Boolean);
        setBorrowerCount(lines.length);
      };
      reader.readAsText(file);
       // Manually trigger validation for the file input
      form.setValue('file', e.target.files as FileList, { shouldValidate: true });
    } else {
      setFileName('');
      setBorrowerCount(0);
    }
  };


  const onSubmit = async (data: BulkAddFormValues) => {
    setIsSubmitting(true);
    const file = data.file[0];
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n').filter(Boolean);
    
        if (lines.length === 0) {
             toast({
               title: 'Error',
               description: 'El archivo está vacío.',
               variant: 'destructive',
             });
             setIsSubmitting(false);
             return;
        }
        
        const batch = writeBatch(db);
        let newBorrowersCount = 0;

        try {
            lines.forEach((line, index) => {
                const [firstName, lastName, idNumber, phone, address] = line.split(',').map(item => item.trim());

                if (!firstName || !lastName || !idNumber || !phone || !address) {
                    throw new Error(`Error en la línea ${index + 1}: Faltan datos. Asegúrese de que cada línea tenga 5 campos separados por comas.`);
                }

                const borrowerRef = doc(collection(db, 'borrowers'));
                batch.set(borrowerRef, {
                    firstName,
                    lastName,
                    idNumber,
                    phone,
                    address,
                    status: 'Activo',
                    createdAt: serverTimestamp()
                });
                newBorrowersCount++;
            });

            await batch.commit();
          
            toast({
                title: 'Carga Exitosa',
                description: `${newBorrowersCount} clientes han sido registrados exitosamente.`,
            });
            setOpen(false);
            form.reset();
            setFileName('');
            setBorrowerCount(0);

        } catch (error: any) {
           console.error("Error saving bulk borrowers: ", error);
           toast({
             title: 'Error en la Carga',
             description: error.message || 'Hubo un problema al guardar los clientes. Por favor, revise el formato e inténtelo de nuevo.',
             variant: 'destructive',
           });
        } finally {
            setIsSubmitting(false);
        }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            form.reset();
            setFileName('');
            setBorrowerCount(0);
        }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Carga Masiva de Clientes</DialogTitle>
          <DialogDescription>
            Seleccione un archivo en formato CSV para cargar múltiples clientes a la vez.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-semibold">Formato requerido en el archivo CSV:</p>
            <p>Cada cliente debe estar en una nueva línea y los campos deben estar en el siguiente orden, separados por comas:</p>
            <code>nombre,apellido,cedula,telefono,direccion</code>
            <p className="mt-2">Ejemplo:</p>
            <code>Maria,Lopez,98765432B,655443322,Avenida Siempre Viva 742</code>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Archivo de Clientes (.csv)</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept=".csv"
                      onChange={handleFileChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {fileName && (
              <div className="text-sm text-muted-foreground">
                Archivo seleccionado: <strong>{fileName}</strong>. Se encontraron <strong>{borrowerCount}</strong> clientes.
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !fileName}>
                {isSubmitting ? 'Guardando...' : `Guardar ${borrowerCount} Clientes`}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
