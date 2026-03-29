import React, { useState, useEffect, use } from 'react';
import { 
  Store, Users, List, TrendingUp, ArrowLeft, Clock, 
  Briefcase, Gem, ChevronRight, Search, Wallet 
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { B2B_MASTER_LOG, B2J_MASTER_LOG } from '../../firebaseConfig';
import { Download, Mail, Loader2 } from 'lucide-react'; // Add these imports
import { getDocs, query, where,addDoc, collection, serverTimestamp,doc, onSnapshot,runTransaction} from 'firebase/firestore';
import EmployeeTransactionProfile from "./EmployeeTransactionProfile";
import { useB2BEmployees } from '../../hooks/useB2BEmployees';
import { useB2JEmployees } from '../../hooks/useB2JEmployees'; 
import toast from 'react-hot-toast';    
import { downloadFullOperationalAudit } from '../../utils/operationalAuditService';


// ----------------------------------------------------
// HELPER: Fetch Last Remaining Balance (Universal)
// ----------------------------------------------------
const fetchLastRemainingBalance = async (db, employeeName, logCollection, businessType) => {
    try {
        const q = query(logCollection, where("employeeName", "==", employeeName));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return 0;
        
        let totalAssigned = 0;
        let totalReturned = 0;

        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (businessType === "B2B") {
                if (data.transactionType === "ASSIGNMENT") {
                    totalAssigned += Number(data.rawMaterialWeight || 0);
                }
                if (data.transactionType && data.transactionType.includes("RETURN")) {
                    totalReturned += (Number(data.returnedWeight || 0) + Number(data.wastage || 0));
                }
            } else {
                // B2J Logic
                if (data.transactionType === "ASSIGNMENT") {
                    totalAssigned += Number(data.effectiveGoldAssigned || 0);
                }
                if (data.transactionType && data.transactionType.includes("RETURN")) {
                    let effReturned = Number(data.effectiveGoldReturned || 0);
                    if (effReturned === 0 && (data.returnedWeight || data.wastage)) {
                        const totalWt = Number(data.returnedWeight || 0) + Number(data.wastage || 0);
                        const purity = Number(data.purity || data.rawMaterialPurity || 0);
                        effReturned = (totalWt * purity) / 100;
                    }
                    totalReturned += effReturned;
                }
            }
        });
        return totalAssigned - totalReturned;
    } catch (error) {
        console.error(`Error fetching balance for ${employeeName}:`, error);
        return 0;
    }
};



