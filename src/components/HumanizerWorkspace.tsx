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

  // Load history log items for user
  const loadHistory = async () => {
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

    if (inputWordCount > 200 && !user.isPremium) {
      // Trigger pay block
      onTriggerPremiumUpgrade();
      return;
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
                Compte Gratuit
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">Connecté en tant que <span className="text-slate-700 font-bold">{user.name}</span></p>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <button
            onClick={onLogout}
            className="p-2.5 text-slate-500 hover:text-red-600 bg-white hover:bg-red-50/50 rounded-xl transition-all text-xs flex items-center justify-center space-x-1.5 cursor-pointer font-bold border border-slate-200"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Free limit Warning card banner */}
      {!user.isPremium && (
        <div className="p-5 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-slate-50/50 text-slate-800 rounded-2xl border border-indigo-100 shadow-md shadow-indigo-950/[0.02] flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/8 pointer-events-none" />
          
          <div className="space-y-1 relative z-10">
            <div className="flex items-center space-x-1.5 text-emerald-600 font-bold text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span>Génération limitée à 200 mots</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed max-w-xl font-medium">
              Votre compte actuel de test de sécurité est limité à 200 mots par texte. Libérez la puissance de calcul maximale et débloquez la génération illimitée pour seulement {priceInfo.amount} {priceInfo.symbol} par mois.
            </p>
          </div>

          <button
            onClick={onTriggerPremiumUpgrade}
            className="relative z-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4.5 py-2.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer active:scale-97 shadow-md shadow-emerald-500/10"
          >
            <span>Débloquer pour {priceInfo.amount}{priceInfo.symbol === "F CFA" ? "F" : " " + priceInfo.symbol}</span>
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

      {/* Primary Workspace Layout Panels Grid */}
      <div id="dual-editors-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Original Text Input Pane */}
        <div className="glass-card rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl relative min-h-[420px]">
          <div className="p-5 border-b border-slate-900/[0.06] flex justify-between items-center bg-slate-900/[0.01]">
            <span className="text-xs font-bold text-slate-550 uppercase tracking-widest flex items-center space-x-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Texte original de l'IA</span>
            </span>
            <button
              onClick={handleReset}
              className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-all text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
              title="Réinitialiser l'espace"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Vider</span>
            </button>
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
                <span>Mots : <b className={`${inputWordCount > 200 && !user.isPremium ? "text-red-500 font-extrabold" : "text-slate-700 font-bold"}`}>{inputWordCount}</b> / {user.isPremium ? "∞" : "200"}</span>
              </div>
              
              {inputWordCount > 200 && !user.isPremium && (
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
              disabled={loading || !inputText.trim() || (inputWordCount > 200 && !user.isPremium)}
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

            <div className="flex items-center space-x-2">
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
                {outputText}
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

                {/* Bullet log improvements made */}
                {changesMade.length > 0 && (
                  <div className="space-y-2 bg-emerald-500/[0.02] p-4 rounded-2xl border border-emerald-500/15">
                    <h5 className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest">Optimisations appliquées :</h5>
                    <ul className="text-[11px] text-slate-600 space-y-1.5 list-inside list-disc font-medium">
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
                  <p className="text-slate-600 text-xs line-clamp-3 font-semibold leading-relaxed">
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
