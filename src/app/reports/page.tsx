
'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan, Borrower, Payment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { Skeleton } from '@/components/ui/skeleton';

type ReportType = 'portfolio-summary' | 'payment-history';

interface PortfolioSummaryData {
  status: Loan['status'];
  count: number;
  totalAmount: number;
  totalOutstanding: number;
}

interface PaymentHistoryData {
  paymentId: string;
  loanId: string;
  borrowerName: string;
  paidDate: string;
  amountPaid: number;
  registeredBy?: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('portfolio-summary');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [portfolioData, setPortfolioData] = useState<PortfolioSummaryData[]>([]);
  const [paymentHistoryData, setPaymentHistoryData] = useState<PaymentHistoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Error", description: "Por favor, seleccione un rango de fechas.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPortfolioData([]);
    setPaymentHistoryData([]);
    setHasGenerated(true);

    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');

      if (reportType === 'portfolio-summary') {
        const loansQuery = query(
          collection(db, 'loans'),
          where('startDate', '>=', startDate),
          where('startDate', '<=', endDate)
        );
        const querySnapshot = await getDocs(loansQuery);
        const loans: Loan[] = [];
        querySnapshot.forEach(doc => loans.push({ id: doc.id, ...doc.data() } as Loan));
        const summary = loans.reduce((acc, loan) => {
          if (!acc[loan.status]) {
            acc[loan.status] = { status: loan.status, count: 0, totalAmount: 0, totalOutstanding: 0 };
          }
          acc[loan.status].count++;
          acc[loan.status].totalAmount += loan.amount;
          acc[loan.status].totalOutstanding += loan.outstandingBalance;
          return acc;
        }, {} as Record<Loan['status'], PortfolioSummaryData>);
        setPortfolioData(Object.values(summary));
      } else if (reportType === 'payment-history') {
         const borrowersSnapshot = await getDocs(collection(db, 'borrowers'));
         const borrowersMap = new Map<string, Borrower>();
         borrowersSnapshot.forEach(doc => {
            borrowersMap.set(doc.id, { id: doc.id, ...doc.data() } as Borrower);
         });

         const loansSnapshot = await getDocs(collection(db, 'loans'));
         const history: PaymentHistoryData[] = [];

         loansSnapshot.forEach(loanDoc => {
            const loan = loanDoc.data() as Loan;
            const borrower = borrowersMap.get(loan.borrowerId);

            loan.paymentSchedule.forEach(payment => {
                if (payment.paidDate && payment.amountPaid && payment.amountPaid > 0) {
                    const paymentDate = new Date(payment.paidDate.replace(/-/g, '/'));
                    if (paymentDate >= dateRange.from! && paymentDate <= dateRange.to!) {
                         history.push({
                            paymentId: payment.id,
                            loanId: loanDoc.id,
                            borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : 'N/A',
                            paidDate: payment.paidDate,
                            amountPaid: payment.amountPaid,
                            registeredBy: payment.registeredBy || 'Sistema',
                         });
                    }
                }
            });
         });
         setPaymentHistoryData(history.sort((a,b) => b.paidDate.localeCompare(a.paidDate)));
      }

    } catch (error) {
      console.error("Error generating report: ", error);
      toast({ title: "Error", description: "No se pudo generar el reporte.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    let csv;
    const isPortfolio = reportType === 'portfolio-summary' && portfolioData.length > 0;
    const isPaymentHistory = reportType === 'payment-history' && paymentHistoryData.length > 0;

    if (!isPortfolio && !isPaymentHistory) {
      toast({ title: "Sin datos", description: "No hay datos para exportar.", variant: "destructive" });
      return;
    }

    if (isPortfolio) {
      const headers = ["Estado", "Cantidad de Préstamos", "Monto Total Prestado", "Saldo Pendiente Total"];
      const data = portfolioData.map(item => ({
        "Estado": item.status,
        "Cantidad de Préstamos": item.count,
        "Monto Total Prestado": item.totalAmount.toFixed(2),
        "Saldo Pendiente Total": item.totalOutstanding.toFixed(2),
      }));
      csv = Papa.unparse({ fields: headers, data });
    } else if (isPaymentHistory) {
      const headers = ["Fecha de Pago", "Cliente", "Monto Pagado", "Registrado Por", "ID Préstamo"];
      const data = paymentHistoryData.map(item => ({
         "Fecha de Pago": item.paidDate,
         "Cliente": item.borrowerName,
         "Monto Pagado": item.amountPaid.toFixed(2),
         "Registrado Por": item.registeredBy,
         "ID Préstamo": item.loanId,
      }));
       csv = Papa.unparse({ fields: headers, data });
    }

    if (csv) {
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `${reportType}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const totals = useMemo(() => {
    if (reportType === 'portfolio-summary' && portfolioData.length > 0) {
      return portfolioData.reduce((acc, item) => {
        acc.count += item.count;
        acc.totalAmount += item.totalAmount;
        acc.totalOutstanding += item.totalOutstanding;
        return acc;
      }, { count: 0, totalAmount: 0, totalOutstanding: 0 });
    }
    if (reportType === 'payment-history' && paymentHistoryData.length > 0) {
        return {
            totalPaid: paymentHistoryData.reduce((sum, item) => sum + item.amountPaid, 0)
        }
    }
    return null;
  }, [portfolioData, paymentHistoryData, reportType]);


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reportes</h2>
          <p className="text-muted-foreground">
            Analice el rendimiento de su cartera y exporte los datos.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="grid gap-2">
              <label htmlFor="report-type" className="text-sm font-medium">Tipo de Reporte</label>
              <Select value={reportType} onValueChange={(value: ReportType) => {
                setReportType(value);
                setPortfolioData([]);
                setPaymentHistoryData([]);
                setHasGenerated(false);
              }}>
                <SelectTrigger id="report-type" className="w-[240px]">
                  <SelectValue placeholder="Seleccione un reporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portfolio-summary">Resumen de Cartera</SelectItem>
                  <SelectItem value="payment-history">Historial de Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
               <label htmlFor="date-range" className="text-sm font-medium">
                 {reportType === 'portfolio-summary' ? 'Rango de Fechas (por inicio de préstamo)' : 'Rango de Fechas (por fecha de pago)'}
                </label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date-range"
                        variant={"outline"}
                        className={cn(
                        "w-[300px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                            {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                            {format(dateRange.to, "LLL dd, y", { locale: es })}
                            </>
                        ) : (
                            format(dateRange.from, "LLL dd, y", { locale: es })
                        )
                        ) : (
                        <span>Seleccione un rango</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={es}
                    />
                    </PopoverContent>
                </Popover>
            </div>
            <Button onClick={handleGenerateReport} disabled={loading}>
              {loading ? 'Generando...' : 'Generar Reporte'}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={loading || (portfolioData.length === 0 && paymentHistoryData.length === 0)}>
                <Download className="mr-2 h-4 w-4" />
                Exportar a CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className='mb-4'>Resultados</CardTitle>
          {loading && (
             <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
             </div>
          )}

          {!loading && !hasGenerated && (
             <div className="text-center py-10">
                <p className="text-muted-foreground">
                    Seleccione los filtros y genere un reporte para ver los datos.
                </p>
            </div>
          )}

          {!loading && hasGenerated && reportType === 'portfolio-summary' && portfolioData.length === 0 && (
             <div className="text-center py-10"><p className="text-muted-foreground">No se encontraron préstamos para el rango de fechas seleccionado.</p></div>
          )}
          {!loading && hasGenerated && reportType === 'payment-history' && paymentHistoryData.length === 0 && (
             <div className="text-center py-10"><p className="text-muted-foreground">No se encontraron pagos para el rango de fechas seleccionado.</p></div>
          )}

          {!loading && reportType === 'portfolio-summary' && portfolioData.length > 0 && (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead className='text-right'># Préstamos</TableHead>
                        <TableHead className='text-right'>Monto Total</TableHead>
                        <TableHead className='text-right'>Saldo Pendiente</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {portfolioData.map(item => (
                        <TableRow key={item.status}>
                            <TableCell className='font-medium'>{item.status}</TableCell>
                            <TableCell className='text-right'>{item.count}</TableCell>
                            <TableCell className='text-right'>${item.totalAmount.toLocaleString('es-CO', {maximumFractionDigits: 2})}</TableCell>
                            <TableCell className='text-right'>${item.totalOutstanding.toLocaleString('es-CO', {maximumFractionDigits: 2})}</TableCell>
                        </TableRow>
                    ))}
                      {totals && 'count' in totals && (
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{totals.count}</TableCell>
                        <TableCell className="text-right">${totals.totalAmount.toLocaleString('es-CO', {maximumFractionDigits: 2})}</TableCell>
                        <TableCell className="text-right">${totals.totalOutstanding.toLocaleString('es-CO', {maximumFractionDigits: 2})}</TableCell>
                      </TableRow>
                    )}
                </TableBody>
            </Table>
          )}

           {!loading && reportType === 'payment-history' && paymentHistoryData.length > 0 && (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha Pago</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Registrado Por</TableHead>
                        <TableHead className='text-right'>Monto Pagado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paymentHistoryData.map(item => (
                        <TableRow key={item.paymentId}>
                            <TableCell>{format(new Date(item.paidDate.replace(/-/g, '/')), 'dd MMMM, yyyy')}</TableCell>
                            <TableCell className='font-medium'>{item.borrowerName}</TableCell>
                            <TableCell className='text-muted-foreground'>{item.registeredBy}</TableCell>
                            <TableCell className='text-right'>${item.amountPaid.toLocaleString('es-CO', {maximumFractionDigits: 2})}</TableCell>
                        </TableRow>
                    ))}
                    {totals && 'totalPaid' in totals && (
                        <TableRow className="font-bold bg-muted/50">
                            <TableCell colSpan={3}>TOTAL RECAUDADO</TableCell>
                            <TableCell className="text-right">${(totals.totalPaid as number).toLocaleString('es-CO', {maximumFractionDigits: 2})}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
