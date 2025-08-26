
'use client';
import type {FC} from 'react';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Badge} from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {MoreHorizontal, PlusCircle} from 'lucide-react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import type {Loan, Borrower} from '@/lib/types';
import { AddLoanForm } from '@/components/loans/add-loan-form';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LoansPage: FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<Map<string, Borrower>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('Activo');
  const itemsPerPage = 10;

  useEffect(() => {
    const loansQuery = query(collection(db, "loans"), orderBy("createdAt", "desc"));
    const unsubLoans = onSnapshot(loansQuery, (snapshot) => {
      const loansData: Loan[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        loansData.push({ id: doc.id, ...data } as Loan);
      });
      setLoans(loansData);
      setLoading(false);
    });

    const borrowersQuery = query(collection(db, "borrowers"));
    const unsubBorrowers = onSnapshot(borrowersQuery, (snapshot) => {
        const borrowersData = new Map<string, Borrower>();
        snapshot.forEach(doc => {
            borrowersData.set(doc.id, { id: doc.id, ...doc.data()} as Borrower);
        });
        setBorrowers(borrowersData);
    });

    return () => {
        unsubLoans();
        unsubBorrowers();
    }
  }, []);
  
  const filteredLoans = useMemo(() => {
    if (statusFilter === 'Todos') {
      return loans;
    }
    return loans.filter(loan => loan.status === statusFilter);
  }, [loans, statusFilter]);

  const { paginatedLoans, totalPages } = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLoans = filteredLoans.slice(startIndex, startIndex + itemsPerPage);
    const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
    return { paginatedLoans, totalPages };
  }, [filteredLoans, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);


  const getBorrowerName = (borrowerId: string) => {
    const borrower = borrowers.get(borrowerId);
    return borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Cargando...';
  }
  
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Préstamos</h2>
          <p className="text-muted-foreground">
            Gestiona todos los préstamos registrados en el sistema.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <AddLoanForm>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Préstamo
            </Button>
          </AddLoanForm>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <CardTitle>Lista de Préstamos</CardTitle>
              <CardDescription>
                Mostrando {filteredLoans.length} de un total de {loans.length} préstamos.
              </CardDescription>
            </div>
             <div className="grid gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Pagado">Pagado</SelectItem>
                    <SelectItem value="Moroso">Moroso</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead className="hidden sm:table-cell">Saldo por Pagar</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className='text-right'><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedLoans.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                       {statusFilter === 'Todos' ? 'No hay préstamos registrados.' : `No se encontraron préstamos con el estado "${statusFilter}".`}
                    </TableCell>
                  </TableRow>
              ) : (
                paginatedLoans.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">
                        <Link href={`/borrowers/${loan.borrowerId}`} className="hover:underline">
                        {getBorrowerName(loan.borrowerId)}
                        </Link>
                    </TableCell>
                    <TableCell>${loan.amount.toLocaleString('es-CO', {maximumFractionDigits: 0})}</TableCell>
                    <TableCell className="hidden sm:table-cell">${loan.outstandingBalance.toLocaleString('es-CO', {maximumFractionDigits: 0})}</TableCell>
                    <TableCell>
                      <Badge
                        variant={loan.status === 'Activo' ? 'secondary' : loan.status === 'Moroso' ? 'destructive' : 'default'}  className="text-accent-foreground"
                      >
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                            <Link href={`/borrowers/${loan.borrowerId}`}>Ver detalles del cliente</Link>
                          </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                            <Link href={`/borrowers/${loan.borrowerId}`}>Ver detalles del préstamo</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
         {totalPages > 1 && (
          <CardFooter className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default LoansPage;

    