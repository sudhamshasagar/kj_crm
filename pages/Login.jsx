// src/Login.jsx
import React, { useState, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { LogOut, ShieldCheck, Hammer, Users, ChevronRight, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const { role, ROLES, loginWithGoogle, submitRegistrationRequest, logout, user } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [requestedRole, setRequestedRole] = useState(ROLES.EMPLOYEE);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const registrationRoles = useMemo(() => [
    { id: ROLES.EMPLOYEE, label: 'Sales Staff', icon: Users },
    { id: ROLES.GOLDSMITH, label: 'Goldsmith', icon: Hammer },
  ], [ROLES]);

  const handleGoogleLogin = async () => {
    setError(null);
    setMessage(null);
    setIsProcessing(true);
    try {
      const result = await loginWithGoogle();
      const currentUser = result.user;
      
      if (isRegistering && currentUser) {
        // Logic to prevent re-requesting if already assigned
        const publicRoles = [ROLES.ADMIN, ROLES.DEVELOPER, ROLES.EMPLOYEE, ROLES.GOLDSMITH];
        if (!publicRoles.includes(role)) {
          await submitRegistrationRequest(
            currentUser.uid,
            currentUser.email,
            currentUser.displayName,
            requestedRole
          );
          setMessage(`Success! Access request for ${requestedRole} submitted.`);
          await logout();
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
      if (user) await logout();
    } finally {
      setIsProcessing(false);
    }
  };

  if (role === ROLES.UNAPPROVED) {
    return <AccessPendingView onLogout={logout} />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans selection:bg-amber-100">
      {/* Left Branding Panel: Trust & Scale */}
      <div className="hidden lg:flex lg:w-7/12 bg-[#1a1c1e] relative overflow-hidden flex-col justify-between p-16">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          {/* Subtle grid pattern or architectural lines */}
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', size: '40px 40px' }} />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-5xl font-light text-white leading-tight">
            Crafting Digital <br /> 
            <span className="font-serif italic text-amber-400">Excellence</span> for <br />
            Luxury Assets.
          </h1>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8">
          <FeatureItem icon={ShieldCheck} title="Enterprise Security" desc="End-to-end encrypted inventory management." />
          <FeatureItem icon={Users} title="Role-based Access" desc="Precise control for staff and artisans." />
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-md">
         <img src="/kc2.png" alt="Elevate Jewellers Logo" className="w-32 mb-5 justify-center m-auto" /> 

          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome to CRM</h2>
            <p className="text-slate-500 mt-2 text-sm">Secure access for Keshav Jewellers Internal Portal</p>

          </div>

          {/* Secure Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
            <ToggleButton active={!isRegistering} onClick={() => setIsRegistering(false)} label="Sign In" />
            <ToggleButton active={isRegistering} onClick={() => setIsRegistering(true)} label="Request Access" />
          </div>

          {/* Feedback UI */}
          {error && <AlertBox variant="error" text={error} />}
          {message && <AlertBox variant="success" text={message} />}

          <div className="space-y-6">
            {isRegistering && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Select Professional Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {registrationRoles.map((r) => (
                    <RoleCard 
                      key={r.id} 
                      role={r} 
                      selected={requestedRole === r.id} 
                      onClick={() => setRequestedRole(r.id)} 
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isProcessing}
              className="group relative w-full flex items-center justify-center py-3.5 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all duration-200 shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="h-5 w-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-3" alt="G" />
                  <span className="font-semibold text-slate-700">Continue with Google</span>
                  <ChevronRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </>
              )}
            </button>
          </div>

          <p className="mt-12 text-center text-xs text-slate-400 font-medium">
            SECURE PORTAL &bull; VERSION 2.1.0 &bull; &copy; {new Date().getFullYear()}
          </p>
          <p className="mt-2 text-center text-xs text-slate-400 font-medium">Powered by elv8.works</p>

        </div>
      </div>
    </div>
  );
};

// --- Sub-Components for Cleanliness ---

const FeatureItem = ({ icon: Icon, title, desc }) => (
  <div className="flex flex-col gap-2">
    <Icon className="text-amber-500 w-6 h-6" />
    <h3 className="text-white font-medium">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
  </div>
);

const ToggleButton = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
      active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
    }`}
  >
    {label}
  </button>
);

const RoleCard = ({ role, selected, onClick }) => {
  const Icon = role.icon;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
        selected ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
      }`}
    >
      <Icon className={`w-6 h-6 mb-2 ${selected ? 'text-amber-600' : 'text-slate-400'}`} />
      <span className="text-sm font-medium">{role.label}</span>
    </button>
  );
};

const AlertBox = ({ variant, text }) => (
  <div className={`flex items-center gap-3 p-4 rounded-xl text-sm mb-6 ${
    variant === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  }`}>
    <AlertCircle className="w-4 h-4 shrink-0" />
    <p>{text}</p>
  </div>
);

const AccessPendingView = ({ onLogout }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-slate-100">
      <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldCheck className="w-10 h-10 text-amber-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Verification in Progress</h2>
      <p className="text-slate-500 mb-8 leading-relaxed">
        To ensure shop security, an administrator must verify your identity before you can access the CRM.
      </p>
      <button
        onClick={onLogout}
        className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  </div>
);

export default LoginPage;