
'use client';
import {useEffect, useState} from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Textarea} from '@/components/ui/textarea';
import {useToast} from '@/hooks/use-toast';
import type {Borrower} from '@/lib/types';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';


const borrowerSchema = z.object({
  firstName: z.string().min(1, {message: 'El nombre es obligatorio.'}),
  lastName: z.string().optional(),
  idNumber: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['Activo', 'Moroso', 'Bloqueado', 'Finalizado']),
  observations: z.string().optional(),
});

type BorrowerFormValues = z.infer<typeof borrowerSchema>;

interface AddBorrowerFormProps {
  borrower?: Borrower;
  children: React.ReactNode;
}

export function AddBorrowerForm({ borrower, children }: AddBorrowerFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();
  const isEditMode = !!borrower;

  const form = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      idNumber: '',
      phone: '',
      address: '',
      status: 'Activo',
      observations: '',
    },
  });

  useEffect(() => {
    if (borrower) {
      form.reset({
        firstName: borrower.firstName,
        lastName: borrower.lastName,
        idNumber: borrower.idNumber,
        phone: borrower.phone,
        address: borrower.address,
        status: borrower.status,
        observations: '', // Observations are not part of the model yet
      });
    } else {
        form.reset({
             firstName: '',
            lastName: '',
            idNumber: '',
            phone: '',
            address: '',
            status: 'Activo',
            observations: '',
        });
    }
  }, [borrower, form, open]);

  const onSubmit = async (data: BorrowerFormValues) => {
    setIsSubmitting(true);
    const fullName = `${data.firstName} ${data.lastName || ''}`.trim();
    
    const dataToSave = {
        ...data,
        lastName: data.lastName || '',
        idNumber: data.idNumber || '',
        phone: data.phone || '',
        address: data.address || ''
    };

    try {
       if (isEditMode && borrower?.id) {
         const borrowerRef = doc(db, 'borrowers', borrower.id);
         await updateDoc(borrowerRef, dataToSave);
       } else {
         await addDoc(collection(db, 'borrowers'), {
           ...dataToSave,
           createdAt: serverTimestamp(),
         });
       }
      
      toast({
        title: isEditMode ? 'Cliente Actualizado' : 'Cliente Creado',
        description: `El cliente ${fullName} ha sido ${isEditMode ? 'actualizado' : 'registrado'} exitosamente.`,
      });
      setOpen(false);

    } catch (error) {
       console.error("Error saving borrower: ", error);
       toast({
         title: 'Error',
         description: `Hubo un problema al guardar el cliente. Por favor, inténtelo de nuevo.`,
         variant: 'destructive',
       });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Cliente': 'Registrar Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Modifique los datos del cliente.' : 'Complete los campos para agregar un nuevo prestatario.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="firstName"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="lastName"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             </div>
            <FormField
              control={form.control}
              name="idNumber"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Número de documento (cédula)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 12345678A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Teléfono principal</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 611223344" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Dirección completa</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Calle Falsa 123, Madrid" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Activo">Activo</SelectItem>
                      <SelectItem value="Moroso">Moroso</SelectItem>
                      <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      <SelectItem value="Finalizado">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="observations"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Observaciones generales</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anotaciones importantes sobre el cliente..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Guardar Cliente'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
