import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import AuthScreen from "./components/AuthScreen";
import HumanizerWorkspace from "./components/HumanizerWorkspace";
import PaymentModal from "./components/PaymentModal";
import { PrivacyPolicy, TermsOfService } from "./components/LegalPages";
import { Activity, Sparkles, Star, ShieldAlert } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; mode: string } | null>(null);

  // Persistence check on boot
  useEffect(() => {
    const savedUser = localStorage.getItem("humanizer_ai_session");
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
    localStorage.setItem("humanizer_ai_session", JSON.stringify(loggedInUser));
  };

  const handleLogout = async () => {
    setUser(null);
    setShowAuth(false);
    localStorage.removeItem("humanizer_ai_session");
    
    // Prevent Google One Tap from auto-logging in immediately
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.disableAutoSelect();
      } catch (err) {
        console.error("Failed to disable Google auto-select", err);
      }
    }

    // Sign out from Supabase
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Failed to sign out from Supabase", err);
      }
    }
  };

  const handlePaymentSuccess = (updatedUser: any) => {
    // Preserve the token from the current session
    const tokenToKeep = user?.token || updatedUser?.token;
    const userWithToken = { ...updatedUser, token: tokenToKeep };
    setUser(userWithToken);
    localStorage.setItem("humanizer_ai_session", JSON.stringify(userWithToken));
  };

  // Handle return from Moneroo payment checkout
  const [paymentVerifying, setPaymentVerifying] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentCallback = urlParams.get("payment") === "callback";
    const paymentId = urlParams.get("paymentId");
    const transactionId = localStorage.getItem("moneroo_transaction_id");

    if (isPaymentCallback && (paymentId || transactionId) && user?.token) {
      const txnId = paymentId || transactionId;
      setPaymentVerifying(true);

      fetch(`/api/payment/verify/${txnId}`, {
        headers: {
          "Authorization": `Bearer ${user.token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success" && data.user) {
            handlePaymentSuccess(data.user);
            setIsPaymentOpen(false);
          }
          // Clean up
          localStorage.removeItem("moneroo_transaction_id");
          // Remove query params from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          console.error("Payment verification error:", err);
        })
        .finally(() => {
          setPaymentVerifying(false);
        });
    }
  }, [user?.token]);
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

  // Simple routing for legal pages
  const path = window.location.pathname;
  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (path === '/terms') {
    return <TermsOfService />;
  }

  // Render workspace only if user is logged in
  const isShowingWorkspace = !!user;

  return (
    <div id="app-root-layout" className="min-h-screen bg-brand-bg text-slate-800 flex flex-col justify-between selection:bg-emerald-500/10 selection:text-emerald-600">
      
      {/* Dynamic top navigation header bar - Only show when showing workspace */}
      {isShowingWorkspace && (
        <header className="bg-white/40 border-b border-slate-900/[0.06] backdrop-blur-md py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <div className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="Humanizer AI Logo"
                className="h-9 w-9 rounded-xl shadow-md border border-slate-900/10 object-cover"
              />
              <div>
                <span className="font-black text-sm tracking-widest text-slate-800 uppercase font-sans">
                  Humanizer_AI by TECHNOVA
                </span>
                <span className="text-[9px] text-emerald-600 font-bold block leading-none font-mono tracking-wider">INTELLIGENT REPHRASE</span>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2.5 justify-center">
              {/* Premium Status Badge / Free Trial Upgrade Trigger */}
              <div className="flex items-center space-x-3 text-xs">
                {user.isPremium ? (
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
          {!user ? (
            <motion.div
              key="auth-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen"
            >
              <AuthScreen 
                onLoginSuccess={handleLoginSuccess} 
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
                user={user}
                onLogout={handleLogout}
                onTriggerPremiumUpgrade={() => setIsPaymentOpen(true)}
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
