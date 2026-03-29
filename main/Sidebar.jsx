
import React, { useState } from "react";
import {
  LogOut, Home, Users, User, ShoppingBag, Wallet,
  ReceiptIndianRupee, FileText, Settings, Zap,
  ChevronRight, Layers, Menu, X, IndianRupeeIcon, WalletCards,StickyNote, Landmark, Package,MessageCircle,ChevronLeft
} from "lucide-react";
import { useNavigate,useLocation} from "react-router-dom";

/* ================= ROLE SECURITY ================= */
export const ROLE_DEFAULTS = {
  Admin: "/",
  Developer: "/",
  Employee: "/sales/estimations/generator",
  Goldsmith: "/goldsmith-ledger",
};
export const ROLE_ALLOWED_PATHS = {
  Admin: ["*"],
  Developer: ["*"],
  Employee: ["/sales/estimations"],
  Goldsmith: ["/goldsmith-ledger"]
};
/* ================= NAVIGATION ================= */
const NAV_ROUTES = [
  { id: "home", name: "Dashboard", icon: Home, path: "/", access: ["Admin", "Developer"] },

  {
    id: "internal",
    name: "Internal Operations",
    icon: Layers,
    access: ["Admin", "Developer"],
    children: [
      { id: "forms", name: "Assign Gold", icon: FileText, path: "/internal/forms", access: ["Admin", "Developer"] },
      {
      id: "items",
      name: "Add Stock",
      icon: Package,
      path: "/internal/items",
      access: ["Admin", "Developer"]
    },
     {
      id: "stockInventory",
      name: "Stock Inventory",
      icon: ShoppingBag,
      path: "/internal/stock-inventory",
      access: ["Admin", "Developer"]
    },

    

      { id: "ledger", name: "Goldsmith Ledger", icon: Wallet, path: "/internal/ledger", access: ["Admin", "Developer"] },
      { id: "reports", name: "Ledger Reports", icon: FileText, path: "/internal/ledger/reports", access: ["Admin", "Developer"] },
    ]
  },

  {
    id: "sales",
    name: "Sales & Orders",
    icon: Users,
    access: ["Admin", "Developer", "Employee"],
    children: [
      {
        id: "estimations",
        name: "Estimations",
        icon: Zap,
        access: ["Admin", "Developer", "Employee"],
        children: [
          { id: "generator", name: "New Estimation", icon: Settings, path: "/sales/estimations/generator", access: ["Admin", "Developer", "Employee"] },
          { id: "logs", name: "Logs", icon: ReceiptIndianRupee, path: "/sales/estimations/logs", access: ["Admin", "Developer"] },
          { id: "orders", name: "Orders", icon: ShoppingBag, path: "/sales/orders", access: ["Admin", "Developer"] },

        ],
      },
      { id: "customers", name: "Customers", icon: User, path: "/sales/customers", access: ["Admin", "Developer"] },
      {
        id: "whatsapp",
        name: "WhatsApp",
        icon: MessageCircle,
        access: ["Admin","Developer"],
        children: [
          {
            id: "whatsappInbox",
            name: "Inbox",
            icon: MessageCircle,
            path: "/sales/whatsapp",
            access: ["Admin","Developer"]
          },
          {
            id: "whatsappCampaigns",
            name: "Campaigns",
            icon: Zap,
            path: "/sales/whatsapp/campaigns",
            access: ["Admin","Developer"]
          },
          {
            id: "whatsappTemplates",
            name: "Templates",
            icon: FileText,
            path: "/sales/whatsapp/templates",
            access: ["Admin","Developer"]
          }
        ]
      }
    ]
  },
  {
  id: "finance",
  name: "Finance",
  icon: WalletCards,
  access: ["Admin", "Developer"],
  children: [
    {
      id: "payments",
      name: "Payments",
      icon: IndianRupeeIcon,
      path: "/finance/payments",
      access: ["Admin", "Developer"]
    },
    {
      id: "invoices",
      name: "Invoices",
      icon: StickyNote,
      path: "/finance/invoices",
      access: ["Admin", "Developer"] // ✅ REQUIRED
    },
    {
      id: "banking",
      name: "Banking",
      icon: Landmark,
      path: "/finance/banking",
      access: ["Admin", "Developer"]
    },
    { id: "investments", name: "Investments", icon: IndianRupeeIcon, path: "/sales/investments", access: ["Admin", "Developer"] },

  ]
},
  { id: "goldsmith", name: "My Ledger", icon: Wallet, path: "/goldsmith-ledger", access: ["Goldsmith"] }
];
/* ================= SIDEBAR ITEM ================= */

