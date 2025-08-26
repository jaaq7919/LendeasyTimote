
'use client';
import { FC, useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DollarSign, Users, LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan, Borrower, Payment } from '@/lib/types';
import { format, subMonths, getMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalLent: number;
  activeClients: number;
  totalOutstanding: number;
  monthlyEarnings: number;
  totalLentPrevMonth: number;
  activeClientsPrevMonth: number;
  totalOutstandingPrevMonth: number;
  monthlyEarningsPrevMonth: number;
}

interface UpcomingPayment extends Payment {
  borrowerName: string;
  borrowerId: string;
}

const Home: FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalLent: 0,
    activeClients: 0,
    totalOutstanding: 0,
    monthlyEarnings: 0,
    totalLentPrevMonth: 1,
    activeClientsPrevMonth: 1,
    totalOutstandingPrevMonth: 1,
    monthlyEarningsPrevMonth: 1,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  useEffect(() => {
    const loansQuery = query(collection(db, 'loans'));
    const unsubLoans = onSnapshot(loansQuery, (loanSnapshot) => {
      const loans: Loan[] = [];
      loanSnapshot.forEach(doc => loans.push({ id: doc.id, ...doc.data() } as Loan));
      
      const borrowersQuery = query(collection(db, 'borrowers'));
      const unsubBorrowers = onSnapshot(borrowersQuery, (borrowerSnapshot) => {
        const borrowers = new Map<string, Borrower>();
        borrowerSnapshot.forEach(doc => {
            borrowers.set(doc.id, { id: doc.id, ...doc.data() } as Borrower);
        });

        // --- Calculate Stats ---
        const now = new Date();
        const currentMonth = getMonth(now);
        const currentYear = getYear(now);
        const prevMonthDate = subMonths(now, 1);
        const prevMonth = getMonth(prevMonthDate);
        const prevMonthYear = getYear(prevMonthDate);
        
        let totalLent = 0;
        let totalLentPrevMonth = 0;
        let totalOutstanding = 0;
        let totalOutstandingPrevMonth = 0;
        let monthlyEarnings = 0;
        let monthlyEarningsPrevMonth = 0;

        const monthlyAgg: { [key: string]: { loans: number; payments: number } } = {};

        for (let i = 5; i >= 0; i--) {
            const date = subMonths(now, i);
            const monthKey = format(date, 'yyyy-MM');
            monthlyAgg[monthKey] = { loans: 0, payments: 0 };
        }
        
        const upcoming: UpcomingPayment[] = [];

        loans.forEach(loan => {
            const loanDate = new Date(loan.startDate.replace(/-/g, '/'));
            const loanMonth = getMonth(loanDate);
            const loanYear = getYear(loanDate);
            const monthKey = format(loanDate, 'yyyy-MM');
            
            // Stats
            totalLent += loan.amount;
            if (loanMonth < currentMonth && loanYear <= currentYear) {
                totalLentPrevMonth += loan.amount;
            }

            if (loan.status === 'Activo' || loan.status === 'Moroso') {
                totalOutstanding += loan.outstandingBalance;

                // For previous month outstanding, we need a more complex logic, maybe snapshot based.
                // For simplicity, we can estimate or just show current. Here, we'll just track changes based on payments.
            }
            
            if (monthlyAgg[monthKey]) {
              monthlyAgg[monthKey].loans += loan.amount;
            }

            loan.paymentSchedule.forEach(p => {
                if (p.status === 'Pagado' && p.paidDate) {
                    const paidDate = new Date(p.paidDate.replace(/-/g, '/'));
                    const paidMonth = getMonth(paidDate);
                    const paidYear = getYear(paidDate);
                    const paidMonthKey = format(paidDate, 'yyyy-MM');
                    const interestPortion = loan.interestRate / 100 * p.amount;

                    if (paidYear === currentYear && paidMonth === currentMonth) {
                        monthlyEarnings += interestPortion;
                    } else if (paidYear === prevMonthYear && paidMonth === prevMonth) {
                         monthlyEarningsPrevMonth += interestPortion;
                    }
                     if (monthlyAgg[paidMonthKey]) {
                        monthlyAgg[paidMonthKey].payments += p.amount;
                    }

                } else if (p.status === 'Pendiente' || p.status === 'Atrasado') {
                    const borrower = borrowers.get(loan.borrowerId);
                    if (borrower) {
                         upcoming.push({
                            ...p,
                            borrowerName: `${borrower.firstName} ${borrower.lastName}`,
                            borrowerId: borrower.id
                         });
                    }
                }
            });
        });
        
        const activeClients = Array.from(borrowers.values()).filter(b => b.status === 'Activo').length;
        
        // Finalize stats
        setStats({
            totalLent,
            activeClients,
            totalOutstanding,
            monthlyEarnings,
            totalLentPrevMonth,
            activeClientsPrevMonth: activeClients, // Simplified
            totalOutstandingPrevMonth: totalOutstanding, // Simplified
            monthlyEarningsPrevMonth: monthlyEarningsPrevMonth || 1, // Avoid division by zero
        });
        
        // --- Prepare Chart Data ---
        const finalChartData = Object.entries(monthlyAgg).map(([key, value]) => ({
            month: format(new Date(key + '-02'), 'MMM', { locale: es }),
            ...value,
        }));
        setChartData(finalChartData);

        // --- Prepare Upcoming Payments ---
        setUpcomingPayments(
            upcoming
                .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 5)
        );

        setLoading(false);
      });

      return () => unsubBorrowers();
    });

    return () => unsubLoans();
  }, []);

  const totalLentChange = useMemo(() => calculatePercentageChange(stats.totalLent, stats.totalLentPrevMonth), [stats.totalLent, stats.totalLentPrevMonth]);
  const activeClientsChange = useMemo(() => calculatePercentageChange(stats.activeClients, stats.activeClientsPrevMonth), [stats.activeClients, stats.activeClientsPrevMonth]);
  const totalOutstandingChange = useMemo(() => calculatePercentageChange(stats.totalOutstanding, stats.totalOutstandingPrevMonth), [stats.totalOutstanding, stats.totalOutstandingPrevMonth]);
  const monthlyEarningsChange = useMemo(() => calculatePercentageChange(stats.monthlyEarnings, stats.monthlyEarningsPrevMonth), [stats.monthlyEarnings, stats.monthlyEarningsPrevMonth]);

  const StatCard: FC<{ title: string; value: string; change: number; icon: React.ElementType }> = ({ title, value, change, icon: Icon }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground flex items-center">
                <span className={`flex items-center mr-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {change.toFixed(1)}%
                </span>
                 vs mes anterior
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Prestado" value={`$${stats.totalLent.toLocaleString('es-CO', {maximumFractionDigits: 0})}`} change={totalLentChange} icon={DollarSign} />
        <StatCard title="Clientes Activos" value={`${stats.activeClients}`} change={activeClientsChange} icon={Users} />
        <StatCard title="Saldo Pendiente" value={`$${stats.totalOutstanding.toLocaleString('es-CO', {maximumFractionDigits: 0})}`} change={totalOutstandingChange} icon={LineChart} />
        <StatCard title="Ganancias del Mes" value={`$${stats.monthlyEarnings.toLocaleString('es-CO', {maximumFractionDigits: 0})}`} change={monthlyEarningsChange} icon={TrendingUp} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Préstamos vs. Pagos</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? <Skeleton className="w-full h-[350px]" /> : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Tooltip
                  cursor={{fill: 'hsl(var(--muted))'}}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                  }}
                   formatter={(value: number) => `$${value.toLocaleString('es-CO', {maximumFractionDigits: 0})}`}
                />
                <Bar dataKey="loans" fill="hsl(var(--primary))" name="Préstamos" radius={[4,4,0,0]} />
                <Bar dataKey="payments" fill="hsl(var(--chart-2))" name="Pagos" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
             )}
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle className="truncate">Próximos Pagos</CardTitle>
            <CardDescription>
              Las siguientes cuotas por cobrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="w-full h-[280px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium truncate">{payment.borrowerName}</TableCell>
                    <TableCell>${payment.amount.toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(payment.dueDate.replace(/-/g, '/')), 'dd MMM', { locale: es })}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === 'Atrasado' || new Date(payment.dueDate.replace(/-/g, '/')) < new Date()
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                         {new Date(payment.dueDate.replace(/-/g, '/')) < new Date() && payment.status !== 'Pagado' ? 'Atrasado' : payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                 {upcomingPayments.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No hay próximos pagos pendientes.
                        </TableCell>
                    </TableRow>
                 )}
              </TableBody>
            </Table>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;

    