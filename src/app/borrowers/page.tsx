
'use client';
import { useEffect, useMemo, useState } from 'react';
import {Button} from '@/components/ui/button';
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
import {MoreHorizontal, PlusCircle, Upload, Search} from 'lucide-react';
import Link from 'next/link';
import {AddBorrowerForm} from '@/components/borrowers/add-borrower-form';
import { EditBorrowerMenuItem } from '@/components/borrowers/edit-borrower-menu-item';
import { AddLoanForm } from '@/components/loans/add-loan-form';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Borrower } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkAddBorrowersForm } from '@/components/borrowers/bulk-add-borrowers-form';
import { Input } from '@/components/ui/input';

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    const q = query(collection(db, "borrowers"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const borrowersData: Borrower[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        borrowersData.push({ 
            id: doc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            idNumber: data.idNumber,
            phone: data.phone,
            address: data.address,
            status: data.status,
            createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
         });
      });
      setBorrowers(borrowersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredBorrowers = useMemo(() => {
    return borrowers.filter(borrower => 
      `${borrower.firstName} ${borrower.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.idNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [borrowers, searchTerm]);


  const { paginatedBorrowers, totalPages } = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedBorrowers = filteredBorrowers.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredBorrowers.length / itemsPerPage);
    return { paginatedBorrowers, totalPages };
  }, [filteredBorrowers, currentPage, itemsPerPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            Gestiona la lista de todos tus prestatarios.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <BulkAddBorrowersForm>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Carga Masiva
            </Button>
          </BulkAddBorrowersForm>
          <AddBorrowerForm>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Cliente
            </Button>
          </AddBorrowerForm>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className='flex justify-between items-start flex-wrap gap-4'>
            <div>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>
                Un total de {filteredBorrowers.length} clientes encontrados.
              </CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o cédula..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead className="hidden md:table-cell">Cédula</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedBorrowers.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      {searchTerm ? "No se encontraron clientes con ese criterio." : "No hay clientes registrados. ¡Crea el primero!"}
                    </TableCell>
                  </TableRow>
              ) : (
                paginatedBorrowers.map(borrower => (
                  <TableRow key={borrower.id}>
                    <TableCell className="font-medium">
                       <Link href={`/borrowers/${borrower.id}`} className="hover:underline">
                        {borrower.firstName} {borrower.lastName}
                       </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{borrower.idNumber}</TableCell>
                    <TableCell>{borrower.phone}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                             <Link href={`/borrowers/${borrower.id}`}>Ver detalles</Link>
                          </DropdownMenuItem>
                          <EditBorrowerMenuItem borrower={borrower} />
                          <AddLoanForm borrowerId={borrower.id}>
                             <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                               Crear préstamo
                             </DropdownMenuItem>
                          </AddLoanForm>
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
}

    