// ----------------------------------------------------
// VIEW 2: EMPLOYEE LIST TABLE (Responsive)
// ----------------------------------------------------
const EmployeeListTable = ({ type, onBack, onViewTransactions }) => {
    const { db } = useAuth();
    const useEmployeeHook = type === 'B2B' ? useB2BEmployees : useB2JEmployees;
    const logCollection = type === 'B2B' ? B2B_MASTER_LOG : B2J_MASTER_LOG;
    const title = type === 'B2B' ? 'B2B Partners' : 'B2J Goldsmiths';
    
    const { employees, isLoading: loadingEmployees } = useEmployeeHook();
    const [employeeData, setEmployeeData] = useState([]);
    const [loadingBalances, setLoadingBalances] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    useEffect(() => {
        if (!db || loadingEmployees) return;

        const allEmployees = employees.map(e => ({ ...e, businessType: type, logRef: logCollection }));
        
        const calculateAllBalances = async () => {
            setLoadingBalances(true);
            const dataWithBalances = [];

            for (const emp of allEmployees) {
                const balance = await fetchLastRemainingBalance(db, emp.name, emp.logRef, type);
                dataWithBalances.push({
                    ...emp,
                    balance: balance,
                    status: balance < -0.001 ? 'Debt' : (balance > 0.001 ? 'Credit' : 'Balanced'),
                    statusColor: balance < -0.001 ? 'text-red-700 bg-red-50 border-red-200' : (balance > 0.001 ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-600 bg-gray-50 border-gray-200')
                });
            }
            
            dataWithBalances.sort((a, b) => a.name.localeCompare(b.name));
            setEmployeeData(dataWithBalances);
            setLoadingBalances(false);
        };

        calculateAllBalances();
    }, [db, loadingEmployees, employees, type, logCollection]);

    // Filter Logic
    const filteredData = employeeData.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return (
        <div className=" dashboard-bg h-full flex flex-col bg-slate-50 premium-scroll">
            {/* Header */}
            <div className="bg-white px-4 py-4 md:px-6 md:py-5 border-b border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors md:hidden">
                        <ArrowLeft className="w-5 h-5 text-gray-600"/>
                    </button>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                            {type === 'B2B' ? <Briefcase className="w-5 h-5 text-blue-600" /> : <Gem className="w-5 h-5 text-amber-600" />}
                            {title}
                        </h2>
                        <p className="text-xs text-gray-500 hidden md:block">Select a partner to view details</p>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        <input 
                            type="text" 
                            placeholder="Search name..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>
                    <button onClick={onBack} className="hidden md:flex items-center px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">
                        <ArrowLeft className="w-4 h-4 mr-2"/> Back
                    </button>
                </div>
            </div>
            
            {/* Content List */}
            <div className="flex-1 overflow-y-auto premium-scroll p-4 md:p-6">
                {loadingBalances ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Clock className="w-8 h-8 animate-spin mb-3 text-amber-500" />
                        <p className="text-sm font-medium">Calculating live balances...</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4">Partner Name</th>
                                        <th className="px-6 py-4 text-right">Net Balance (g)</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-amber-50/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 text-base">{emp.name}</div>
                                                <div className="text-xs text-gray-400">{emp.email || "No email linked"}</div>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold text-base ${emp.balance > 0.001 ? 'text-red-600' : 'text-green-700'}`}>
                                                {Math.abs(emp.balance).toFixed(3)} g
                                                <span className="text-xs text-gray-400 font-normal ml-1"></span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${emp.statusColor}`}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => onViewTransactions(emp.name, emp.businessType)}
                                                    className="bg-white border border-gray-200 text-gray-700 hover:text-amber-700 hover:border-amber-300 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
                                                >
                                                    View Ledger <ChevronRight className="w-3 h-3"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredData.map((emp) => (
                                <div 
                                    key={emp.id} 
                                    onClick={() => onViewTransactions(emp.name, emp.businessType)}
                                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{emp.name}</h3>
                                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{emp.email || "No Email"}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${emp.statusColor}`}>
                                            {emp.status}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-gray-400">Net Balance</span>
                                            <span className={`text-xl font-bold font-mono ${emp.balance > 0.001 ? 'text-red-600' : 'text-green-700'}`}>
                                                {Math.abs(emp.balance).toFixed(3)} <span className="text-sm">g</span>
                                            </span>
                                        </div>
                                        <button className="bg-gray-50 p-2.5 rounded-full text-gray-400 hover:bg-amber-100 hover:text-amber-600 transition-colors">
                                            <ChevronRight className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredData.length === 0 && (
                            <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                                <div className="bg-gray-100 p-4 rounded-full mb-3"><Users className="w-8 h-8 opacity-40"/></div>
                                <p>No partners found matching "{searchTerm}"</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ----------------------------------------------------
// MAIN HUB COMPONENT (Redesigned Entry)
// ----------------------------------------------------
const ManagementHub = () => {
    const { db } = useAuth();
    const [view, setView] = useState('home'); // 'home' | 'B2B' | 'B2J' | 'PROFILE'
    const [isExporting, setIsExporting] = useState(false);
    
    // State Wrapper for Profile Data
    const [selectedEmployeeForProfile, setSelectedEmployeeForProfile] = useState(null); 

    const approveCorrection = async (req) => {
    try {
        await runTransaction(db, async (t) => {
        const logRef = doc(db, req.targetCollection, req.targetDocId);
        const logSnap = await t.get(logRef);
        if (!logSnap.exists()) throw "Ledger missing";

        const updates = {};
        Object.entries(req.requestedChanges).forEach(([k, v]) => {
            updates[k] = v.new;
        });

        // Recalculate dependent values
        if (req.transactionType === "ASSIGNMENT") {
            const raw = updates.rawMaterialWeight ?? logSnap.data().rawMaterialWeight;
            const purity = updates.purity ?? logSnap.data().purity;
            updates.effectiveGoldAssigned = (raw * purity) / 100;
        }

        t.update(logRef, {
            ...updates,
            correctionRequested: false,
            lastEdited: serverTimestamp()
        });

        t.update(doc(db, "CORRECTION_REQUESTS", req.id), {
            status: "APPROVED",
            approvedAt: serverTimestamp()
        });
        });

        toast.success("Correction approved");
    } catch (e) {
        console.error(e);
        toast.error("Approval failed");
    }
    };


    const handleViewTransactions = (employeeName, businessType) => {
        setSelectedEmployeeForProfile({ name: employeeName, type: businessType });
        setView('PROFILE');
    };

    // Enhanced Navigation Card
    const CategoryCard = ({ icon: Icon, title, description, badge, colorClass, onClick }) => (
        <button 
            onClick={onClick} 
            className="group flex flex-col items-start p-6 md:p-8 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 w-full text-left relative overflow-hidden active:scale-[0.99]"
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass.bg} opacity-0 group-hover:opacity-10 rounded-bl-[100px] transition-opacity`}></div>
            
            <div className="flex justify-between w-full items-start mb-5 relative z-10">
                <div className={`p-3.5 rounded-2xl ${colorClass.iconBg} ${colorClass.text} shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7" />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wide border ${colorClass.badge} ${colorClass.border}`}>
                    {badge}
                </span>
            </div>
            
            <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 group-hover:text-amber-700 transition-colors relative z-10">
                {title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6 relative z-10 line-clamp-3 md:line-clamp-none">
                {description}
            </p>

            <div className="mt-auto flex items-center font-bold text-sm text-gray-400 group-hover:text-gray-900 transition-colors">
                View Ledger <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
        </button>
    );

    // RENDER LOGIC
    if (view === 'PROFILE' && selectedEmployeeForProfile) {
        return (
            <div className="bg-slate-50 min-h-screen">
                <EmployeeTransactionProfile 
                    employeeName={selectedEmployeeForProfile.name}
                    businessType={selectedEmployeeForProfile.type}
                    onBack={() => setView(selectedEmployeeForProfile.type)} // Go back to specific list
                />
            </div>
        );
    }

    if (view === 'B2B' || view === 'B2J') {
        return (
            <div className="bg-slate-50 h-screen flex flex-col overflow-hidden">
                <EmployeeListTable 
                    type={view} 
                    onBack={() => setView('home')}
                    onViewTransactions={handleViewTransactions}
                />
            </div>
        );
    }

    
        // DEFAULT HOME VIEW
    return (
  <div className="min-h-screen dashboard-bg p-4 md:p-10 flex flex-col">

    <div className="max-w-5xl mx-auto w-full">

      {/* HEADER */}
      <div className="mb-10 md:mb-14 mt-4">
        <p className="text-slate-500 mt-4 text-base md:text-lg max-w-2xl leading-relaxed">
          Select a business vertical below to manage partners, track gold
          assignments, and view detailed transaction histories.
        </p>

      </div>


      {/* CATEGORY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

        {/* B2B */}
        <CategoryCard
          icon={Briefcase}
          title="B2B Partners"
          description="Manage external business relationships, track issued stock, returns, and maintain wholesale ledger balances."
          badge="External"
          colorClass={{
            bg: 'from-blue-400 to-blue-600',
            iconBg: 'bg-blue-50',
            text: 'text-blue-600',
            badge: 'bg-blue-50 text-blue-700',
            border: 'border-blue-100'
          }}
          onClick={() => setView('B2B')}
        />

        {/* B2J */}
        <CategoryCard
          icon={Gem}
          title="B2J Goldsmiths"
          description="Track internal job work, raw material assignments, purity verification, and artisan ledger accounts."
          badge="Internal"
          colorClass={{
            bg: 'from-amber-400 to-amber-600',
            iconBg: 'bg-amber-50',
            text: 'text-amber-600',
            badge: 'bg-amber-50 text-amber-700',
            border: 'border-amber-100'
          }}
          onClick={() => setView('B2J')}
        />

      </div>

    </div>

  </div>
);
};

export default ManagementHub;