const SidebarItem = ({ route, role, openMenus, toggleMenu, isCollapsed, closeMobileMenu }) => {
  const navigate = useNavigate();
  const location = useLocation();
  if (!route.access.includes(role)) return null;
  const isActive = location.pathname === route.path;
  const hasChildren = !!route.children?.length;
  const isOpen = openMenus[route.id];
  const Icon = route.icon;

  const handleClick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleMenu(route.id);
    } else {
      navigate(route.path);
      if (closeMobileMenu) closeMobileMenu();
    }
  };

  return (
    <div className="mb-1">
      <div
        onClick={handleClick}
        className={`
          group relative flex items-center px-4 py-2.5 mx-2 rounded-xl cursor-pointer transition-all duration-200
          ${isActive ? 'bg-amber-500/10 text-black' : 'text-black hover:bg-slate-100 hover:text-amber-600'}
        `}
      >
        {isActive && <div className="absolute left-0 w-1 h-5 bg-amber-500 rounded-r-full" />}
        <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-amber-600' : 'group-hover:scale-110'}`} />
        {!isCollapsed && (
          <>
            <span className="ml-3 font-medium text-sm tracking-wide flex-1">{route.name}</span>
            {hasChildren && (
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-90 text-amber-500" : "opacity-40"}`} />
            )}
          </>
        )}
      </div>
      {!isCollapsed && hasChildren && isOpen && (
        <div className="mt-1 ml-6 space-y-1 border-l border-slate-200 animate-in slide-in-from-left-2 duration-200">
          {route.children.map(child => (
            <SidebarItem
              key={child.id}
              route={child}
              role={role}
              openMenus={openMenus}
              toggleMenu={toggleMenu}
              closeMobileMenu={closeMobileMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ================= MAIN SIDEBAR ================= */
const Sidebar = ({ role, logout, isMobileOpen, setIsMobileOpen }) => {
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState({});
  const isRestricted = role === "Employee" || role === "Goldsmith";
  
  const toggleMenu = (id) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const BrandHeader = () => (
    <div className={`
      flex items-center justify-center transition-all duration-300
      ${isRestricted ? 'h-24 px-2' : 'h-40 px-4'} 
    `}>
      <div className="relative group cursor-pointer">
        <img 
          src="/kc2.png" 
          alt="Logo" 
          className={`object-contain transition-all duration-500 ${isRestricted ? 'w-14' : 'w-56'} group-hover:scale-105`} 
        />
        {!isRestricted && (
          <div className="absolute inset-0 bg-amber-100/10 blur-3xl rounded-full -z-10" />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* SIDE SLIDE TRIGGER (Visible when Sidebar is closed on mobile) */}
      {!isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-[70] bg-white border border-l-0 border-slate-200 py-4 px-1 rounded-r-xl shadow-xl cursor-pointer hover:bg-amber-50 transition-all"
        >
          <ChevronRight className="w-5 h-5 text-amber-600" />
        </div>
      )}

      {/* Backdrop */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-[60] h-screen bg-white border-r border-slate-200
        transition-all duration-500 ease-in-out flex flex-col
        ${isRestricted ? 'w-20' : 'w-72'} 
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 md:static
      `}>
        {/* Brand Header */}
        <div className="relative border-b border-slate-100">
          {isMobileOpen && (
            <button onClick={() => setIsMobileOpen(false)} className="md:hidden absolute right-4 top-4 p-2 text-black hover:text-amber-600">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <BrandHeader />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto premium-scroll">
          {isRestricted ? (
            <div className="flex flex-col items-center space-y-8 mt-4">
                <div className="p-3 bg-slate-50 rounded-full text-black border border-slate-100"><User className="w-6 h-6" /></div>
                <p className="text-[10px] text-black font-bold uppercase rotate-90 whitespace-nowrap tracking-[0.2em] mt-8">{role}</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {NAV_ROUTES.map(route => (
                <SidebarItem
                  key={route.id}
                  route={route}
                  role={role}
                  openMenus={openMenus}
                  toggleMenu={toggleMenu}
                  isCollapsed={isRestricted}
                  closeMobileMenu={() => setIsMobileOpen(false)}
                />
              ))}
            </ul>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className={`flex items-center gap-2 ${isRestricted ? 'flex-col' : ''}`}>
            {(role === "Admin" || role === "Developer") && !isRestricted && (
              <button onClick={() => navigate('/settings')} className="p-3 text-black hover:text-amber-600 hover:bg-slate-50 rounded-xl transition-all"><Settings className="w-5 h-5" /></button>
            )}
            <button onClick={() => { logout(); navigate("/login"); }} className={`flex items-center justify-center gap-2 rounded-xl transition-all font-medium text-sm ${isRestricted ? 'p-3 text-black hover:text-red-600' : 'flex-1 bg-slate-900 text-white hover:bg-red-600 py-3 shadow-lg'}`}>
              <LogOut className="w-4 h-4" />
              {!isRestricted && <span>Sign Out</span>} 
            </button>
          </div>
          {!isRestricted && (
            <div className="mt-4 px-2 py-3 bg-slate-50 rounded-2xl flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">{role[0]}</div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-wider">{role}</span>
                <span className="text-[9px] text-black font-medium flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-green-500" /> Secure Portal</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;