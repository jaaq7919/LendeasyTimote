
'use client';
import type {FC} from 'react';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  User,
  Phone,
  Home,
  Hash,
  ArrowLeft,
  PlusCircle,
  MoreVertical,
  UserCheck,
  Briefcase,
  Type
} from 'lucide-react';
import Link from 'next/link';
import type {Loan, Payment, Borrower} from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddLoanForm } from '@/components/loans/add-loan-form';
import { RegisterPaymentForm } from '@/components/payments/register-payment-form';
import { DropdownMenuTriggerItem } from '@/components/payments/dropdown-menu-trigger-item';
import { collection, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const BorrowerDetailPage: FC = () => {
  const params = useParams();
  const id = params.id as string;
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

   useEffect(() => {
    if (!id) return;

    const unsubBorrower = onSnapshot(doc(db, "borrowers", id), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setBorrower({
            id: doc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            idNumber: data.idNumber,
            phone: data.phone,
            address: data.address,
            status: data.status,
            createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        });
      } else {
        console.log("No such document!");
        setBorrower(null);
      }
      setLoading(false);
    });

    const loansQuery = query(collection(db, 'loans'), where('borrowerId', '==', id), orderBy('createdAt', 'desc'));
    const unsubLoans = onSnapshot(loansQuery, (snapshot) => {
        const loansData: Loan[] = [];
        snapshot.forEach(doc => {
            loansData.push({ id: doc.id, ...doc.data() } as Loan);
        });
        setLoans(loansData);
    });

    return () => {
        unsubBorrower();
        unsubLoans();
    }
  }, [id]);


  if (loading) {
     return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
               <Skeleton className="h-6 w-32" />
               <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
               <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!borrower) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <h2 className="text-2xl font-bold">Cliente no encontrado</h2>
        <p>El cliente que buscas no existe o ha sido eliminado.</p>
         <Button variant="outline" asChild>
            <Link href="/borrowers">Volver a la lista</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <Link
        href="/borrowers"
        className="flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a la lista de clientes
      </Link>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">
          {borrower.firstName} {borrower.lastName}
        </h2>
        <Badge
          variant={
            borrower.status === 'Activo'
              ? 'secondary'
              : borrower.status === 'Moroso'
              ? 'destructive'
              : 'outline'
          }
           className="text-accent-foreground"
        >
          {borrower.status}
        </Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center">
                <User className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>
                  {borrower.firstName} {borrower.lastName}
                </span>
              </div>
              <div className="flex items-center">
                <Hash className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{borrower.idNumber}</span>
              </div>
              <div className="flex items-center">
                <Phone className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{borrower.phone}</span>
              </div>
              <div className="flex items-start">
                <Home className="mr-3 mt-1 h-4 w-4 text-muted-foreground" />
                <span>{borrower.address}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Card>
             <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Préstamos</CardTitle>
                <CardDescription>
                  Historial de préstamos del cliente.
                </CardDescription>
              </div>
              <AddLoanForm borrowerId={borrower.id}>
                <Button size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Préstamo
                </Button>
              </AddLoanForm>
            </CardHeader>
            <CardContent className="space-y-4">
              {loans.map(loan => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
              {loans.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Este cliente no tiene préstamos activos.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};


const LoanCard: FC<{loan: Loan}> = ({ loan }) => {
  const [showAllPayments, setShowAllPayments] = useState(false);

  const paymentsToShow = showAllPayments ? loan.paymentSchedule : loan.paymentSchedule.slice(0, 4);

  return (
    <Card className='bg-background/50'>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className='text-xl'>Préstamo ID: {loan.id.substring(0,7)}...</CardTitle>
            <CardDescription>Inició el {format(new Date(loan.startDate.replace(/-/g, '/')), 'dd MMMM, yyyy')}</CardDescription>
          </div>
          <Badge variant={loan.status === 'Activo' ? 'secondary' : loan.status === 'Moroso' ? 'destructive' : 'default'}  className="text-accent-foreground">{loan.status}</Badge>
        </div>
         <div className="grid grid-cols-2 md:flex md:space-x-6 pt-2 text-sm gap-y-2">
            <div>
              <p className="text-muted-foreground">Monto</p>
              <p className="font-semibold">${loan.amount.toLocaleString('es-CO', {maximumFractionDigits: 0})}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interés</p>
              <p className="font-semibold">{loan.interestRate}%</p>
            </div>
             <div>
              <p className="text-muted-foreground">Saldo Pendiente</p>
              <p className="font-semibold">${loan.outstandingBalance.toLocaleString('es-CO', {maximumFractionDigits: 0})}</p>
            </div>
            {loan.fundSource && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  Fuente
                </p>
                <p className="font-semibold">{loan.fundSource}</p>
              </div>
            )}
            {loan.loanType && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  Tipo
                </p>
                <p className="font-semibold">{loan.loanType}</p>
              </div>
            )}
          </div>
      </CardHeader>
      <CardContent>
        <h4 className="mb-2 font-semibold">Cronograma de Pagos</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuota</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Pagado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className='text-right hidden sm:table-cell'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentsToShow.map((payment, index) => (
              <PaymentRow key={payment.id} payment={payment} index={index} />
            ))}
          </TableBody>
        </Table>
         {loan.paymentSchedule.length > 4 && (
            <div className="text-center mt-4">
                <Button variant="link" size="sm" onClick={() => setShowAllPayments(!showAllPayments)}>
                  {showAllPayments ? 'Mostrar menos' : 'Ver cronograma completo'}
                </Button>
            </div>
         )}
      </CardContent>
    </Card>
  )
}

const PaymentRow: FC<{payment: Payment, index: number}> = ({ payment, index }) => {
  const amountPaid = payment.amountPaid || 0;
  const remainingAmount = payment.amount - amountPaid;

  return (
    <TableRow>
      <TableCell>#{index + 1}</TableCell>
      <TableCell>{format(new Date(payment.dueDate.replace(/-/g, '/')), 'dd MMM, yy')}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          {amountPaid > 0 && payment.status !== 'Pagado' && (
            <span className="text-xs text-muted-foreground line-through">
              ${payment.amount.toLocaleString('es-CO', {maximumFractionDigits: 0})}
            </span>
          )}
          <span className="font-medium">
            ${remainingAmount.toLocaleString('es-CO', {maximumFractionDigits: 0})}
          </span>
        </div>
      </TableCell>
       <TableCell className="hidden sm:table-cell">
        <div className='flex flex-col'>
          <span>${(payment.amountPaid || 0).toLocaleString('es-CO', {maximumFractionDigits: 0})}</span>
           {payment.registeredBy && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <UserCheck className="h-3 w-3" />
                            <span className="text-xs">{payment.registeredBy.split('@')[0]}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Registrado por: {payment.registeredBy}</p>
                        {payment.paidDate && <p>Fecha: {format(new Date(payment.paidDate.replace(/-/g, '/')), 'dd MMMM, yyyy')}</p>}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
           )}
        </div>
       </TableCell>
      <TableCell>
          <Badge variant={payment.status === 'Atrasado' ? 'destructive' : payment.status === 'Pagado' ? 'default' : 'outline' }>{payment.status}</Badge>
      </TableCell>
      <TableCell className="text-right hidden sm:table-cell">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" disabled={payment.status === 'Pagado'}>
                <span className="sr-only">Abrir menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RegisterPaymentForm payment={payment}>
                 <DropdownMenuTriggerItem>
                    Registrar Pago
                  </DropdownMenuTriggerItem>
              </RegisterPaymentForm>
              <DropdownMenuItem>Ver detalle</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export default BorrowerDetailPage;

    