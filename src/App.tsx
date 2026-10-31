import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "./auth/AuthContext";
import { useAccess, type Access } from "./lib/queries";
import { Spinner } from "./components/ui";
import StaffLayout from "./layouts/StaffLayout";
import LandingPage from "./pages/public/LandingPage";
import BookingPage from "./pages/public/BookingPage";
import ContactPage from "./pages/public/ContactPage";
import ReviewPage from "./pages/public/ReviewPage";
import NotFoundPage from "./pages/public/NotFoundPage";
import { PrivacyPage, TermsPage } from "./pages/public/LegalPages";
import { usePageViewTracking } from "./lib/track";
import ShopPage from "./pages/shop/ShopPage";
import ProductPage from "./pages/shop/ProductPage";
import BagPage from "./pages/shop/BagPage";
import CheckoutPage from "./pages/shop/CheckoutPage";
import OrderPage from "./pages/shop/OrderPage";
import ManageBookingPage from "./pages/public/ManageBookingPage";
import LoginPage from "./pages/auth/LoginPage";
import { ForgotPasswordPage, ChangePasswordPage } from "./pages/auth/PasswordPages";
import type { Role } from "./lib/types";

// Staff pages load on demand so the public booking page stays small and fast on mobile data.
const Dashboard = lazy(() => import("./pages/staff/DashboardPage"));
const Calendar = lazy(() => import("./pages/staff/CalendarPage"));
const Clients = lazy(() => import("./pages/staff/ClientsPage"));
const Services = lazy(() => import("./pages/staff/ServicesPage"));
const Team = lazy(() => import("./pages/staff/TeamPage"));
const Money = lazy(() => import("./pages/staff/MoneyPage"));
const PaymentsLedger = lazy(() => import("./pages/staff/PaymentsLedgerPage"));
const Payroll = lazy(() => import("./pages/staff/PayrollPage"));
const TimeOff = lazy(() => import("./pages/staff/TimeOffPage"));
const Products = lazy(() => import("./pages/staff/ProductsPage"));
const Orders = lazy(() => import("./pages/staff/OrdersPage"));
const Branches = lazy(() => import("./pages/staff/BranchesPage"));
const Hero = lazy(() => import("./pages/staff/HeroPage"));
const Settings = lazy(() => import("./pages/staff/SettingsPage"));
const Gallery = lazy(() => import("./pages/staff/GalleryPage"));
const Feedback = lazy(() => import("./pages/staff/FeedbackPage"));
const Insights = lazy(() => import("./pages/staff/InsightsPage"));

function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading your workspace" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.mustChangePassword && location.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

/** Shows the page only to people with this permission; everyone else lands on the calendar instead of an error. */
function NeedsAccess({ cap, children }: { cap: keyof Access; children: ReactNode }) {
  const a = useAccess();
  if (a.loading) return <Spinner />;
  return a[cap] ? <>{children}</> : <Navigate to="/app/calendar" replace />;
}

const MANAGERS: Role[] = ["OWNER", "MANAGER"];
const FRONT_DESK: Role[] = ["OWNER", "MANAGER", "RECEPTIONIST"];

export default function App() {
  usePageViewTracking();
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public: customers */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/:id" element={<ProductPage />} />
        <Route path="/bag" element={<BagPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:token" element={<OrderPage />} />
        <Route path="/manage/:token" element={<ManageBookingPage />} />
        <Route path="/review/:token" element={<ReviewPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Public: staff sign-in */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        {/* Staff workspace */}
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<StaffLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="calendar" element={<Calendar />} />
            <Route element={<RequireAuth roles={MANAGERS} />}>
              <Route path="dashboard" element={<NeedsAccess cap="reports"><Dashboard /></NeedsAccess>} />
              <Route path="services" element={<Services />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="insights" element={<NeedsAccess cap="reports"><Insights /></NeedsAccess>} />
              <Route path="team" element={<Team />} />
              <Route path="products" element={<Products />} />
              <Route path="banners" element={<Hero />} />
              <Route path="branches" element={<Branches />} />
              <Route path="time-off" element={<TimeOff />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route element={<RequireAuth roles={FRONT_DESK} />}>
              <Route path="clients" element={<Clients />} />
              <Route path="money" element={<Money />} />
              <Route path="orders" element={<Orders />} />
              <Route path="feedback" element={<Feedback />} />
            </Route>
            <Route element={<RequireAuth roles={["OWNER"]} />}>
              <Route path="payments" element={<PaymentsLedger />} />
              <Route path="payroll" element={<Payroll />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}
