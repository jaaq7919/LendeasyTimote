
'use client';
import {useEffect, useMemo, useState} from 'react';
import {useForm, useWatch} from 'react-hook-form';
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
import {CalendarIcon, Check, ChevronsUpDown} from 'lucide-react';
import {Calendar} from '@/components/ui/calendar';
import {format, addDays, addWeeks, addMonths, differenceInDays} from 'date-fns';
import {es} from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {ScrollArea} from '@/components/ui/scroll-area';
import type { Borrower, Payment, FundSource } from '@/lib/types';
import { db } from '@/lib/firebase';
import { addDoc, collection, onSnapshot, serverTimestamp, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const loanSchema = z.object({
  borrowerId: z.string().min(1, { message: "Debe seleccionar un cliente." }),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0.'),
  interestRate: z.coerce.number().min(0, 'La tasa de interés no puede ser negativa.'),
  installments: z.coerce.number().int().min(1, 'Debe haber al menos una cuota.').optional(),
  periodicity: z.enum(['Diario', 'Semanal', 'Quincenal', 'Mensual']).optional(),
  startDate: z.date({required_error: 'La fecha de inicio es obligatoria.'}),
  loanType: z.enum(['Amortizado', 'Solo Interes', 'Interes Mensual Fijo']),
  fundSource: z.string().min(1, { message: 'Debe seleccionar una fuente de fondos.' }),
  observations: z.string().optional(),
  status: z.enum(['Activo', 'Pagado', 'Moroso', 'Cancelado']),
});

type LoanFormValues = z.infer<typeof loanSchema>;

interface AddLoanFormProps {
  borrowerId?: string;
  children: React.ReactNode;
}

export function AddLoanForm({borrowerId, children}: AddLoanFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [fundSources, setFundSources] = useState<FundSource[]>([]);
  const {toast} = useToast();
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const defaultValues: Partial<LoanFormValues> = {
    borrowerId: borrowerId || '',
    amount: 0,
    interestRate: 10,
    installments: 12,
    periodicity: 'Mensual',
    startDate: new Date(),
    loanType: 'Amortizado',
    fundSource: '',
    observations: '',
    status: 'Activo',
  };

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: defaultValues as LoanFormValues,
  });
  
  const { amount, installments, interestRate, periodicity, startDate, loanType } = useWatch({
    control: form.control,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    
    const fsq = query(collection(db, 'fundSources'), orderBy('name'));
    const unsubFundSources = onSnapshot(fsq, (snapshot) => {
      const sourcesData: FundSource[] = [];
      snapshot.forEach(doc => {
        sourcesData.push({ id: doc.id, ...(doc.data() as { name: string }) });
      });
      setFundSources(sourcesData);
      if (sourcesData.length > 0 && !form.getValues('fundSource')) {
        form.setValue('fundSource', sourcesData[0].name);
      }
    });

    let unsubBorrowers = () => {};
    if (!borrowerId) {
      const q = query(collection(db, 'borrowers'), orderBy('firstName'));
      unsubBorrowers = onSnapshot(q, (snapshot) => {
        const borrowersData: Borrower[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          borrowersData.push({
            id: doc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            idNumber: data.idNumber,
            phone: data.phone,
            address: data.address,
            status: data.status,
            createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString()
          });
        });
        setBorrowers(borrowersData);
      });
    }
    
    return () => {
      unsubFundSources();
      unsubBorrowers();
    };
  }, [borrowerId, open, form]);


  useEffect(() => {
    if (open) {
        form.reset(defaultValues as LoanFormValues);
    }
  }, [borrowerId, form, open]);


  const calculatedValues = useMemo(() => {
    const numericAmount = Number(amount);
    const numericInstallments = Number(installments) || 1;
    const numericInterestRate = Number(interestRate);

    if (isNaN(numericAmount) || isNaN(numericInstallments) || isNaN(numericInterestRate) || numericAmount <= 0 || !startDate) {
      return {total: 0, installmentAmount: 0, endDate: null, schedule: []};
    }
    
    const rate = numericInterestRate / 100;
    const schedule: {dueDate: string; amount: number, status: Payment['status']}[] = [];
    
    const addPeriod = (date: Date, count: number) => {
      if (!periodicity) return addMonths(date, count);
      if (periodicity === 'Diario') return addDays(date, count);
      if (periodicity === 'Semanal') return addWeeks(date, count);
      if (periodicity === 'Quincenal') return addDays(date, count * 15);
      return addMonths(date, count);
    };

    let total = 0;
    let installmentAmount = 0;
    let endDate: Date | null = null;
    let totalWeeks = 0;

    switch (periodicity) {
      case 'Diario': totalWeeks = (numericInstallments || 0) / 7; break;
      case 'Semanal': totalWeeks = numericInstallments || 0; break;
      case 'Quincenal': totalWeeks = (numericInstallments || 0) * 2; break;
      case 'Mensual': totalWeeks = (numericInstallments || 0) * 4; break;
      default: totalWeeks = (numericInstallments || 0) * 4;
    }

    if (loanType === 'Amortizado' && numericInstallments > 0) {
        const durationInMonths = totalWeeks / 4.0;
        const totalInterest = numericAmount * rate * durationInMonths;
        total = numericAmount + totalInterest;
        const rawInstallmentAmount = total / numericInstallments;
        installmentAmount = Math.floor(rawInstallmentAmount / 100) * 100;

        endDate = addPeriod(startDate, numericInstallments);
        
        let remainingTotal = total;
        for (let i = 0; i < numericInstallments; i++) {
            let currentInstallment = installmentAmount;
            if (i === numericInstallments - 1) {
                currentInstallment = remainingTotal;
            } else {
                remainingTotal -= currentInstallment;
            }
            schedule.push({
                dueDate: format(addPeriod(startDate, i + 1), 'yyyy-MM-dd'),
                amount: currentInstallment,
                status: 'Pendiente'
            })
        }
    } else if (loanType === 'Solo Interes') { 
        const interestPayment = numericAmount * rate;
        total = numericAmount + interestPayment;
        installmentAmount = total; 
        endDate = null;

        schedule.push({
            dueDate: format(addMonths(startDate, 1), 'yyyy-MM-dd'),
            amount: installmentAmount,
            status: 'Pendiente'
        });

    } else if (loanType === 'Interes Mensual Fijo' && numericInstallments > 0) {
        const numberOfMonthsForInterest = Math.max(1, Math.floor(totalWeeks / 4));
        const totalInterest = numericAmount * rate * numberOfMonthsForInterest;
        total = numericAmount + totalInterest;
        const rawInstallmentAmount = total / numericInstallments;
        installmentAmount = Math.floor(rawInstallmentAmount / 100) * 100;
        endDate = addPeriod(startDate, numericInstallments);

        let remainingTotal = total;
        for (let i = 0; i < numericInstallments; i++) {
             let currentInstallment = installmentAmount;
             if (i === numericInstallments - 1) {
                currentInstallment = remainingTotal;
             } else {
                remainingTotal -= currentInstallment;
             }
            schedule.push({
                dueDate: format(addPeriod(startDate, i + 1), 'yyyy-MM-dd'),
                amount: currentInstallment,
                status: 'Pendiente'
            });
        }
    }
    
    return {total, installmentAmount, endDate, schedule};
  }, [amount, interestRate, installments, periodicity, startDate, loanType]);

  const onSubmit = async (data: LoanFormValues) => {
    setIsSubmitting(true);
    
    let outstandingBalance: number;
    if (data.loanType === 'Solo Interes') {
      outstandingBalance = data.amount;
    } else {
      outstandingBalance = calculatedValues.total;
    }

    try {
       const loanDocRef = await addDoc(collection(db, 'loans'), {
        ...data,
        installments: data.installments || null,
        periodicity: data.periodicity || null,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: calculatedValues.endDate ? format(calculatedValues.endDate, 'yyyy-MM-dd') : null,
        outstandingBalance: outstandingBalance,
        paymentSchedule: [],
        createdAt: serverTimestamp(),
      });
      
      const paymentSchedule = calculatedValues.schedule.map((p, i) => ({
        ...p,
        id: `${loanDocRef.id}-${Date.now()}-${i}`,
        loanId: loanDocRef.id,
        paidDate: null,
        amountPaid: 0,
        registeredBy: null
      }));
      
      await updateDoc(loanDocRef, {
        paymentSchedule: paymentSchedule,
      });

      console.log("Loan written with ID: ", loanDocRef.id);

      toast({
        title: 'Préstamo Creado',
        description: `El préstamo ha sido registrado exitosamente.`,
      });
      setOpen(false);
    } catch (error) {
       console.error("Error creating loan:", error);
       toast({
         title: 'Error',
         description: `Hubo un problema al crear el préstamo.`,
         variant: 'destructive',
       });
    } finally {
        setIsSubmitting(false);
    }
  };

  const LoanSummary = () => {
     if (loanType !== 'Amortizado' && loanType !== 'Interes Mensual Fijo' && loanType !== 'Solo Interes') return null;

     const displayTotal = (loanType === 'Amortizado' || loanType === 'Interes Mensual Fijo');
     const displayInstallment = (loanType === 'Amortizado' || loanType === 'Interes Mensual Fijo');
     const hasSchedule = calculatedValues.schedule.length > 0;
     const showSummary = (amount > 0 && (loanType === 'Solo Interes' || (installments && installments > 0)));


     if(!showSummary) return null;

     return (
     <div className="space-y-4 rounded-md bg-muted/50 p-4 border mt-6">
        <h3 className="text-lg font-semibold">Resumen del Préstamo</h3>
        <div className='space-y-2 text-sm'>
            {displayTotal && (
                <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Valor total a pagar:</span>
                    <span className='font-bold'>${calculatedValues.total.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</span>
                </div>
            )}
             {displayInstallment && (
                <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Valor (aprox) de cada cuota:</span>
                    <span className='font-bold'>${calculatedValues.installmentAmount.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</span>
                </div>
             )}
             {loanType === 'Solo Interes' && (
                <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Pago de Interés Mensual:</span>
                    <span className='font-bold'>${(amount * (interestRate/100)).toLocaleString('es-CO', { maximumFractionDigits: 2 })}</span>
                </div>
             )}
             {calculatedValues.endDate && (
                <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Fecha de finalización:</span>
                    <span className='font-bold'>{format(calculatedValues.endDate, 'PPP', { locale: es })}</span>
                </div>
             )}
        </div>
        {hasSchedule && (
        <>
            <h4 className='font-semibold pt-4'>Cronograma de Pagos</h4>
            <ScrollArea className="h-60">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cuota</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calculatedValues.schedule.map((p, i) => (
                            <TableRow key={i}>
                                <TableCell>#{i+1}</TableCell>
                                <TableCell>{format(new Date(p.dueDate.replace(/-/g, '/')), 'PPP', {locale: es})}</TableCell>
                                <TableCell className="text-right">${p.amount.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </>
        )}
    </div>
  )
}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Préstamo</DialogTitle>
          <DialogDescription>
            Complete los campos para crear un nuevo préstamo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
              <div className="space-y-4">
                {!borrowerId && (
                  <FormField
                    control={form.control}
                    name="borrowerId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Cliente</FormLabel>
                        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value
                                  ? `${borrowers.find(
                                      (borrower) => borrower.id === field.value
                                    )?.firstName} ${borrowers.find(
                                      (borrower) => borrower.id === field.value
                                    )?.lastName}`
                                  : "Seleccione un cliente"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar cliente..." />
                              <CommandList>
                                <CommandEmpty>No se encontró el cliente.</CommandEmpty>
                                <CommandGroup>
                                  {borrowers.map((borrower) => (
                                    <CommandItem
                                      value={`${borrower.firstName} ${borrower.lastName} ${borrower.idNumber}`}
                                      key={borrower.id}
                                      onSelect={() => {
                                        form.setValue("borrowerId", borrower.id);
                                        setComboboxOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          borrower.id === field.value
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div>
                                        <p>{borrower.firstName} {borrower.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{borrower.idNumber}</p>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                 <FormField
                  control={form.control}
                  name="loanType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Préstamo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           <SelectItem value="Amortizado">Amortizado (Cuotas fijas)</SelectItem>
                           <SelectItem value="Solo Interes">Solo Interés (Capital al final)</SelectItem>
                           <SelectItem value="Interes Mensual Fijo">Interés Mensual Fijo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Monto del capital inicial ($)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 5000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="interestRate"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Porcentaje de interés mensual (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="fundSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuente de los Fondos</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione una fuente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fundSources.length === 0 ? (
                            <SelectItem value="-" disabled>No hay fuentes creadas</SelectItem>
                          ) : (
                            fundSources.map(source => (
                              <SelectItem key={source.id} value={source.name}>{source.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {loanType !== 'Solo Interes' && (
                  <>
                    <FormField
                      control={form.control}
                      name="installments"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>
                            Número total de cuotas
                          </FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Ej: 12" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="periodicity"
                        render={({field}) => (
                          <FormItem>
                            <FormLabel>Periodicidad</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Diario">Diario</SelectItem>
                                <SelectItem value="Semanal">Semanal</SelectItem>
                                <SelectItem value="Quincenal">Quincenal</SelectItem>
                                <SelectItem value="Mensual">Mensual</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({field}) => (
                          <FormItem>
                            <FormLabel>Fecha de inicio</FormLabel>
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
                                  disabled={(date) => date < new Date('1900-01-01')}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
                
                <FormField
                    control={form.control}
                    name="status"
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Estado del préstamo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Activo">Activo</SelectItem>
                            <SelectItem value="Pagado">Pagado</SelectItem>
                            <SelectItem value="Moroso">Moroso</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
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
                      <FormLabel>Observaciones/acuerdos especiales</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Anotaciones importantes sobre el préstamo..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <LoanSummary />
             
            </ScrollArea>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Préstamo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    