import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, Phone, ShieldCheck, Sparkles, MoveRight, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

interface AuthScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  // Initialize Supabase client
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || "";
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Multi-step Auth state
  // 1: Account Info, 2: SMS code verification
  const [authStep, setAuthStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [smsTimer, setSmsTimer] = useState(0);

  // Temporary container for newly registered user during SMS verification
  const [registeredUser, setRegisteredUser] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    if (smsTimer > 0) {
      interval = setInterval(() => {
        setSmsTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [smsTimer]);

  const handleError = (msg: string) => {
    setError(msg);
    setSuccess("");
    setLoading(false);
  };

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setError("");
    setLoading(false);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !phone) {
      return handleError("Veuillez remplir tous les champs requis, y compris votre numéro de téléphone.");
    }

    setLoading(true);
    setError("");

    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.error || "Une erreur est survenue lors de l'inscription.");
      }

      // Successful first registration step, now send verification SMS code
      setRegisteredUser(regData.user);
      await triggerSendSMS(phone, regData.user.uid);
      setAuthStep(2); // Go to SMS Code validation step
    } catch (err: any) {
      handleError(err.message);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return handleError("Veuillez saisir votre email et votre mot de passe.");
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Identifiants invalides.");
      }

      // If user is verified, login. Else force verification stage
      if (data.user.isSmsVerified) {
        onLoginSuccess(data.user);
      } else {
        setRegisteredUser(data.user);
        setPhone(data.user.phone || "");
        await triggerSendSMS(data.user.phone || "+2290190000000", data.user.uid);
        setAuthStep(2);
      }
    } catch (err: any) {
      handleError(err.message);
    }
  };

  const triggerSendSMS = async (phoneNumber: string, userId: string) => {
    if (!supabase) {
      return handleError("Le client de base de données n'est pas initialisé.");
    }
    setLoading(true);
    setError("");
    try {
      const smsRes = await fetch("/api/auth/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, userId }),
      });
      const smsData = await smsRes.json();
      if (!smsRes.ok) {
        throw new Error(smsData.error || "Impossible d'enregistrer le numéro de téléphone.");
      }

      // Envoi du code OTP réel via le système d'authentification par SMS de Supabase
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });
      if (error) {
        throw error;
      }

      setSmsTimer(60);
      handleSuccess("Un code de vérification SMS réel a été envoyé.");
    } catch (err: any) {
      handleError(err.message || "Erreur lors de l'envoi du code SMS.");
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      return handleError("Veuillez saisir le code de vérification reçu.");
    }
    if (!supabase) {
      return handleError("Le client de base de données n'est pas initialisé.");
    }

    setLoading(true);
    setError("");

    try {
      // Vérification du code SMS via Supabase Auth
      const { error } = await supabase.auth.verifyOtp({
        phone: registeredUser.phone,
        token: verificationCode,
        type: "sms",
      });

      if (error) {
        throw error;
      }

      // Mise à jour du statut dans notre propre base de données via notre API
      const verifyRes = await fetch("/api/auth/verify-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: registeredUser.phone,
          userId: registeredUser.uid,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Erreur de validation de l'inscription.");
      }

      // Entièrement connecté et vérifié
      onLoginSuccess(verifyData.user);
    } catch (err: any) {
      handleError(err.message || "Code SMS incorrect ou expiré.");
    }
  };

  // Connexion Google OAuth réelle via Supabase Auth
  const handleGoogleSignIn = async () => {
    if (!supabase) {
      return handleError("Le client de base de données n'est pas initialisé.");
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      handleError(err.message || "Erreur de connexion Google.");
    } finally {
      setLoading(false);
    }
  };

  // Load and initialize Google Identity Services client-side dynamically
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    let initInterval = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        clearInterval(initInterval);
        
        try {
          (window as any).google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response: any) => {
              setLoading(true);
              setError("");
              try {
                // Decode token to retrieve user credentials client-side
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const jwt = JSON.parse(jsonPayload);

                // Authenticate and retrieve full session info
                const res = await fetch("/api/auth/google", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: jwt.name || jwt.email.split("@")[0],
                    email: jwt.email,
                    googleId: jwt.sub,
                  }),
                });
                const apiData = await res.json();
                if (!res.ok) throw new Error(apiData.error);
                onLoginSuccess(apiData.user);
              } catch (err: any) {
                handleError(err.message || "Erreur de connexion Google.");
              } finally {
                setLoading(false);
              }
            },
          });

          // Check if Google Sign-In container is rendered in HTML DOM
          const container = document.getElementById("google-signin-btn-container");
          if (container) {
            (window as any).google.accounts.id.renderButton(
              container,
              { 
                theme: "outline", 
                size: "large",
                width: 384,
                text: "signin_with",
                shape: "rectangular"
              }
            );
          }
        } catch (err) {
          console.error("Failed to initialize Google accounts script:", err);
        }
      }
    }, 100);

    return () => clearInterval(initInterval);
  }, []);

  // Check for Supabase session on component mount
  useEffect(() => {
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          // Fetch or create user profile in our database
          const res = await fetch("/api/auth/supabase-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || session.user.email?.split("@")[0],
              provider: session.user.app_metadata?.provider || "email",
              googleId: session.user.user_metadata?.sub,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error);
          }

          // Login successful
          onLoginSuccess(data.user);
        } catch (err: any) {
          console.error("Error processing Supabase auth:", err);
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const handlePhoneSubmitAfterGoogle = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone) {
      return handleError("Veuillez saisir votre numéro pour la vérification SMS obligatoire.");
    }
    await triggerSendSMS(phone, registeredUser.uid);
    setAuthStep(2);
  };

  return (
    <div id="auth-screen-layout" className="min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[#f8fafc]">
      {/* Editorial aesthetic design benefits pane - Left Column */}
      <div id="branding-pane" className="lg:col-span-5 bg-slate-900/[0.01] border-r border-slate-900/[0.06] text-slate-800 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Soft elegant glows */}
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center space-x-2.5">
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 p-2 rounded-xl text-white shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-lg text-emerald-600 font-sans">
            HUMAN_WRITER <span className="text-emerald-600">by</span> TECHNOVA
          </span>
        </div>

        <div className="relative my-auto space-y-8 py-12 lg:py-0">
          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Transformez l'IA en écriture <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">humaine</span>.
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed font-medium">
              Dites adieu aux détecteurs automatisés. Obtenez instantanément des textes réécrits de manière vivante, intelligente et authentique.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="mt-1 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-slate-850 text-sm font-bold">Rend vos textes 100% Humains</h4>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-medium">Formatage sémantique unique pour contourner les principaux filtres IA du marché.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-xs text-slate-400 font-mono tracking-wider font-semibold">
          © {new Date().getFullYear()} HUMAN_WRITER | ÉPURE & SÉCURISÉ | made by TECHNOVA
        </div>
      </div>

      {/* Main Form Fields Pane - Right Column */}
      <div id="form-fields-pane" className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 md:p-16 lg:p-24 bg-brand-bg relative">
        {/* Soft background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-white/70 border border-slate-900/[0.06] backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl shadow-slate-900/[0.04] space-y-6 relative z-10">
          
          {/* Section Headers */}
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {authStep === 2 
                ? "Vérification par SMS" 
                : authStep === 1.5 
                ? "Numéro de téléphone requis" 
                : isSignUp 
                ? "Créer votre compte sécurisé" 
                : "Heureux de vous revoir"
              }
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-2 font-medium">
              {authStep === 2 
                ? "Un code secret de sécurité vous a été envoyé pour authentifier votre identité." 
                : authStep === 1.5
                ? "Entrez votre numéro de téléphone pour recevoir le code d'activation SMS."
                : isSignUp 
                ? "Inscrivez-vous gratuitement pour commencer à humaniser vos textes." 
                : "Connectez-vous pour réécrire vos contenus de manière naturelle."
              }
            </p>
          </div>

          {/* Feedback messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 text-red-650 text-xs px-4 py-3 rounded-xl border border-red-500/20 font-semibold leading-relaxed shadow-sm"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-500/10 text-emerald-750 text-xs px-4 py-3 rounded-xl border border-emerald-500/20 font-semibold leading-relaxed shadow-sm"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multi-step Forms rendering */}
          {authStep === 1 && (
            <div className="space-y-6">
              <form onSubmit={isSignUp ? handleRegister : handleLogin} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <label className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">Nom complet</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jean Dupont"
                        className="w-full bg-white/80 text-slate-800 placeholder-slate-400 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                        required={isSignUp}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">Adresse E-mail</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      className="w-full bg-white/80 text-slate-800 placeholder-slate-400 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                {isSignUp && (
                  <div className="space-y-1.5">
                    <label className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">Téléphone (SMS Obligatoire)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+225 07 00 00 00 00"
                        className="w-full bg-white/80 text-slate-800 placeholder-slate-400 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                        required={isSignUp}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Entrez l'indicatif pays (ex: +225 pour la Côte d'Ivoire, +33 pour la France).</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">Mot de passe</label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/80 text-slate-800 placeholder-slate-400 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl py-3.5 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 transition-all focus:ring-4 focus:ring-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>{isSignUp ? "S'inscrire et recevoir le SMS" : "Se connecter"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Login Alternatives separator */}
              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-slate-200/80"></div>
                <span className="px-3 text-slate-400 text-2xs font-extrabold uppercase tracking-wider">ou</span>
                <div className="flex-grow border-t border-slate-200/80"></div>
              </div>

              {/* Google OAuth Button Container */}
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <div className="w-full mt-2 flex justify-center">
                  <div id="google-signin-btn-container" className="w-full max-w-sm"></div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-bold border border-slate-200 rounded-xl py-3 flex items-center justify-center space-x-2.5 shadow-sm transition-transform transform active:scale-97 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-700" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  )}
                  <span className="text-xs">Se connecter avec Google</span>
                </button>
              )}

              <div className="text-center mt-6">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-bold text-xs transition-colors"
                >
                  {isSignUp ? "Déjà un compte ? Connectez-vous" : "Pas encore inscrit ? Créez un compte gratuitement"}
                </button>
              </div>
            </div>
          )}

          {/* Verification Step 1.5 - Phone collection after Google */}
          {authStep === 1.5 && (
            <form onSubmit={handlePhoneSubmitAfterGoogle} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">Numéro de Téléphone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full bg-white/80 text-slate-800 placeholder-slate-400 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Le numéro de téléphone est requis pour valider votre compte par SMS sécurisé.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl py-3.5 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 active:scale-98"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Envoyer le code SMS"}
              </button>
            </form>
          )}

          {/* Verification Step 2 - Validating SMS code */}
          {authStep === 2 && (
            <div className="space-y-6">
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-slate-500 text-[10px] font-bold tracking-wider uppercase block text-center">Code de Sécurité SMS</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Saisir les 6 chiffres"
                    maxLength={6}
                    className="w-full bg-white/80 text-slate-850 placeholder-slate-350 tracking-[0.4em] text-xl font-bold text-center rounded-xl p-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl py-3.5 flex items-center justify-center space-x-2 transition-all active:scale-98"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Confirmer mon identité"}
                </button>
              </form>

              <div className="flex justify-between items-center text-xs mt-4">
                <button
                  onClick={() => triggerSendSMS(registeredUser.phone, registeredUser.uid)}
                  disabled={smsTimer > 0 || loading}
                  className="text-slate-500 hover:text-slate-800 font-semibold disabled:opacity-50 transition-colors"
                >
                  {smsTimer > 0 ? `Renvoyer le code (${smsTimer}s)` : "Renvoyer un nouveau code"}
                </button>

                <button
                  onClick={() => {
                    setAuthStep(1);
                    setError("");
                    setSuccess("");
                    setVerificationCode("");
                    setSentCode("");
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                >
                  Changer de numéro
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Layout footer elements */}
    </div>
  );
}
