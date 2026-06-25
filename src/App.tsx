import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import AuthScreen from "./components/AuthScreen";
import HumanizerWorkspace from "./components/HumanizerWorkspace";
import PaymentModal from "./components/PaymentModal";
import { Activity, Sparkles, Star, ShieldAlert } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; mode: string } | null>(null);

  // Persistence check on boot
  useEffect(() => {
    const savedUser = localStorage.getItem("human_writer_session");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Failed to parse saved user credentials:", err);
      }
    }
    setAuthChecked(true);

    // Fetch database connectivity status
    fetch("/api/db/status")
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch((err) => console.error("Error reading database status:", err));
  }, []);

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setShowAuth(false);
    localStorage.setItem("human_writer_session", JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    setShowAuth(false);
    localStorage.removeItem("human_writer_session");
  };

  const handlePaymentSuccess = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem("human_writer_session", JSON.stringify(updatedUser));
  };

  if (!authChecked) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-bg text-slate-800 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-emerald-500/10"></div>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent relative"></div>
        </div>
        <span className="text-[10px] font-extrabold text-emerald-600 font-mono tracking-widest uppercase animate-pulse">Chargement sécurisé...</span>
      </div>
    );
  }

  // If there's no logged-in user and we aren't showing auth, we use guest user session
  const guestUser = { uid: "guest", name: "Visiteur Anonyme", isPremium: false, isGuest: true };
  const effectiveUser = user || guestUser;
  const isShowingWorkspace = !user && !showAuth || !!user;

  return (
    <div id="app-root-layout" className="min-h-screen bg-brand-bg text-slate-800 flex flex-col justify-between selection:bg-emerald-500/10 selection:text-emerald-600">
      
      {/* Dynamic top navigation header bar - Only show when showing workspace */}
      {isShowingWorkspace && (
        <header className="bg-white/40 border-b border-slate-900/[0.06] backdrop-blur-md py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <div className="flex items-center space-x-2.5">
              <div className="bg-slate-900/[0.02] border border-slate-900/[0.06] p-2 rounded-xl text-slate-800 flex items-center justify-center shadow-inner">
                <Sparkles className="h-4.5 w-4.5 text-emerald-500 fill-emerald-500/10" />
              </div>
              <div>
                <span className="font-black text-sm tracking-widest text-slate-800 uppercase font-sans">
                  Human_Writer by TECHNOVA
                </span>
                <span className="text-[9px] text-emerald-600 font-bold block leading-none font-mono tracking-wider">INTELLIGENT REPHRASE</span>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2.5 justify-center">
              {/* Premium Status Badge / Free Trial Upgrade Trigger */}
              <div className="flex items-center space-x-3 text-xs">
                {effectiveUser.isGuest ? (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-650 hover:to-teal-650 text-white font-extrabold px-3.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer text-[10px] uppercase tracking-widest shadow-md active:scale-97"
                  >
                    Se connecter
                  </button>
                ) : effectiveUser.isPremium ? (
                  <div className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-extrabold px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 uppercase tracking-wider text-[10px] shadow-[0_4px_12px_rgba(245,158,11,0.06)]">
                    <Star className="h-3.5 w-3.5 fill-amber-500/20 text-amber-500" />
                    <span>Membre Premium</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPaymentOpen(true)}
                    className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-600 font-extrabold border border-emerald-500/20 hover:border-emerald-500/35 px-3.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer text-[10px] uppercase tracking-widest shadow-inner active:scale-97"
                  >
                    🚀 Passer en premium  
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Primary body screen switcher routing pattern */}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          {!user && showAuth ? (
            <motion.div
              key="auth-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen"
            >
              <AuthScreen 
                onLoginSuccess={handleLoginSuccess} 
                onBackToWorkspace={() => setShowAuth(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace-screen"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <HumanizerWorkspace
                user={effectiveUser}
                onLogout={effectiveUser.isGuest ? () => setShowAuth(true) : handleLogout}
                onTriggerPremiumUpgrade={effectiveUser.isGuest ? () => setShowAuth(true) : () => setIsPaymentOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Highly secure payments popup */}
      <AnimatePresence>
        {isPaymentOpen && user && (
          <PaymentModal
            user={user}
            onClose={() => setIsPaymentOpen(false)}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
