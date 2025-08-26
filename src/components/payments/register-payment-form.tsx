
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
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import {CalendarIcon} from 'lucide-react';
import {Calendar} from '@/components/ui/calendar';
import {format, addMonths} from 'date-fns';
import {es} from 'date-fns/locale';
import type {Payment, Loan} from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';

const paymentSchema = z.object({
  paymentDate: z.date({required_error: 'La fecha de pago es obligatoria.'}),
  amountPaid: z.coerce.number().min(0.01, 'El valor abonado debe ser mayor a 0.'),
  paymentMethod: z.enum(['Efectivo', 'Transferencia', 'Consignación', 'Otro']),
  observations: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface RegisterPaymentFormProps {
  payment: Payment;
  children: React.ReactNode;
}

export function RegisterPaymentForm({payment, children}: RegisterPaymentFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);

  const remainingAmount = payment.amount - (payment.amountPaid || 0);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentDate: new Date(),
      amountPaid: 0,
      paymentMethod: 'Efectivo',
      observations: '',
    },
  });
  
  const interestPayment = loan ? loan.outstandingBalance * (loan.interestRate / 100) : 0;
  
  useEffect(() => {
    if (open) {
      const fetchLoan = async () => {
        if(payment.loanId) {
          const loanRef = doc(db, 'loans', payment.loanId);
          const loanSnap = await getDoc(loanRef);
          if (loanSnap.exists()) {
            setLoan({ id: loanSnap.id, ...loanSnap.data() } as Loan);
          }
        }
      }
      fetchLoan();
    }
  }, [open, payment.loanId]);

  useEffect(() => {
      if(open && loan) {
        let defaultAmount = 0;
        if (loan.loanType === 'Solo Interes') {
          defaultAmount = interestPayment;
        } else {
          defaultAmount = remainingAmount > 0 ? remainingAmount : 0;
        }

        form.reset({
          paymentDate: new Date(),
          amountPaid: parseFloat(defaultAmount.toFixed(2)),
          paymentMethod: 'Efectivo',
          observations: '',
        });
      }
  }, [open, loan, interestPayment, remainingAmount, form]);


  const onSubmit = async (data: PaymentFormValues) => {
    if (!payment.loanId || !user || !loan) {
         toast({
            title: 'Error',
            description: 'No se pudo registrar el pago. Falta información del préstamo o de la sesión.',
            variant: 'destructive',
         });
         return;
    }
    setIsSubmitting(true);
    
    try {
        const loanRef = doc(db, 'loans', payment.loanId);
        const schedule = loan.paymentSchedule.map(p => ({...p}));
        let currentInstallment = schedule.find(p => p.id === payment.id);

        if (!currentInstallment) {
            currentInstallment = schedule.find(p => p.status !== 'Pagado');
        }

        if (!currentInstallment) {
            toast({ title: 'Error', description: 'No se encontró una cuota pendiente para pagar.', variant: 'destructive' });
            setIsSubmitting(false);
            return;
        }

        if (loan.loanType === 'Solo Interes') {
            const totalToPayOff = loan.outstandingBalance + interestPayment;
            const isPayingFullDebt = Math.abs(data.amountPaid - totalToPayOff) < 0.01;

            if (isPayingFullDebt) {
                currentInstallment.amountPaid = (currentInstallment.amountPaid || 0) + data.amountPaid;
                currentInstallment.paidDate = format(data.paymentDate, 'yyyy-MM-dd');
                currentInstallment.registeredBy = user.email;
                currentInstallment.status = 'Pagado';
                
                await updateDoc(loanRef, {
                    paymentSchedule: schedule,
                    outstandingBalance: 0,
                    status: 'Pagado',
                });
                toast({
                    title: 'Préstamo Saldado',
                    description: `El préstamo ha sido pagado en su totalidad.`,
                });
            } else if (data.amountPaid >= interestPayment) {
                currentInstallment.status = 'Pagado';
                currentInstallment.paidDate = format(data.paymentDate, 'yyyy-MM-dd');
                currentInstallment.registeredBy = user.email;
                currentInstallment.amountPaid = data.amountPaid;

                const capitalPaid = data.amountPaid - interestPayment;
                const newOutstandingBalance = loan.outstandingBalance - capitalPaid;
                
                if (newOutstandingBalance < 1) {
                    await updateDoc(loanRef, {
                        paymentSchedule: schedule,
                        outstandingBalance: 0,
                        status: 'Pagado',
                    });
                     toast({ title: 'Préstamo Saldado', description: `El préstamo ha sido pagado en su totalidad.` });
                } else {
                    const nextInterest = newOutstandingBalance * (loan.interestRate / 100);

                    const newInterestInstallment: Payment = {
                        id: `${loan.id}-${Date.now()}-interest`,
                        loanId: loan.id,
                        amount: newOutstandingBalance + nextInterest,
                        dueDate: format(addMonths(new Date(currentInstallment.dueDate.replace(/-/g, '/')), 1), 'yyyy-MM-dd'),
                        status: 'Pendiente',
                        amountPaid: 0,
                        paidDate: null,
                        registeredBy: null,
                    };
                    schedule.push(newInterestInstallment);
                    
                    await updateDoc(loanRef, {
                        paymentSchedule: schedule,
                        outstandingBalance: newOutstandingBalance,
                        status: 'Activo'
                    });

                    toast({
                        title: 'Pago de Interés Registrado',
                        description: `El pago se registró y se ha generado la cuota para el próximo mes.`,
                    });
                }
            } else { // Partial interest payment
                 currentInstallment.amountPaid = (currentInstallment.amountPaid || 0) + data.amountPaid;
                 currentInstallment.paidDate = format(data.paymentDate, 'yyyy-MM-dd');
                 currentInstallment.registeredBy = user.email;

                 await updateDoc(loanRef, {
                    paymentSchedule: schedule
                 });
                  toast({
                    title: 'Abono Registrado',
                    description: `Se registró un abono parcial al interés. El interés completo no ha sido cubierto.`,
                    variant: 'default',
                });
            }

        } else {
            // Standard payment logic for amortized loans
            let amountToApply = data.amountPaid;
            let currentInstallmentIndex = schedule.findIndex(p => p.id === payment.id);
            if (currentInstallmentIndex === -1) {
                 currentInstallmentIndex = schedule.findIndex(p => p.status !== 'Pagado');
            }
            
            while(amountToApply > 0 && currentInstallmentIndex < schedule.length) {
                const installment = schedule[currentInstallmentIndex];

                if (installment.status === 'Pagado') {
                    currentInstallmentIndex++;
                    continue;
                }

                const remainingForInstallment = installment.amount - (installment.amountPaid || 0);
                
                if (amountToApply >= remainingForInstallment) {
                    installment.amountPaid = installment.amount;
                    installment.status = 'Pagado';
                    installment.paidDate = format(data.paymentDate, 'yyyy-MM-dd');
                    installment.registeredBy = user.email;
                    amountToApply -= remainingForInstallment;
                } else {
                    installment.amountPaid = (installment.amountPaid || 0) + amountToApply;
                    installment.status = new Date(installment.dueDate.replace(/-/g, '/')) < new Date(format(new Date(), 'yyyy-MM-dd')) ? 'Atrasado' : 'Pendiente';
                    installment.paidDate = format(data.paymentDate, 'yyyy-MM-dd'); // also log partial payment date
                    installment.registeredBy = user.email;
                    amountToApply = 0;
                }
                currentInstallmentIndex++;
            }

            const newOutstandingBalance = loan.outstandingBalance - data.amountPaid;
            const isLoanFullyPaid = schedule.every(p => p.status === 'Pagado');
            const newLoanStatus = isLoanFullyPaid ? 'Pagado' : loan.status;

            await updateDoc(loanRef, {
                paymentSchedule: schedule,
                outstandingBalance: newOutstandingBalance < 0 ? 0 : newOutstandingBalance,
                status: newLoanStatus,
            });

             toast({
                title: 'Pago Registrado',
                description: `El pago de $${data.amountPaid.toFixed(2)} se ha registrado exitosamente.`,
            });
        }
        
        setOpen(false);

    } catch (error) {
        console.error('Error registering payment:', error);
        toast({
            title: 'Error',
            description: 'Hubo un problema al registrar el pago. Por favor, inténtelo de nuevo.',
            variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const totalPayment = loan ? loan.outstandingBalance + interestPayment : 0;


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
          {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Registre el abono para la cuota con vencimiento el {format(new Date(payment.dueDate.replace(/-/g, '/')), 'dd MMMM, yyyy')}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 text-sm bg-muted/50 p-3 rounded-md">
            {loan?.loanType === 'Solo Interes' ? (
                 <>
                    <div>
                        <p className='text-muted-foreground'>Pago de Interés:</p>
                        <p className='font-bold'>${interestPayment.toLocaleString('es-CO', {maximumFractionDigits: 0})}</p>
                    </div>
                    <div>
                        <p className='text-muted-foreground'>Pago Total (Capital + Interés):</p>
                        <p className='font-bold'>${totalPayment.toLocaleString('es-CO', {maximumFractionDigits: 0})}</p>
                    </div>
                 </>
            ) : (
                <>
                    <div>
                        <p className='text-muted-foreground'>Monto de la cuota:</p>
                        <p className='font-bold'>${payment.amount.toLocaleString('es-CO', {maximumFractionDigits: 0})}</p>
                    </div>
                    <div>
                        <p className='text-muted-foreground'>Pendiente por pagar:</p>
                        <p className='font-bold'>${remainingAmount.toLocaleString('es-CO', {maximumFractionDigits: 0})}</p>
                    </div>
                </>
            )}
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amountPaid"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Valor a abonar ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="paymentDate"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Fecha del pago</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', {locale: es})
                            ) : (
                              <span>Seleccione fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          locale={es}
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Método de pago</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Consignación">Consignación</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
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
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anotaciones sobre el pago..."
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
                 {isSubmitting ? 'Guardando...' : 'Guardar Pago'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
