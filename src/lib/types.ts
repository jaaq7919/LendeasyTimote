export interface Borrower {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  address: string;
  status: 'Activo' | 'Moroso' | 'Bloqueado' | 'Finalizado';
  createdAt: string;
}

export interface Payment {
  id: string;
  loanId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'Pagado' | 'Pendiente' | 'Atrasado';
  amountPaid?: number;
  registeredBy?: string | null;
}

export interface Loan {
  id: string;
  borrowerId: string;
  amount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  paymentSchedule: Payment[];
  outstandingBalance: number;
  status: 'Activo' | 'Pagado' | 'Moroso' | 'Cancelado';
  installments: number;
  periodicity: 'Diario' | 'Semanal' | 'Quincenal' | 'Mensual';
  loanType: 'Amortizado' | 'Solo Interes' | 'Interes Mensual Fijo';
  fundSource: string;
  observations?: string;
  createdAt: string;
}

export interface FundSource {
    id: string;
    name: string;
}
