// src/App.jsx

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/Login';
import Sidebar from './components/main/Sidebar';
import PageContent from './components/main/Dashboard';
import EstimationDetailWrapper from './components/estimation_sales/EstimationDetailWrapper';
import SettingsPage from './components/settings/SettingsPage';
import CustomersPage from './components/customers/CustomersPage';
import CustomerProfilePage from "./pages/CustomerProfilePage";
import "./thermal-print.css";
import OrdersPage from './components/orders/OrdersPage';
import OrderDetailPage from './components/orders/OrderDetailsDrawer';
import { ThemeProvider } from './ThemeProvider';
import { ROLE_DEFAULTS, ROLE_ALLOWED_PATHS } from './components/main/Sidebar';
import InvestmentsPage from './components/investments/Investments';
import InvestmentPublicPortal from './components/investments/InvestmentPublicPortal';
import ConsentInvestment from './components/estimation_sales/ConsentInvestment';
import ViewDirectSale from './components/sales/ViewDirectSale';
import RedeemConsent from './components/common/RedeemConsent';
import InvoicePreview from './pages/invoices/InvoicePreview';
import EditInvoice from './pages/invoices/EditInvoice';
import WhatsAppInbox from './pages/WhatsappMessages';

// Main Application Component wrapped in AuthProvider
const App = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Routes>
          <Route
            path="/redeem-consent/:requestId/:token"
            element={<RedeemConsent />}
          />
          <Route
            path="/view/:token"
            element={<InvestmentPublicPortal />}
          />
          {/* 2. PROTECTED APP LAYOUT */}
          <Route path="*" element={<MainLayout />} />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
};


const MainLayout = () => {
  const { role, isLoading, logout, userData, ROLES } = useAuth();
  const [isSidebarLocked, setIsSidebarLocked] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!role) return;
    const allowed = ROLE_ALLOWED_PATHS[role] || [];
    const defaultPath = ROLE_DEFAULTS[role] || "/";

    if (allowed.includes("*")) {
      return; 
    }

    const enforce = () => {
      const path = window.location.pathname;
      const cleanPath = path.split("?")[0];

      if (!allowed.some(p => cleanPath.startsWith(p))) {
        console.warn(`Restricted Access: ${role} tried to access ${cleanPath}. Redirecting to ${defaultPath}`);
        window.history.replaceState(null, "", defaultPath);
        navigate(defaultPath, { replace: true });
      }
    };

    // Run on load
    enforce();

    // Run on back/forward
    window.addEventListener("popstate", enforce);
    return () => window.removeEventListener("popstate", enforce);

  }, [role, navigate]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <svg className="animate-spin h-10 w-10 text-brown-600" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p className="ml-4 text-gray-600">Loading CRM...</p>
      </div>
    );
  }

  // Show Login Page if not authenticated or unapproved
  if (role === ROLES.LOGGED_OUT || role === ROLES.UNAPPROVED) {
    return <Routes><Route path="*" element={<LoginPage />} /></Routes>;
  }

  // Main Dashboard Layout
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <Sidebar
        isLocked={isSidebarLocked}
        setIsLocked={setIsSidebarLocked}
        currentPage={location.pathname}
        setCurrentPage={navigate}
        role={role}
        logout={logout}
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <Routes>
          {/* Dashboard */}
            <Route path="/" element={<PageContent currentPage="/" role={role} />} />

          {/* Internal */}
          <Route path="/internal/forms" element={<PageContent currentPage="/internal/forms" role={role} />} />
          <Route path="/internal/ledger" element={<PageContent currentPage="/internal/ledger" role={role} />} />
          <Route path="/internal/ledger/reports" element={<PageContent currentPage="/internal/ledger/reports" role={role} />} />
          <Route
            path="/internal/stock-inventory"
            element={<PageContent currentPage="/internal/stock-inventory" role={role} />}
          />
          <Route path="/internal/items" element={<PageContent currentPage="/internal/items" role={role} />} />
          <Route path="/internal/items/new" element={<PageContent currentPage="/internal/items/new" role={role} />} />
          <Route path="/internal/items/edit" element={<PageContent currentPage="/internal/items/edit" role={role} />} />
          <Route
            path="/internal/items/:itemId/history"
            element={
              <PageContent
                currentPage="/internal/items/history"
                role={role}
              />
            }
          />
          {/* Sales */}
          <Route path="/sales/estimations/generator" element={<PageContent currentPage="/sales/estimations/generator" role={role} />} />
          <Route
           path="/sales/estimations/temp-generator" element={<PageContent currentPage="/sales/estimations/temp-generator" role={role}/>}/>
          <Route
            path="/sales/estimations/direct-sale"
            element={<PageContent currentPage="/sales/estimations/direct-sale" role={role} />}
          />
          <Route
            path="/sales/estimations/custom-order"
            element={<PageContent currentPage="/sales/estimations/custom-order" role={role} />}
          />

          <Route path="/sales/estimations/logs" element={<PageContent currentPage="/sales/estimations/logs" role={role} />} />
          <Route
            path="/sales/estimations/direct-sale/:estimationId"
            element={<ViewDirectSale />}
          />
          <Route
            path="/consent/investment/:consentId"
            element={<ConsentInvestment />}
          />
          <Route path="/sales/orders" element={<OrdersPage />} />
          <Route path="/sales/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/sales/customers" element={<CustomersPage />} />
          <Route path="/sales/customers/:customerId" element={<CustomerProfilePage />} />
          {/* Estimation Detail */}
          <Route path="/sales/estimations/logs/:estimationId" element={<EstimationDetailWrapper role={role} />} />
          {/* Investments */}
          <Route path="/sales/investments" element={<InvestmentsPage />} />
          <Route path="/sales/whatsapp" element={<WhatsAppInbox />} />
          <Route path="/sales/whatsapp/:phone" element={<WhatsAppInbox />} />
          <Route path="/view/:token" element={<InvestmentPublicPortal />} />
          <Route
            path="/finance/invoices"
            element={<PageContent currentPage="/finance/invoices" role={role} />}
          />
          <Route
            path="/finance/payments"
            element={<PageContent currentPage="/finance/payments" role={role}/>}
          />

          <Route
            path="/finance/invoices/:id"
            element={<PageContent currentPage="/finance/invoices/view" role={role} />}
          />
          <Route
        path="/invoice/:id/preview"
        element={<InvoicePreview />}
        />

        <Route
        path="/invoice/:id/edit"
        element={<EditInvoice />}
        />
          
          {/* Goldsmith */}
          <Route path="/goldsmith-ledger" element={<PageContent currentPage="/goldsmith-ledger" role={role} />} />
          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          {/* 404 */}
          <Route path="*" element={<div className="p-8 text-center text-red-500">404 Page Not Found</div>} />
        </Routes>
      </div>
    </div>
  );
};

export default App;