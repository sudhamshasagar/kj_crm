import React, { useState } from "react";
import { 
  Store, 
  User, 
  PlusCircle, 
  RotateCcw, 
  ChevronRight, 
  ArrowLeft,
  LayoutDashboard 
} from "lucide-react";
import B2BAssignmentForm from "./B2BAssignmentForm.jsx";
import B2BReturnForm from "./B2BReturnForm.jsx";
import B2JAssignmentForm from "./B2JAssignmentForm.jsx";
import B2JReturnForm from "./B2JReturnForm.jsx";
import { useAuth } from "../../AuthContext.js";

const FORMS_STRUCTURE = {
  b2b: {
    title: "B2B",
    subtitle: "B2B Transactions",
    icon: Store,
    forms: [
      {
        id: "b2b-assignment",
        name: "B2B Assignment",
        description: "Track materials or finished goods assigned to business partners.",
      },
      {
        id: "b2b-return",
        name: "B2B Return",
        description: "Log materials or goods returned from external business accounts.",
      },
    ],
  },
  b2j: {
    title: "B2J",
    subtitle: "Business-to-Jobwork (B2J)",
    icon: User,
    forms: [
      {
        id: "b2j-assignment",
        name: "Goldsmith Assignment",
        description: "Assign raw materials, gold, or tools to a Goldsmith for job work.",
      },
      {
        id: "b2j-return",
        name: "Goldsmith Return",
        description: "Document finished jewelry or unused material from the workshop.",
      },
    ],
  },
};

const FormsPage = () => {
  const { db, role, ROLES } = useAuth();
  const [activeTab, setActiveTab] = useState("b2b");
  const [view, setView] = useState("home");
  const [currentFormId, setCurrentFormId] = useState(null);

  const isDeveloper = role === ROLES.DEVELOPER;

  const handleFormSelection = (id) => {
    setCurrentFormId(id);
    setView("form");
  };

  // --- REFINED FORM VIEW ---
  const renderFormContent = () => {
    // Logic to find form details
    const category = currentFormId.split("-")[0];
    const formData = FORMS_STRUCTURE[category].forms.find(f => f.id === currentFormId);
    
    let FormComponent;
    if (currentFormId === "b2b-assignment") FormComponent = B2BAssignmentForm;
    else if (currentFormId === "b2b-return") FormComponent = B2BReturnForm;
    else if (currentFormId === "b2j-assignment") FormComponent = B2JAssignmentForm;
    else if (currentFormId === "b2j-return") FormComponent = B2JReturnForm;
    else FormComponent = () => <div className="p-10 text-center">Form not found.</div>;

    return (
      <div className="min-h-screen bg-slate-50/50 animate-in fade-in duration-500">
        {/* Sleek Header Bar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setView("home")}
              className="group flex items-center gap-2 text-slate-500 hover:text-brown-700 transition-colors"
            >
              <div className="p-2 rounded-full group-hover:bg-brown-50 transition-colors">
                <ArrowLeft size={20} />
              </div>
              <span className="font-medium">Back to Hub</span>
            </button>
            
            <div className="text-right">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {formData?.name}
              </h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-brown-600">
                {FORMS_STRUCTURE[category].title}
              </span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-4xl mx-auto py-10 px-4">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
             <div className="p-8 sm:p-12">
                <FormComponent
                    db={db}
                    onFormSuccess={() => setView("home")}
                    onBack={() => setView("home")}
                    isDeveloper={isDeveloper}
                />
             </div>
          </div>
        </div>
      </div>
    );
  };

  // --- SELECTION PAGE (HOME) ---
  const renderSelectionPage = () => (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="text-brown-600" size={24} />
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Operations Hub</h1>
        </div>
        <p className="text-slate-500 text-lg">Manage business assignments and workshop returns in one place.</p>
      </div>

      {/* Modern Segmented Control */}
      <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl mb-12 shadow-inner">
        {Object.entries(FORMS_STRUCTURE).map(([key, structure]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 px-10 py-3.5 rounded-xl font-bold transition-all duration-300 ${
              activeTab === key 
              ? "bg-white text-brown-700 shadow-sm scale-105" 
              : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <structure.icon size={20} />
            {structure.title}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {FORMS_STRUCTURE[activeTab].forms.map((form) => {
          const isReturn = form.id.includes("return");
          return (
            <div 
              key={form.id}
              onClick={() => handleFormSelection(form.id)}
              className="group relative bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-brown-300 hover:shadow-2xl transition-all duration-500 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${isReturn ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isReturn ? <RotateCcw size={28} /> : <PlusCircle size={28} />}
                </div>
                <div className="bg-slate-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="text-brown-600" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-800 mb-3">{form.name}</h3>
              <p className="text-slate-500 leading-relaxed max-w-[90%]">
                {form.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      {view === "home" ? renderSelectionPage() : renderFormContent()}
    </div>
  );
};

export default FormsPage;