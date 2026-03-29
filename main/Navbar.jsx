import React, { useState, useEffect } from 'react';
import { ChartNoAxesCombined, Search, Menu, Settings } from 'lucide-react'; // <-- ADDED Settings
import { useNavigate } from 'react-router-dom'; // <-- NEW IMPORT

const Navbar = ({ userData, role, toggleSidebar }) => {
  const navigate = useNavigate(); // Initialize navigation hook
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  
  const profileUrl =
    userData?.photoURL ||
      "https://www.gravatar.com/avatar/?d=mp&s=200";
  const displayName = userData?.displayName || 'User';

  const [goldRate, setGoldRate] = useState(62500.0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const change = (Math.random() - 0.5) * 50;
      setGoldRate((prev) => (parseFloat(prev) + change).toFixed(2));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSettingsClick = () => {
    // Navigate to the settings path defined in App.jsx
    navigate('/settings'); 
  };
  if (role === "Employee") return null;

  const handleSearch = async (text) => {
  setSearchQuery(text);

  if (!text.trim()) {
    setResults([]);
    return;
  }

  const q = text.toLowerCase();

  let res = [];

  // 🔵 Search Customers (from localStorage or fetch API)
  const customers = JSON.parse(localStorage.getItem("CUSTOMERS") || "[]");
  res.push(
    ...customers
      .filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.mobile?.includes(q)
      )
      .map(c => ({ type: "Customer", label: c.name, sub: c.mobile, id: c.id }))
  );

  // 🔵 Search Stock
  const stock = JSON.parse(localStorage.getItem("STOCK") || "[]");
  res.push(
    ...stock
      .filter(s =>
        s.stockId?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      )
      .map(s => ({ type: "Stock", label: s.stockId, sub: s.category }))
  );

  // 🔵 Search Estimations
  const estimations = JSON.parse(localStorage.getItem("ESTIMATIONS") || "[]");
  res.push(
    ...estimations
      .filter(e =>
        e.estimationId?.toLowerCase().includes(q) ||
        e.customerName?.toLowerCase().includes(q)
      )
      .map(e => ({
        type: "Estimation",
        label: e.estimationId,
        sub: e.customerName
      }))
  );

  // TODO: Add more search sources if needed (Orders, Investments, Employees)

  setResults(res);
};


  return (
    <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white/80 backdrop-blur-sm shadow-sm z-20 sticky top-0 border-b border-brown-100">
      {/* Left section: Menu button (for mobile) + Search */}
      <div className="flex items-center space-x-3 w-full">
        {/* Mobile Sidebar Toggle */}
        <button
          className="sm:hidden p-2 rounded-lg hover:bg-brown-50 transition"
          onClick={toggleSidebar}
        >
          <Menu className="w-6 h-6 text-brown-700" />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center space-x-4 sm:space-x-6 flex-shrink-0 ml-3">
        
        {/* Settings Icon (New Addition) */}
        <button
            onClick={handleSettingsClick}
            title="Settings and Profile"
            className="p-2 rounded-full text-gray-600 hover:bg-brown-100 hover:text-brown-700 transition hidden sm:block"
        >
            <Settings className="w-5 h-5" />
        </button>

        {/* Welcome text */}
        <div className="hidden sm:block text-right leading-tight">
          <p className="text-[11px] text-gray-500">Logged in as:</p>
          <p className="text-sm font-semibold text-gray-800 truncate max-w-[100px] sm:max-w-none">
            {/* {displayName.split(' ')[0]} */}
          </p>
        </div>

        {/* Profile + Role */}
        <div className="flex items-center space-x-2 sm:space-x-3 bg-white rounded-full hover:bg-brown-50/70 transition p-1 pl-2 sm:pl-2 border border-brown-100 shadow-sm">
          <img
            src={profileUrl}
            alt="Profile"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-brown-600"
            referrerPolicy="no-referrer"
          />
          <div className="hidden sm:block text-[11px] sm:text-xs font-medium text-brown-700 bg-brown-50 px-2 py-0.5 rounded-full">
            {role}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;