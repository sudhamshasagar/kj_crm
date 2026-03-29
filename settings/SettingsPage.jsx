// src/components/settings/SettingsPage.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import { getEmployeeListCollection } from "../../firebaseConfig";

import {
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
} from "firebase/firestore";

import {
  Settings,
  ArrowLeft,
  Trash2,
  Plus,
  Briefcase,
  Gem,
  UserPlus,
  ChevronRight,
  Search,
  Info
} from "lucide-react";

const BROWN = {
  base: "#7b4b2a",
  dark: "#5f3920",
  pale: "#f7ede3",
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

/* ======================================================
   CONFIRM MODAL (INLINE, GLOBAL)
=========================================================*/
const ConfirmModal = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger = false,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {title}
        </h3>

        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-white font-semibold ${
              danger ? "bg-red-600 hover:bg-red-700" : ""
            }`}
            style={!danger ? { backgroundColor: BROWN.base } : {}}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

/* ======================================================
    EMPLOYEE MANAGER
=========================================================*/
const EmployeeManager = ({
  db,
  onBack,
  isAuthorized,
  openConfirm,
  closeConfirm,
}) => {
  const [type, setType] = useState("B2B");
  const [name, setName] = useState("");
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!db) return;

    const col = getEmployeeListCollection(type);
    const unsub = onSnapshot(query(col, orderBy("name")), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [db, type]);

  const handleAddRemove = async () => {
    if (!isAuthorized || !name.trim()) return;

    const col = getEmployeeListCollection(type);
    const upper = name.trim().toUpperCase();
    const existing = await getDocs(query(col, where("name", "==", upper)));

    if (!existing.empty) {
      openConfirm({
        title: "Remove Employee",
        message: `Are you sure you want to remove "${upper}"?`,
        danger: true,
        onConfirm: async () => {
          await deleteDoc(doc(col, existing.docs[0].id));
          closeConfirm();
        },
      });
    } else {
      openConfirm({
        title: "Add Employee",
        message: `Add "${upper}" to ${type} employees?`,
        onConfirm: async () => {
          await addDoc(col, {
            name: upper,
            type,
            createdAt: new Date().toISOString(),
          });
          closeConfirm();
        },
      });
    }

    setName("");
  };

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border-t-4"
      style={{ borderTopColor: BROWN.base }}
    >
      <div className="flex justify-between items-center border-b pb-3 mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Briefcase color={BROWN.base} />
          Manage Employees (B2B / B2J)
        </h2>
        <button onClick={onBack} className="text-gray-600 flex items-center">
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6 pb-4 border-b">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="p-3 rounded-lg border bg-gray-50"
        >
          <option value="B2B">B2B</option>
          <option value="B2J">B2J</option>
        </select>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Enter ${type} name`}
          className="flex-1 p-3 rounded-lg border bg-gray-50"
        />

        <button
          onClick={handleAddRemove}
          className="px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: BROWN.base }}
        >
          <Plus size={18} className="inline mr-1" />
          Add / Remove
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
        {employees.map((emp) => (
          <div
            key={emp.id}
            className="p-3 rounded-lg border bg-gray-50 flex justify-between items-center"
          >
            <span className="font-medium">{emp.name}</span>

            {isAuthorized && (
              <button
                onClick={() =>
                  openConfirm({
                    title: "Delete Employee",
                    message: `Delete "${emp.name}" permanently?`,
                    danger: true,
                    onConfirm: async () => {
                      await deleteDoc(
                        doc(getEmployeeListCollection(type), emp.id)
                      );
                      closeConfirm();
                    },
                  })
                }
                className="text-red-600"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ======================================================
    ORNAMENT MANAGER
=========================================================*/
const OrnamentManager = ({
  db,
  onBack,
  isAuthorized,
  openConfirm,
  closeConfirm,
}) => {
  const [name, setName] = useState("");
  const [list, setList] = useState([]);

  useEffect(() => {
    const col = collection(db, "ornamentCategories");
    const unsub = onSnapshot(query(col, orderBy("name")), (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db]);

  const handleAddRemove = async () => {
    if (!isAuthorized || !name.trim()) return;

    const col = collection(db, "ornamentCategories");
    const upper = name.trim().toUpperCase();
    const exists = await getDocs(query(col, where("name", "==", upper)));

    openConfirm({
      title: exists.empty ? "Add Ornament" : "Remove Ornament",
      message: exists.empty
        ? `Add "${upper}" category?`
        : `Remove "${upper}" category?`,
      danger: !exists.empty,
      onConfirm: async () => {
        if (!exists.empty) {
          await deleteDoc(doc(col, exists.docs[0].id));
        } else {
          await addDoc(col, {
            name: upper,
            prefix: upper.substring(0, 4),
            createdAt: new Date().toISOString(),
          });
        }
        closeConfirm();
      },
    });

    setName("");
  };

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border-t-4"
      style={{ borderTopColor: BROWN.base }}
    >
      <div className="flex justify-between items-center border-b pb-3 mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Gem color={BROWN.base} /> Manage Ornament Categories
        </h2>
        <button onClick={onBack} className="text-gray-600 flex items-center">
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter ornament name"
          className="flex-1 p-3 rounded-lg border bg-gray-50"
        />
        <button
          onClick={handleAddRemove}
          className="px-6 py-3 rounded-lg text-white"
          style={{ backgroundColor: BROWN.base }}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
        {list.map((o) => (
          <div
            key={o.id}
            className="p-3 rounded-lg border bg-gray-50 flex justify-between"
          >
            <span>{o.name}</span>
            {isAuthorized && (
              <button
                onClick={() =>
                  openConfirm({
                    title: "Delete Category",
                    message: `Delete "${o.name}"?`,
                    danger: true,
                    onConfirm: async () => {
                      await deleteDoc(
                        doc(collection(db, "ornamentCategories"), o.id)
                      );
                      closeConfirm();
                    },
                  })
                }
                className="text-red-600"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ======================================================
   CUSTOM PRODUCT NAMES
=========================================================*/
const CustomProductNameManager = ({
  db,
  onBack,
  isAuthorized,
  openConfirm,
  closeConfirm,
}) => {
  const [name, setName] = useState("");
  const [names, setNames] = useState([]);

  useEffect(() => {
    const col = collection(db, "CUSTOM_PRODUCT_NAMES");
    const unsub = onSnapshot(query(col, orderBy("name")), (snap) => {
      setNames(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db]);

  const handleAddRemove = async () => {
    if (!isAuthorized || !name.trim()) return;

    const col = collection(db, "CUSTOM_PRODUCT_NAMES");
    const upper = name.trim().toUpperCase();
    const exists = await getDocs(query(col, where("name", "==", upper)));

    openConfirm({
      title: exists.empty ? "Add Name" : "Remove Name",
      message: exists.empty
        ? `Add "${upper}"?`
        : `Remove "${upper}"?`,
      danger: !exists.empty,
      onConfirm: async () => {
        if (!exists.empty) {
          await deleteDoc(doc(col, exists.docs[0].id));
        } else {
          await addDoc(col, {
            name: upper,
            createdAt: new Date().toISOString(),
          });
        }
        closeConfirm();
      },
    });

    setName("");
  };

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border-t-4"
      style={{ borderTopColor: BROWN.base }}
    >
      <div className="flex justify-between items-center border-b pb-3 mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserPlus color={BROWN.base} /> Manage Custom Product Names
        </h2>
        <button onClick={onBack} className="text-gray-600 flex items-center">
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter custom product name"
          className="flex-1 p-3 rounded-lg border bg-gray-50"
        />
        <button
          onClick={handleAddRemove}
          className="px-6 py-3 rounded-lg text-white"
          style={{ backgroundColor: BROWN.base }}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
        {names.map((n) => (
          <div
            key={n.id}
            className="p-3 rounded-lg border bg-gray-50 flex justify-between"
          >
            <span>{n.name}</span>
            {isAuthorized && (
              <button
                onClick={() =>
                  openConfirm({
                    title: "Delete Name",
                    message: `Delete "${n.name}"?`,
                    danger: true,
                    onConfirm: async () => {
                      await deleteDoc(
                        doc(db, "CUSTOM_PRODUCT_NAMES", n.id)
                      );
                      closeConfirm();
                    },
                  })
                }
                className="text-red-600"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
const ManagerLayout = ({ title, icon: Icon, onBack, children, inputPlaceholder, inputValue, onInputChange, onAdd, typeSelect }) => (
  <div className="w-full max-w-5xl animate-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between mb-6">
      <button onClick={onBack} className="group flex items-center text-slate-500 hover:text-[#7b4b2a] transition-colors">
        <div className="p-2 group-hover:bg-amber-50 rounded-full transition-colors mr-2">
          <ArrowLeft size={20} />
        </div>
        <span className="font-medium">Back to Settings</span>
      </button>
    </div>

    <Card>
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
            <Icon size={24} className="text-[#7b4b2a]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          {typeSelect}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#7b4b2a]/20 focus:border-[#7b4b2a] outline-none transition-all"
            />
          </div>
          <button
            onClick={onAdd}
            className="px-8 py-3 bg-[#7b4b2a] text-white font-bold rounded-xl hover:bg-[#5f3920] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
          >
            <Plus size={20} /> Add
          </button>
        </div>
      </div>

      <div className="p-6 bg-white min-h-[300px]">
        {children}
      </div>
    </Card>
  </div>
);

/* ======================================================
   MAIN SETTINGS PAGE
=========================================================*/
const SettingsPage = () => {
  const { db, role } = useAuth();
  const isAuthorized = role === "Admin" || role === "Developer";
  const [view, setView] = useState("home");
  const [name, setName] = useState("");
  const [list, setList] = useState([]);
  const [type, setType] = useState("B2B"); // For employees
  
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", danger: false, onConfirm: null });

  const openConfirm = (cfg) => setConfirm({ ...cfg, open: true });
  const closeConfirm = () => setConfirm({ ...confirm, open: false });

  // Real-time Sync logic
  useEffect(() => {
    if (!db) return;
    let colRef;
    if (view === "employees") colRef = getEmployeeListCollection(type);
    else if (view === "ornaments") colRef = collection(db, "ornamentCategories");
    else if (view === "customNames") colRef = collection(db, "CUSTOM_PRODUCT_NAMES");
    else return;

    const unsub = onSnapshot(query(colRef, orderBy("name")), (snap) => {
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db, view, type]);

  const handleGlobalAdd = async () => {
    if (!isAuthorized || !name.trim()) return;
    const upper = name.trim().toUpperCase();
    let colRef;
    
    if (view === "employees") colRef = getEmployeeListCollection(type);
    else if (view === "ornaments") colRef = collection(db, "ornamentCategories");
    else colRef = collection(db, "CUSTOM_PRODUCT_NAMES");

    const exists = await getDocs(query(colRef, where("name", "==", upper)));

    openConfirm({
      title: exists.empty ? "Confirm Addition" : "Remove Existing?",
      message: exists.empty ? `Add "${upper}" to the database?` : `"${upper}" already exists. Remove it?`,
      danger: !exists.empty,
      onConfirm: async () => {
        if (!exists.empty) await deleteDoc(doc(colRef, exists.docs[0].id));
        else {
            const payload = { name: upper, createdAt: new Date().toISOString() };
            if (view === "ornaments") payload.prefix = upper.substring(0, 4);
            if (view === "employees") payload.type = type;
            await addDoc(colRef, payload);
        }
        setName("");
        closeConfirm();
      }
    });
  };

  const deleteItem = (item) => {
    let colRef;
    if (view === "employees") colRef = getEmployeeListCollection(type);
    else if (view === "ornaments") colRef = collection(db, "ornamentCategories");
    else colRef = collection(db, "CUSTOM_PRODUCT_NAMES");

    openConfirm({
      title: "Delete Entry",
      message: `Are you sure you want to permanently delete "${item.name}"?`,
      danger: true,
      onConfirm: async () => {
        await deleteDoc(doc(colRef, item.id));
        closeConfirm();
      }
    });
  };

  const renderManager = (title, icon, placeholder, typeSel = null) => (
    <ManagerLayout 
      title={title} icon={icon} onBack={() => setView("home")}
      inputValue={name} onInputChange={setName} onAdd={handleGlobalAdd}
      inputPlaceholder={placeholder} typeSelect={typeSel}
    >
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 ">
          <Info size={48} className="mb-4 opacity-20" />
          <p>No entries found. Add your first one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-y-auto max-h-[90vh]">
          {list.map((item) => (
            <div key={item.id} className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-md hover:border-amber-200 transition-all">
              <span className="font-semibold text-slate-700">{item.name}</span>
              {isAuthorized && (
                <button onClick={() => deleteItem(item)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );

  return (
    <div className="max-h-[95vh] overflow-hidden bg-[#f8fafc] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#7b4b2a] rounded-2xl shadow-lg shadow-amber-900/20">
            <Settings className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Settings</h1>
            <p className="text-slate-500 font-medium">Configure and manage application data</p>
          </div>
        </div>
        {view !== "home" && (
             <div className="hidden md:block px-4 py-2 bg-amber-100 text-[#7b4b2a] rounded-full text-sm font-bold">
                {role} Access
             </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto flex justify-center">
        {view === "home" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <SettingsCard icon={Briefcase} title="Employees" desc="Manage B2B & B2J staff" onClick={() => setView("employees")} />
            <SettingsCard icon={Gem} title="Ornaments" desc="Category & prefix config" onClick={() => setView("ornaments")} />
            <SettingsCard icon={UserPlus} title="Product Names" desc="Custom inventory labels" onClick={() => setView("customNames")} />
          </div>
        ) : view === "employees" ? (
          renderManager("Employee Management", Briefcase, "Search or add name...", (
            <select 
              value={type} onChange={(e) => setType(e.target.value)}
              className="px-4 py-3 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#7b4b2a]/20"
            >
              <option value="B2B">B2B Dept</option>
              <option value="B2J">B2J Dept</option>
            </select>
          ))
        ) : view === "ornaments" ? (
          renderManager("Ornament Categories", Gem, "Enter category name...")
        ) : (
          renderManager("Custom Product Names", UserPlus, "Enter product name...")
        )}
      </div>

      <ConfirmModal {...confirm} onCancel={closeConfirm} />
    </div>
  );
};
/* CARD */
const SettingsCard = ({ icon: Icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-[#7b4b2a]/30 transition-all duration-300 text-left overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={120} />
    </div>
    
    <div className="relative z-10">
        <div className="mb-5 inline-block p-4 rounded-2xl bg-slate-50 group-hover:bg-amber-50 group-hover:text-[#7b4b2a] transition-colors">
            <Icon size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-[#7b4b2a] transition-colors">{title}</h3>
        <p className="text-slate-500 mb-6 text-sm">{desc}</p>
        
        <div className="flex items-center text-xs font-bold uppercase tracking-wider text-[#7b4b2a] opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
            Manage Now <ChevronRight size={14} className="ml-1" />
        </div>
    </div>
  </button>
);

export default SettingsPage;
