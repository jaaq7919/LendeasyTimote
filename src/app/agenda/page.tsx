
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, DollarSign, Search } from 'lucide-react';
import { RegisterPaymentForm } from '@/components/payments/register-payment-form';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan, Borrower, Payment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

interface AgendaItem {
    borrower: Borrower;
    payment: Payment;
    loan: Pick<Loan, 'id'>;
}

export default function AgendaPage() {
  const [today, setToday] = useState('');
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const todayDate = new Date();
    const todayStr = todayDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    setToday(todayStr);

    const todayQueryStr = format(todayDate, 'yyyy-MM-dd');

    const loansQuery = query(collection(db, 'loans'), where('status', 'in', ['Activo', 'Moroso']));
    
    const unsubLoans = onSnapshot(loansQuery, (loanSnapshot) => {
        const borrowersQuery = query(collection(db, 'borrowers'));

        const unsubBorrowers = onSnapshot(borrowersQuery, (borrowerSnapshot) => {
            const borrowersMap = new Map<string, Borrower>();
            borrowerSnapshot.forEach(doc => {
                borrowersMap.set(doc.id, { id: doc.id, ...doc.data() } as Borrower);
            });

            const items: AgendaItem[] = [];
            loanSnapshot.forEach(loanDoc => {
                const loan = { id: loanDoc.id, ...loanDoc.data() } as Loan;
                const borrower = borrowersMap.get(loan.borrowerId);

                if (borrower) {
                    loan.paymentSchedule.forEach(payment => {
                        // Show payments due today or overdue
                        if (payment.dueDate <= todayQueryStr && (payment.status === 'Pendiente' || payment.status === 'Atrasado')) {
                            items.push({
                                borrower,
                                payment,
                                loan: { id: loan.id },
                            });
                        }
                    });
                }
            });

            setAgendaItems(items.sort((a,b) => a.payment.dueDate.localeCompare(b.payment.dueDate)));
            setLoading(false);
        });

        return () => unsubBorrowers();
    });

    return () => unsubLoans();

  }, []);

  const filteredAgendaItems = useMemo(() => {
    if (!searchTerm) {
      return agendaItems;
    }
    return agendaItems.filter(item => {
      const fullName = `${item.borrower.firstName} ${item.borrower.lastName}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase());
    });
  }, [agendaItems, searchTerm]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-start justify-between space-y-2 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agenda de Cobros</h2>
          {today && (
            <p className="text-muted-foreground">
              Cobros pendientes para hoy, {today}, y anteriores.
            </p>
          )}
        </div>
         <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre de cliente..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
      </div>
       {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
             <Card key={index}>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
             </Card>
          ))}
        </div>
       ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgendaItems.map(({ borrower, payment, loan }) => (
          <Card key={payment.id}>
            <CardHeader>
              <div className='flex justify-between items-start'>
                <div>
                    <CardTitle>{borrower.firstName} {borrower.lastName}</CardTitle>
                    <CardDescription>Vence: {format(new Date(payment.dueDate.replace(/-/g, '/')), 'dd MMMM, yyyy')}</CardDescription>
                </div>
                <Badge variant={payment.status === 'Atrasado' || new Date(payment.dueDate.replace(/-/g, '/')) < new Date(format(new Date(), 'yyyy-MM-dd')) ? 'destructive' : 'outline'}>
                  {new Date(payment.dueDate.replace(/-/g, '/')) < new Date(format(new Date(), 'yyyy-MM-dd')) && payment.status !== 'Pagado' ? 'Atrasado' : payment.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center text-sm">
                <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Monto a cobrar: <span className='font-bold'>${payment.amount.toFixed(2)}</span></span>
              </div>
              <div className="flex items-center text-sm">
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className='truncate'>{borrower.address}</span>
              </div>
              <div className="flex items-center text-sm">
                <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{borrower.phone}</span>
              </div>
            </CardContent>
             <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
               <Button variant="outline" asChild className='w-full sm:w-auto'>
                  <Link href={`/borrowers/${borrower.id}`}>Ver Préstamo</Link>
               </Button>
               <RegisterPaymentForm payment={payment}>
                  <Button className='w-full sm:w-auto'>Registrar Pago</Button>
               </RegisterPaymentForm>
            </CardFooter>
          </Card>
        ))}
        {filteredAgendaItems.length === 0 && !loading && (
          <div className="col-span-full text-center py-10">
            <p className="text-muted-foreground">
              {searchTerm ? 'No se encontraron cobros para ese cliente.' : 'No hay cobros pendientes.'}
            </p>
          </div>
        )}
      </div>
       )}
    </div>
  );
}

    