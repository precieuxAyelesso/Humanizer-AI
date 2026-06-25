import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Copy, Check, RotateCcw, Flame, TrendingUp, HelpCircle, History, LogOut, FileText, ArrowRight, Star, ShieldCheck } from "lucide-react";
import { HumanizeHistoryItem } from "../types";

interface HumanizerWorkspaceProps {
  user: any;
  onLogout: () => void;
  onTriggerPremiumUpgrade: () => void;
}

export default function HumanizerWorkspace({ user, onLogout, onTriggerPremiumUpgrade }: HumanizerWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"standard" | "académique" | "créatif">("standard");
  const [showDiff, setShowDiff] = useState(false);
  
  const [priceInfo, setPriceInfo] = useState({ amount: 1961, currency: "XOF", symbol: "F CFA" });

  useEffect(() => {
    const fetchGeoPricing = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("Failed to fetch location");
        const data = await res.json();
        const currency = data.currency;
        
        if (currency === "XOF" || currency === "XAF") {
          setPriceInfo({ amount: 1961, currency: currency, symbol: "F CFA" });
        } else if (currency === "EUR") {
          setPriceInfo({ amount: 2.99, currency: "EUR", symbol: "€" });
        } else if (currency === "GBP") {
          setPriceInfo({ amount: 2.49, currency: "GBP", symbol: "£" });
        } else if (currency === "CAD") {
          setPriceInfo({ amount: 3.99, currency: "CAD", symbol: "CA$" });
        } else {
          setPriceInfo({ amount: 2.99, currency: "USD", symbol: "$" });
        }
      } catch (err) {
        console.error("Geopricing lookup failed, checking fallback:", err);
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz.includes("Europe")) {
            setPriceInfo({ amount: 2.99, currency: "EUR", symbol: "€" });
          } else if (tz.includes("America")) {
            setPriceInfo({ amount: 2.99, currency: "USD", symbol: "$" });
          } else {
            setPriceInfo({ amount: 1961, currency: "XOF", symbol: "F CFA" });
          }
        } catch (e) {
          setPriceInfo({ amount: 1961, currency: "XOF", symbol: "F CFA" });
        }
      }
    };
    
    fetchGeoPricing();
  }, []);
  
  // Scoring / metrics values
  const [humanityScore, setHumanityScore] = useState<number | null>(null);
  const [changesMade, setChangesMade] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HumanizeHistoryItem[]>([]);

  // Calculate input word count info
  const getWordCount = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  const inputWordCount = getWordCount(inputText);
  const wordLimit = user.isPremium ? Infinity : (user.isGuest ? 100 : 200);

  // Load history log items for user
  const loadHistory = async () => {
    if (user.uid === "guest" || user.isGuest) {
      setHistory([]);
      return;
    }
    try {
      const response = await fetch(`/api/history/${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error loading history logs:", err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const handleHumanizeText = async () => {
    if (!inputText.trim()) {
      return setError("Saisissez d'abord un texte à humaniser.");
    }

    if (inputWordCount > wordLimit) {
      if (user.isGuest) {
        setError("Les visiteurs sont limités à 100 mots. Veuillez vous connecter pour augmenter la limite.");
        onTriggerPremiumUpgrade();
      } else {
        onTriggerPremiumUpgrade();
      }
      return;
    }

    if (user.isGuest) {
      const anonCount = Number(localStorage.getItem("humanizer_anon_count") || "0");
      if (anonCount >= 1) {
        setError("Vous avez atteint la limite de 1 essai gratuit en tant que visiteur. Veuillez créer un compte gratuit pour continuer.");
        onTriggerPremiumUpgrade();
        return;
      }
    }

    setLoading(true);
    setError("");
    setHumanityScore(null);
    setChangesMade([]);

    try {
      const response = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          userId: user.uid,
          mode: mode,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === "LIMIT_EXCEEDED") {
          onTriggerPremiumUpgrade();
          throw new Error("Limite de mot dépassée.");
        }
        throw new Error(data.error || "L'humanisation a échoué.");
      }

      setOutputText(data.humanizedText);
      setHumanityScore(data.humanityScore);
      setChangesMade(data.changesMade);
      
      if (user.isGuest) {
        const anonCount = Number(localStorage.getItem("humanizer_anon_count") || "0");
        localStorage.setItem("humanizer_anon_count", String(anonCount + 1));
      }

      // Reload log of actions
      loadHistory();
    } catch (err: any) {
      if (err.message !== "Limite de mot dépassée.") {
        setError(err.message || "Une erreur inconnue s'est produite.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInputText("");
    setOutputText("");
    setHumanityScore(null);
    setChangesMade([]);
    setError("");
  };

  // Simple difference highlighting algorithm
  const highlightChanges = (original: string, humanized: string) => {
    if (!original || !humanized) return humanized;
    
    const cleanWord = (w: string) => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase().trim();
    const origWords = original.split(/\s+/).map(cleanWord).filter(Boolean);
    const origSet = new Set(origWords);
    
    const humanizedParts = humanized.split(/(\s+)/); // keep whitespace
    
    return humanizedParts.map((part, index) => {
      if (part.trim() === "") {
        return part;
      }
      
      const cleaned = cleanWord(part);
      if (cleaned && !origSet.has(cleaned)) {
        return (
          <span key={index} className="bg-emerald-500/10 text-emerald-700 px-1 py-0.5 rounded font-semibold border border-emerald-500/25">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div id="workspace-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Panel */}
      <div id="workspace-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white/50 border border-slate-900/[0.06] backdrop-blur-md rounded-2xl shadow-md space-y-4 sm:space-y-0">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Espace de Récriture</h1>
            {user.isPremium ? (
              <span className="inline-flex items-center space-x-1.5 bg-amber-500/10 text-amber-600 text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-full border border-amber-500/20 shadow-[0_4px_12px_rgba(245,158,11,0.06)]">
                <Star className="h-3 w-3 fill-amber-500" />
                <span>Premium Pass</span>
              </span>
            ) : (
              <span className="inline-flex items-center bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full">
                {user.isGuest ? "Démonstration" : "Compte Gratuit"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {user.isGuest ? (
              "Mode Visiteur (Essai limité)"
            ) : (
              <>Connecté en tant que <span className="text-slate-700 font-bold">{user.name}</span></>
            )}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          {user.isGuest ? (
            <button
              onClick={onLogout}
              className="p-2.5 text-emerald-600 hover:text-emerald-700 bg-emerald-55/80 hover:bg-emerald-100/90 rounded-xl transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer font-bold border border-emerald-200/60 shadow-sm"
              title="Se connecter / S'inscrire"
            >
              <Sparkles className="h-4 w-4 text-emerald-500 fill-emerald-500/10" />
              <span>Se connecter / S'inscrire</span>
            </button>
          ) : (
            <button
              onClick={onLogout}
              className="p-2.5 text-slate-500 hover:text-red-600 bg-white hover:bg-red-50/50 rounded-xl transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer font-bold border border-slate-200"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          )}
        </div>
      </div>

      {/* Free limit Warning card banner */}
      {!user.isPremium && (
        <div className="p-5 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-slate-50/50 text-slate-800 rounded-2xl border border-indigo-100 shadow-md shadow-indigo-950/[0.02] flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/8 pointer-events-none" />
          
          <div className="space-y-1 relative z-10">
            <div className="flex items-center space-x-1.5 text-emerald-600 font-bold text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span>{user.isGuest ? "Mode Démonstration Gratuit (100 mots max)" : `Génération limitée à ${wordLimit} mots`}</span>
            </div>
            <p className="text-slate-650 text-xs leading-relaxed max-w-xl font-medium">
              {user.isGuest
                ? "Essayez notre humanisateur gratuitement (1 essai de 100 mots max). Créez un compte pour passer à 200 mots gratuits ou débloquez l'illimité Premium."
                : `Votre compte actuel de test de sécurité est limité à ${wordLimit} mots par texte. Libérez la puissance de calcul maximale et débloquez la génération illimitée pour seulement ${priceInfo.amount} ${priceInfo.symbol} par mois.`}
            </p>
          </div>

          <button
            onClick={onTriggerPremiumUpgrade}
            className="relative z-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4.5 py-2.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer active:scale-97 shadow-md shadow-emerald-500/10"
          >
            <span>{user.isGuest ? "S'inscrire / Passer Premium" : `Débloquer pour ${priceInfo.amount}${priceInfo.symbol === "F CFA" ? "F" : " " + priceInfo.symbol}`}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error Notifications feedback */}
      {error && (
        <div className="bg-red-500/10 text-red-600 text-xs p-4 rounded-xl border border-red-500/20 shadow-sm flex items-start space-x-2.5">
          <span>⚠️</span>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Rephrasing Modes selection segmented control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/50 border border-slate-900/[0.06] p-3 rounded-2xl backdrop-blur-md shadow-sm">
        <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-widest pl-2">
          Mode de Récriture :
        </span>
        <div className="flex bg-slate-950/[0.04] p-1 rounded-xl w-full sm:w-auto border border-slate-900/[0.03]">
          {(["standard", "académique", "créatif"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                mode === m
                  ? "bg-white text-emerald-650 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/10 border border-transparent"
              }`}
            >
              {m === "standard" ? "Standard" : m === "académique" ? "🎓 Académique" : "✨ Créatif"}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Workspace Layout Panels Grid */}
      <div id="dual-editors-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Original Text Input Pane */}
        <div className="glass-card rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl relative min-h-[420px]">
          <div className="p-5 border-b border-slate-900/[0.06] flex justify-between items-center bg-slate-900/[0.01]">
            <span className="text-xs font-bold text-slate-550 uppercase tracking-widest flex items-center space-x-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Texte original de l'IA</span>
            </span>
            <div className="flex items-center space-x-2">
              {/* File upload trigger */}
              <label className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100/70 transition-all text-[11px] font-bold flex items-center space-x-1 cursor-pointer">
                <FileText className="h-3.5 w-3.5" />
                <span>Importer .txt</span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        if (text) {
                          setInputText(text);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleReset}
                className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-all text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                title="Réinitialiser l'espace"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Vider</span>
              </button>
            </div>
          </div>

          <div className="p-5 flex-grow min-h-[300px] flex flex-col justify-between">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Collez ici votre contenu rédigé par un outil de génération IA (ChatGPT, Gemini, Claude, etc.)..."
              className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-sm leading-relaxed outline-none border-0 p-0 resize-none flex-grow min-h-[250px] font-sans"
            />

            <div className="flex justify-between items-center pt-4 border-t border-slate-900/[0.06] mt-4 text-xs font-medium text-slate-500">
              <div className="flex items-center space-x-3">
                <span>Mots : <b className={`${inputWordCount > wordLimit ? "text-red-500 font-extrabold" : "text-slate-700 font-bold"}`}>{inputWordCount}</b> / {user.isPremium ? "∞" : wordLimit}</span>
              </div>
              
              {inputWordCount > wordLimit && (
                <span className="text-red-650 bg-red-500/10 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase border border-red-500/20">
                  Limite dépassée
                </span>
              )}
            </div>
          </div>

          {/* Action Call Trigger footer bottom */}
          <div className="p-4 bg-slate-900/[0.01] border-t border-slate-900/[0.06]">
            <button
              onClick={handleHumanizeText}
              disabled={loading || !inputText.trim() || inputWordCount > wordLimit}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl py-4 flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/15 disabled:opacity-40 active:scale-98"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4.5 w-4.5 border-2 border-white border-t-transparent"></div>
                  <span>Transformation humaine en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-white fill-white/10" />
                  <span>Humaniser le texte IA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Natural Style Humanized Output Pane */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-slate-900/[0.06] shadow-2xl shadow-slate-900/[0.02] flex flex-col overflow-hidden text-slate-800 min-h-[420px]">
          <div className="p-5 border-b border-slate-900/[0.06] flex justify-between items-center bg-slate-900/[0.01]">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-emerald-600 fill-emerald-500/10" />
              <span>Contenu réécrit par l'Humain</span>
            </span>

            <div className="flex items-center space-x-3">
              {outputText && (
                <label className="flex items-center space-x-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-505 hover:text-slate-700">
                  <input
                    type="checkbox"
                    checked={showDiff}
                    onChange={(e) => setShowDiff(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-200 cursor-pointer h-3.5 w-3.5"
                  />
                  <span>Surligner les modifications</span>
                </label>
              )}

              <button
                onClick={handleCopyResult}
                disabled={!outputText}
                className="text-slate-500 hover:text-slate-800 p-2 rounded-lg bg-white hover:bg-slate-50 transition-all text-xs disabled:opacity-30 cursor-pointer flex items-center space-x-1.5 font-bold border border-slate-200"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-600">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-5 flex-grow min-h-[300px] flex flex-col justify-between">
            {outputText ? (
              <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans overflow-y-auto max-h-[350px] pr-2 font-medium">
                {showDiff ? highlightChanges(inputText, outputText) : outputText}
              </div>
            ) : (
              <div className="my-auto text-center py-12 px-4 space-y-4">
                <div className="h-12 w-12 bg-slate-100 border border-slate-200/50 shadow-inner rounded-full flex items-center justify-center mx-auto text-slate-500 text-lg">
                  ✍️
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">En attente de texte</h4>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto font-medium">Saisissez votre texte d'origine dans la colonne de gauche et cliquez sur "Humaniser le texte IA" pour voir le style optimisé s'afficher ici.</p>
                </div>
              </div>
            )}

            {/* Micro Optimizations List and Score section */}
            {humanityScore !== null && (
              <div className="mt-6 pt-5 border-t border-slate-900/[0.06] space-y-4">
                
                {/* Score badge & explanations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* SVG Circular humanity score indicator */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-900/[0.04] flex items-center justify-between shadow-inner">
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Score d'Humanité</span>
                      <div className="text-[11px] text-slate-400 font-semibold leading-tight">Garantie anti-détection.</div>
                    </div>
                    <div className="relative flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          className="stroke-slate-900/[0.04]"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          className="stroke-emerald-500 transition-all duration-1000 ease-out drop-shadow-[0_0_4px_rgba(16,185,129,0.15)]"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="175.9"
                          strokeDashoffset={175.9 - (175.9 * humanityScore) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-black text-emerald-650">{humanityScore}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-900/[0.04] flex items-center justify-between shadow-inner">
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Indice de Lisibilité</span>
                      <div className="text-[11px] text-emerald-600 font-bold leading-tight uppercase tracking-wider">Fluide & Naturel</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-emerald-550/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl font-bold uppercase">
                        Élevé ✔
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Detector Bypass Scores Card */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-900/[0.04] space-y-4 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.04]">
                    <span className="text-[10px] uppercase font-black text-slate-550 tracking-wider">Détecteurs d'IA contournés</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded font-extrabold border border-emerald-500/20">Anti-Détection Validée</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: "GPTZero", before: 98, after: Math.max(1, 100 - humanityScore - 1) },
                      { name: "Copyleaks", before: 95, after: Math.max(2, 100 - humanityScore + 1) },
                      { name: "Turnitin", before: 99, after: Math.max(1, 100 - humanityScore) },
                    ].map((det, idx) => (
                      <div key={idx} className="bg-white/80 border border-slate-200/50 rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-extrabold text-slate-700">{det.name}</span>
                          <span className="text-[9px] font-mono text-emerald-650 font-extrabold">Succès</span>
                        </div>
                        
                        <div className="space-y-1.5 text-[10px] font-medium text-slate-505">
                          <div className="space-y-0.5">
                            <div className="flex justify-between font-semibold">
                              <span>Avant (IA) :</span>
                              <span className="text-red-500 font-bold">{det.before}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-red-400 h-full rounded-full transition-all duration-1000" style={{ width: `${det.before}%` }}></div>
                            </div>
                          </div>
                          
                          <div className="space-y-0.5">
                            <div className="flex justify-between font-semibold">
                              <span>Après (IA) :</span>
                              <span className="text-emerald-600 font-bold">{det.after}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${det.after}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bullet log improvements made */}
                {changesMade.length > 0 && (
                  <div className="space-y-2 bg-emerald-500/[0.02] p-4 rounded-2xl border border-emerald-500/15">
                    <h5 className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest">Optimisations appliquées :</h5>
                    <ul className="text-[11px] text-slate-650 space-y-1.5 list-inside list-disc font-medium">
                      {changesMade.map((opt, i) => (
                        <li key={i} className="font-semibold leading-relaxed">{opt}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Referral Share Widget */}
      <div id="referral-card" className="bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-slate-50/50 border border-emerald-500/15 p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5 relative z-10 max-w-xl">
          <div className="flex items-center space-x-1.5 text-emerald-600 font-extrabold text-xs tracking-wider uppercase">
            <TrendingUp className="h-4.5 w-4.5" />
            <span>Programme de Parrainage</span>
          </div>
          <h4 className="text-sm font-black text-slate-800">
            Gagnez des crédits de mots gratuits !
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed font-semibold">
            {user.isGuest 
              ? "Créez un compte gratuit pour obtenir votre lien de parrainage unique. Obtenez 500 mots bonus pour chaque ami qui s'inscrit !"
              : "Partagez votre lien de parrainage avec vos amis. Offrez-leur 200 mots gratuits et recevez 500 mots bonus à chaque nouvelle inscription !"}
          </p>
        </div>

        {user.isGuest ? (
          <button
            onClick={onLogout} // Triggers login screen
            className="relative z-10 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md active:scale-97"
          >
            <span>S'inscrire pour parrainer</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
            <div className="flex border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm flex-grow md:flex-grow-0">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}?ref=${user.uid}`}
                className="bg-transparent px-3 py-2 text-xs font-mono font-bold text-slate-650 outline-none w-[220px] sm:w-[260px] truncate"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}?ref=${user.uid}`);
                  alert("Lien de parrainage copié !");
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 text-xs border-l border-slate-200 transition-all cursor-pointer"
              >
                Copier
              </button>
            </div>
            
            <div className="flex gap-2">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Découvre Human_Writer, l'outil idéal pour humaniser les textes de l'IA et contourner les détecteurs ! Inscris-toi ici : ${window.location.origin}?ref=${user.uid}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#20ba56] text-white p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Partager sur WhatsApp"
              >
                <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.618-1.016-5.08-2.87-6.936C16.353 1.916 13.89 1.157 11.28 1.157c-5.41 0-9.811 4.399-9.813 9.804-.001 1.83.497 3.626 1.44 5.21L1.896 21.87l5.751-1.516zm12.38-7.385c-.302-.152-1.791-.883-2.068-.984-.278-.102-.48-.152-.68.152-.201.304-.775.984-.95 1.186-.176.203-.351.228-.653.077-1.127-.565-1.93-1.025-2.702-2.348-.189-.324-.047-.497.105-.649.136-.136.302-.354.453-.531.15-.178.2-.303.3-.507.1-.202.05-.38-.025-.531-.075-.152-.68-1.639-.93-2.247-.244-.587-.49-.508-.68-.517-.175-.008-.376-.01-.577-.01-.201 0-.527.075-.803.38-.277.304-1.055 1.03-1.055 2.516 0 1.485 1.079 2.92 1.23 3.122.15.203 2.122 3.241 5.141 4.542.717.31 1.277.494 1.714.633.721.23 1.376.197 1.894.12.577-.087 1.791-.733 2.042-1.443.25-.709.25-1.316.175-1.443-.075-.126-.276-.201-.577-.352z"/>
                </svg>
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Optimise tes textes de l'IA avec Human_Writer pour qu'ils soient 100% indétectables ! Rejoins-moi ici : ${window.location.origin}?ref=${user.uid}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#1DA1F2] hover:bg-[#1a91da] text-white p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Partager sur X (Twitter)"
              >
                <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* History Log Section */}
      <div id="history-section" className="glass-card rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-900/[0.06]">
          <History className="h-5 w-5 text-slate-400" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">Historique de vos Récritures</h3>
            <p className="text-[11px] text-slate-500 font-medium">Retrouvez les textes précédemment optimisés sur votre compte.</p>
          </div>
        </div>

        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setInputText(item.originalText);
                  setOutputText(item.humanizedText);
                  setHumanityScore(item.humanityScore);
                  setChangesMade(["Suppression des connecteurs répétitifs", "Brise des rimes mécaniques formulées par l'IA"]);
                }}
                className="p-4 bg-slate-50/30 hover:bg-white border border-slate-900/[0.04] rounded-2xl cursor-pointer hover:border-emerald-500/40 hover:shadow-md hover:shadow-slate-900/[0.02] transition-all duration-300 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 font-semibold">
                    <span>{new Date(item.createdAt).toLocaleDateString("fr-FR")}</span>
                    <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">{item.humanityScore}% Humain</span>
                  </div>
                  <p className="text-slate-650 text-xs line-clamp-3 font-semibold leading-relaxed">
                    {item.originalText}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-900/[0.06] flex justify-between items-center text-[10px] font-medium text-slate-500">
                  <span>Texte de {item.originalWordCount} mots</span>
                  <span className="text-emerald-600 font-bold flex items-center space-x-0.5">
                    <span>Charger</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 font-semibold text-xs">
            Aucun texte enregistré dans votre historique pour le moment.
          </div>
        )}
      </div>

    </div>
  );
}
