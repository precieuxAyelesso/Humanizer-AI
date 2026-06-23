import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, Smartphone, Check, Shield, AlertCircle, Loader2, Sparkles } from "lucide-react";

interface PaymentModalProps {
  user: any;
  onClose: () => void;
  onPaymentSuccess: (updatedUser: any) => void;
}

export default function PaymentModal({ user, onClose, onPaymentSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<"momo" | "card" | "paypal">("momo");
  const [operator, setOperator] = useState<"orange" | "mtn" | "moov" | "wave">("orange");
  const [phone, setPhone] = useState(user.phone || "");
  const [otp, setOtp] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paypalEmail, setPaypalEmail] = useState(user.email || "");

  // Interactive step simulation
  // 'initial', 'processing', 'otp_required', 'success'
  const [step, setStep] = useState<"initial" | "processing" | "otp_required" | "success">("initial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<any>(null);

  const mockMobileMoneyOperators = [
    { id: "orange", name: "Orange Money", color: "bg-orange-500", border: "border-orange-200" },
    { id: "mtn", name: "MTN Mobile Money", color: "bg-yellow-500", border: "border-yellow-200" },
    { id: "moov", name: "Moov Money", color: "bg-blue-600", border: "border-blue-200" },
    { id: "wave", name: "Wave", color: "bg-cyan-500", border: "border-cyan-200" },
  ];

  const handleCreateSubscription = async (paymentType: string, reference: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          paymentMethod: paymentType,
          transactionRef: reference,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "L'activation de l'abonnement a échoué.");
      }

      setPaymentReceipt(data.paymentDetails);
      setStep("success");
      onPaymentSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
      setStep("initial");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (method === "momo") {
      if (!phone) {
        return setError("Saisissez un numéro Mobile Money valide.");
      }
      setStep("processing");
      
      // Simulate Mobile Money Africa gateway authorization sequence (takes 3s)
      setTimeout(() => {
        if (operator === "orange") {
          // Orange Money requests OTP codes in many French-speaking countries
          setStep("otp_required");
        } else {
          // MTN, Moov and Wave push USSD notifications directly to phones
          const ref = "MOMOPUSH_" + Math.floor(100000 + Math.random() * 900000);
          handleCreateSubscription(`Mobile Money (${operator.toUpperCase()})`, ref);
        }
      }, 2500);

    } else if (method === "card") {
      if (!cardNumber || !cardExpiry || !cardCvv) {
        return setError("Veuillez remplir l'ensemble des informations bancaires.");
      }
      setStep("processing");

      setTimeout(() => {
        const ref = "CARD_" + Math.floor(100000 + Math.random() * 900000);
        handleCreateSubscription("Carte Internationale (Visa/Mastercard)", ref);
      }, 2500);

    } else if (method === "paypal") {
      if (!paypalEmail) {
        return setError("Adresse e-mail de facturation PayPal obligatoire.");
      }
      setStep("processing");

      // Simulates secure official PayPal overlay API connection
      setTimeout(() => {
        const ref = "PAYPAL_RECEIPT_" + Math.floor(100000 + Math.random() * 900000);
        handleCreateSubscription("PayPal Account Express", ref);
      }, 2800);
    }
  };

  const handleConfirmOtp = (e: FormEvent) => {
    e.preventDefault();
    if (!otp) return setError("Le code de confirmation OTP à 4 chiffres est requis.");

    setStep("processing");
    setTimeout(() => {
      const ref = "ORANGE_OTP_TXN_" + Math.floor(100000 + Math.random() * 900000);
      handleCreateSubscription("Orange Money + OTP", ref);
    }, 2000);
  };

  return (
    <div id="payment-modal-overlay" className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Banner */}
        <div className="bg-gradient-to-tr from-slate-50 to-white p-6 text-slate-800 border-b border-slate-900/[0.06] relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/8 pointer-events-none" />
          
          <div className="flex justify-between items-start relative">
            <div>
              <div className="flex items-center space-x-2 text-emerald-600 font-mono text-[10px] tracking-widest uppercase font-extrabold">
                <Sparkles className="h-3 w-3" />
                <span>Premium Pass</span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight mt-1 text-slate-900">Débloquez l'écriture illimitée</h3>
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

          <div className="mt-6 flex justify-between items-baseline bg-slate-50/80 border border-slate-100 p-4 rounded-2xl relative">
            <div>
              <div className="text-xs text-slate-500 font-medium font-sans">Abonnement Mensuel Recommandé</div>
              <div className="text-xs text-slate-650 mt-1 font-semibold">Génération de contenus sémantiques illimitée</div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-650">500 F CFA</span>
              <span className="text-[10px] text-slate-405 font-medium block font-bold">/ mois TTC</span>
            </div>
          </div>
        </div>

        {/* Modal Body changes on step */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Selection Form */}
            {step === "initial" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {error && (
                  <div className="bg-red-500/10 text-red-650 text-xs p-3 rounded-xl border border-red-500/20 flex items-start space-x-2.5">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                    <span className="font-semibold leading-relaxed">{error}</span>
                  </div>
                )}

                {/* Gateway Group Buttons Selector */}
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => setMethod("momo")}
                    className={`p-3.5 rounded-xl border font-bold text-xs flex flex-col items-center space-y-1.5 transition-all cursor-pointer ${
                      method === "momo"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-md shadow-emerald-500/5"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>Mobile Money</span>
                  </button>

                  <button
                    onClick={() => setMethod("card")}
                    className={`p-3.5 rounded-xl border font-bold text-xs flex flex-col items-center space-y-1.5 transition-all cursor-pointer ${
                      method === "card"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-md shadow-emerald-500/5"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Carte Visa/MC</span>
                  </button>

                  <button
                    onClick={() => setMethod("paypal")}
                    className={`p-3.5 rounded-xl border font-bold text-xs flex flex-col items-center space-y-1.5 transition-all cursor-pointer ${
                      method === "paypal"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-md shadow-emerald-500/5"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.03 7.72c0-1.85-.45-3.41-1.35-4.66C17.78 1.8 16.32 1.15 14.31 1.1h-7.1c-.56 0-1.04.42-1.12.98L4.03 15.3c-.04.28.18.52.46.52h3.29l.71-4.52.09-.64a1.07 1.07 0 011.05-.9h2.36c2.39 0 4.25-.51 5.56-1.52.92-.7 1.51-1.63 1.77-2.77.2-.69.29-1.42.29-2.09s-.11-1.3-.29-2.09z"/>
                      <path opacity=".7" d="M16.92 12.04c-.45 1.57-1.48 2.76-3.08 3.56-1.05.52-2.34.78-3.88.78h-2.1c-.48 0-.89.35-.96.83l-.95 6.01c-.04.28.18.52.46.52h3.45c.48 0 .89-.35.96-.83l.1-.64.71-4.52.09-.64a1.07 1.07 0 011.05-.9c2.37.03 4.22-.48 5.52-1.49a5.9 5.9 0 001.76-2.77c.21-.69.31-1.42.31-2.09a3.8 3.8 0 00-.04-.64c-.33 2.12-1.58 3.96-3.32 5.09z" fill="currentColor"/>
                    </svg>
                    <span>PayPal Account</span>
                  </button>
                </div>

                {/* Sub Forms bases on selected method */}
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  
                  {/* Mobile Money Sub Form */}
                  {method === "momo" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase">Opérateur Mobile Money</label>
                        <div className="grid grid-cols-4 gap-2">
                          {mockMobileMoneyOperators.map((op) => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setOperator(op.id as any)}
                              className={`py-2.5 px-1.5 rounded-xl border text-[11px] text-center font-bold transition-all truncate cursor-pointer ${
                                operator === op.id
                                  ? "border-emerald-500 bg-emerald-500/10 text-slate-900 ring-2 ring-emerald-500/10"
                                  : "border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300"
                              }`}
                            >
                              <div className={`h-2.5 w-2.5 rounded-full mx-auto mb-1.5 ${op.color} shadow-sm`} />
                              {op.name.split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase">Numéro de Téléphone Portefeuille</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+225 07 43 21 09 87"
                          className="w-full bg-slate-50/80 text-slate-800 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-semibold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                          required
                        />
                        <p className="text-[10px] text-slate-400 font-semibold">Spécifiez le numéro disposant des fonds (ex: Orange Money, MTN MoMo, Wave, Moov).</p>
                      </div>
                    </div>
                  )}

                  {/* Credit Card Sub Form (Visa/MC) */}
                  {method === "card" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase">Numéro de carte bancaire</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                          placeholder="4000 1234 5678 9010"
                          maxLength={19}
                          className="w-full bg-slate-50/80 text-slate-800 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-semibold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase">Expiration</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM / AA"
                            maxLength={7}
                            className="w-full bg-slate-50/80 text-slate-800 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-semibold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-center"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase">Code CVC / CVV</label>
                          <input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="123"
                            maxLength={3}
                            className="w-full bg-slate-50/80 text-slate-800 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-semibold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-center font-mono"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PayPal Sub Form */}
                  {method === "paypal" && (
                    <div className="space-y-3 p-4 bg-blue-500/[0.02] border border-blue-500/15 rounded-2xl">
                      <div className="flex items-center space-x-2 text-xs text-blue-600 font-bold mb-2">
                        <Shield className="h-4 w-4" />
                        <span>Connexion PayPal Express Sécurisée</span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase">Email PayPal Facturation</label>
                        <input
                          type="email"
                          value={paypalEmail}
                          onChange={(e) => setPaypalEmail(e.target.value)}
                          placeholder="email@paypal.com"
                          className="w-full bg-slate-50/80 text-slate-800 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-semibold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Terms / Security Badge */}
                  <div className="flex items-center space-x-2.5 text-[10px] text-slate-400 font-bold my-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100 shadow-inner">
                    <Shield className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span>Passerelle de paiement chiffrée SSL de bout en bout conforme PCI-DSS v4. Débit récurrent mensuel annulable à tout moment.</span>
                  </div>

                  {/* Final pay trigger button */}
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold rounded-xl py-3.5 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 transition-all cursor-pointer active:scale-98"
                  >
                    <span>Payer les 500 F CFA</span>
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 2: Processing Payment state */}
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
                  <h4 className="font-extrabold text-slate-800 text-sm">Traitement de l'autorisation sécurisée...</h4>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed font-semibold">
                    {method === "momo" 
                      ? "Veuillez valider l'invitation de débit reçue automatiquement par push USSD sur votre mobile et confirmer avec votre code secret PIN." 
                      : "Nous contactons votre banque pour approuver la transaction. Ne fermez pas cette fenêtre."
                    }
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Orange Money OTP code requirement */}
            {step === "otp_required" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="p-4 bg-orange-500/10 border border-orange-500/25 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs">
                    <AlertCircle className="h-4 w-4 text-orange-650" />
                    <span>Orange Money OTP Obligatoire</span>
                  </div>
                  <p className="text-[10px] text-slate-650 leading-relaxed font-bold">Pour valider le paiement, tapez <span className="bg-orange-500/20 text-orange-750 px-1.5 py-0.5 rounded font-black font-mono">#144*82#</span> sur votre mobile pour générer un code d'autorisation temporaire à 4 chiffres.</p>
                </div>

                <form onSubmit={handleConfirmOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-555 text-[10px] font-bold tracking-wider uppercase block text-center">Code d'autorisation OTP reçu</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Ex: 8439"
                      maxLength={4}
                      className="w-full bg-slate-50/80 text-slate-850 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none text-center tracking-[0.25em] font-bold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl py-3.5 transition-all cursor-pointer active:scale-98"
                  >
                    Confirmer l'opération
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 4: Success configuration */}
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
