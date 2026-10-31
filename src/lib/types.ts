export type Role = "OWNER" | "MANAGER" | "RECEPTIONIST" | "WORKER";
export type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type PaymentMethod = "CASH" | "MPESA" | "CARD";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string;
  /** May switch to other branches (e.g. an owner overseeing both sides). */
  canSwitchBranches: boolean;
  mustChangePassword: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  kind: "DEPOSIT" | "BALANCE" | "REFUND";
  mpesaReceipt: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  source: "WALKIN" | "ONLINE" | "PHONE";
  price: number;
  discount: number;
  depositPaid: number;
  depositRefundDue: boolean;
  paid: boolean;
  notes: string | null;
  allergies: string | null;
  manageToken: string;
  paidTotal: number;
  amountDue: number;
  balance: number;
  client: { id: string; name: string; phone: string; allergies: string | null };
  staff: { id: string; name: string };
  service: { id: string; name: string; durationMin: number };
  payments: Payment[];
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  requiresPatchTest: boolean;
  isWigService: boolean;
  isActive: boolean;
  salePrice: number | null;
  category: string | null;
  imageUrl: string | null;
}

export type WeeklyHours = Record<string, { start: string; end: string } | null>;

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  title: string | null;
  isActive: boolean;
  isBookable: boolean;
  serviceIds: string[];
  weeklyHours: WeeklyHours | null;
  canSwitchBranches?: boolean;
  payType: "SALARY_ONLY" | "COMMISSION_ONLY" | "BOTH";
  monthlySalary: number | null;
  commissionPct: number | null;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  allergies: string | null;
  isBlocked: boolean;
  isFirstLash: boolean;
  createdAt: string;
  visits?: number;
  lastVisit?: string | null;
  totalSpent?: number;
}

export interface Slot {
  startAt: string;
  startTime: string;
  endTime: string;
}

export interface Settings {
  name: string;
  phone: string | null;
  address: string | null;
  tagline: string | null;
  about: string | null;
  instagram: string | null;
  whatsapp: string | null;
  hoursText: string | null;
  announcement: string | null;
  openingHours: WeeklyHours | null;
  minNoticeHours: number;
  maxAheadDays: number;
  bufferMinutes: number;
  cancelWindowHours: number;
  depositRequired: boolean;
  depositAmount: number;
  maxBookingsPerDay: number;
  showStylists: boolean;
  shopDeliveryFee: number;
  shopFreeOver: number | null;
  shopCodAllowed: boolean;
  /** What managers may do. Only present for owners. */
  mgrReports: boolean;
  mgrRefunds: boolean;
  mgrCashUp: boolean;
  mgrStaffPay: boolean;
}

export interface Dashboard {
  month: string;
  today: { revenue: number; bookingCount: number; upcomingCount: number; completedCount: number; cancelledCount: number; noShowCount: number };
  agenda: Array<{ id: string; startAt: string; status: BookingStatus; clientName: string; serviceName: string; staffName: string; isPast: boolean }>;
  trend: Array<{ date: string; revenue: number }>;
  monthSummary: { revenue: number; expenses: number; profit: number; bookingCount: number; commissionOwed: number; byMethod: Record<string, number> };
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topStaff: Array<{ name: string; count: number; revenue: number }>;
  alerts: { refundsDue: number; unassignedPayments: number; lowStock: number; openCashUps: number; openComplaints: number };
}
