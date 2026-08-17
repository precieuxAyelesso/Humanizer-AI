import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, Smartphone, Check, Shield, AlertCircle, Loader2, Sparkles, ExternalLink } from "lucide-react";

interface PaymentModalProps {
  user: any;
  onClose: () => void;
  onPaymentSuccess: (updatedUser: any) => void;
}

export default function PaymentModal({ user, onClose, onPaymentSuccess }: PaymentModalProps) {
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

  // 'initial', 'processing', 'success'
  const [step, setStep] = useState<"initial" | "processing" | "success">("initial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<any>(null);

  const handlePaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setStep("processing");

    try {
      // Call our backend to initialize a Moneroo payment session
      const response = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          amount: priceInfo.amount,
          currency: priceInfo.currency,
          description: `Abonnement Premium Humanizer AI - ${priceInfo.amount} ${priceInfo.symbol}/mois`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'initialisation du paiement.");
      }

      if (data.checkout_url) {
        // Save transaction ID for later verification
        localStorage.setItem("moneroo_transaction_id", data.transaction_id);
        // Redirect user to Moneroo hosted checkout page
        window.location.href = data.checkout_url;
      } else {
        throw new Error("URL de paiement non reçue. Veuillez réessayer.");
      }
    } catch (err: any) {
      console.error("Payment initialization error:", err);
      setError(err.message || "Erreur d'initialisation du paiement.");
      setStep("initial");
    } finally {
      setLoading(false);
    }
  };

  // Features list for the premium offer
  const premiumFeatures = [
    { icon: "✍️", text: "Réécriture illimitée de textes IA" },
    { icon: "⚡", text: "Traitement ultra-rapide avec Gemini" },
    { icon: "🛡️", text: "Textes 100% indétectables" },
    { icon: "📊", text: "Historique complet de vos textes" },
  ];

  return (
    <div id="payment-modal-overlay" className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Banner */}
        <div className="bg-gradient-to-tr from-slate-50 to-white p-4 text-slate-800 border-b border-slate-900/[0.06] relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/8 pointer-events-none" />
          
          <div className="flex justify-between items-start relative">
            <div>
              <div className="flex items-center space-x-2 text-emerald-600 font-mono text-[9px] tracking-widest uppercase font-extrabold">
                <Sparkles className="h-2.5 w-2.5" />
                <span>Premium Pass</span>
              </div>
              <h3 className="text-lg font-extrabold tracking-tight mt-0.5 text-slate-900">Débloquez l'écriture illimitée</h3>
            </div>
            
            {step !== "processing" && step !== "success" && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg p-1.5 transition-all text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-3.5 flex justify-between items-center bg-slate-50/80 border border-slate-100 p-3 rounded-xl relative">
            <div>
              <div className="text-xs text-slate-500 font-bold font-sans">Abonnement Mensuel Recommandé</div>
              <div className="text-[10px] text-slate-600 font-medium">Génération sémantique illimitée</div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-emerald-650">{priceInfo.amount} {priceInfo.symbol}</span>
              <span className="text-[9px] text-slate-500 font-bold block">/ mois TTC</span>
            </div>
          </div>
        </div>

        {/* Modal Body changes on step */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Payment Form */}
            {step === "initial" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {error && (
                  <div className="bg-red-500/10 text-red-650 text-xs p-3 rounded-xl border border-red-500/20 flex items-start space-x-2.5">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="font-semibold leading-relaxed">{error}</span>
                  </div>
                )}

                {/* Premium features grid */}
                <div className="grid grid-cols-2 gap-2">
                  {premiumFeatures.map((feature, i) => (
                    <div key={i} className="flex items-start space-x-2 p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl">
                      <span className="text-sm">{feature.icon}</span>
                      <span className="text-[10px] text-slate-600 font-semibold leading-snug">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {/* Moneroo Payment Info */}
                <div className="space-y-3 p-3 bg-emerald-500/[0.03] border border-emerald-500/15 rounded-xl font-sans">
                  <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-bold mb-1">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Paiement sécurisé via Moneroo</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    Vous serez redirigé vers la plateforme de paiement sécurisée Moneroo. 
                    Payez par <strong>Mobile Money</strong> (Orange, MTN, Wave, Moov) ou par <strong>Carte Bancaire</strong> (Visa, Mastercard).
                  </p>
                  <div className="flex items-center space-x-3 mt-2">
                    <div className="flex items-center space-x-1.5">
                      <Smartphone className="h-3 w-3 text-slate-400" />
                      <span className="text-[9px] text-slate-400 font-bold">Mobile Money</span>
                    </div>
                    <div className="w-px h-3 bg-slate-200" />
                    <div className="flex items-center space-x-1.5">
                      <CreditCard className="h-3 w-3 text-slate-400" />
                      <span className="text-[9px] text-slate-400 font-bold">Visa / Mastercard</span>
                    </div>
                  </div>
                </div>

                {/* Terms / Security Badge */}
                <div className="flex items-center space-x-2 text-[9px] text-slate-400 font-bold my-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100 shadow-inner">
                  <Shield className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span>Paiement sécurisé SSL conforme PCI-DSS. Annulable à tout moment.</span>
                </div>

                {/* Final pay trigger button */}
                <form onSubmit={handlePaymentSubmit}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold rounded-xl py-2.5 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 transition-all cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Préparation du paiement...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        <span>Payer {priceInfo.amount} {priceInfo.symbol}</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 2: Processing / Redirecting */}
            {step === "processing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center space-y-4"
              >
                <div className="relative flex items-center justify-center">
                  <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-emerald-500/10"></div>
                  <Loader2 className="h-10 w-10 text-emerald-500 animate-spin relative" />
                </div>
                <div className="text-center space-y-2">
                  <h4 className="font-extrabold text-slate-800 text-sm">Redirection vers Moneroo...</h4>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed font-semibold">
                    Nous préparons votre session de paiement sécurisée. Vous allez être redirigé automatiquement dans quelques secondes.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Success */}
            {step === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center space-y-6"
              >
                <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Check className="h-6 w-6 text-emerald-500" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 leading-snug">Abonnement Premium Activé !</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed font-semibold">Félicitations, vous appartenez désormais au club Premium. Vous profitez d'une relecture et d'un humaniseur de textes illimité.</p>
                </div>

                {paymentReceipt && (
                  <div className="bg-slate-55 border border-slate-100 p-4 rounded-2xl divide-y divide-slate-100 max-w-xs mx-auto text-left text-[11px] font-mono space-y-2 text-slate-500 shadow-sm">
                    <div className="flex justify-between p-1 pt-2">
                      <span>RÉF_TRANSACTION</span>
                      <span className="font-bold text-slate-700">{paymentReceipt.ref}</span>
                    </div>
                    <div className="flex justify-between p-1 pt-2">
                      <span>MONTANT</span>
                      <span className="font-bold text-slate-700">{paymentReceipt.amount}</span>
                    </div>
                    <div className="flex justify-between p-1 pt-2">
                      <span>MÉTHODE</span>
                      <span className="font-bold text-slate-700">{paymentReceipt.method}</span>
                    </div>
                    <div className="flex justify-between p-1 pt-2">
                      <span>TYPE</span>
                      <span className="font-bold text-emerald-600">Premium Mensuel</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl px-6 py-3.5 transition-all cursor-pointer active:scale-98"
                >
                  Accéder à l'application illimitée
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </motion.div>
    </div>
  );
}
