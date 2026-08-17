import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
// Vite is dynamically imported only in development mode below
import { createClient } from "@supabase/supabase-js";

// Load .env then .env.local so local overrides take precedence when present
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set up directory for persisting data safely in container filesystem (sandbox fallback fallback)
const DATA_DIR = process.env.VERCEL === "1" ? "/tmp" : path.join(process.cwd(), "data");
try {
  if (process.env.VERCEL !== "1" && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
} catch (err) {
  console.error("Failed to create data directory:", err);
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

// Helper to read/write persistent files (Local sandbox backup)
function readJSONFile(filePath: string, defaultData: any) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultData;
}

function writeJSONFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

// Supabase Connection Management (Lazy connection & secure fallback)
// Prefer a server-side Service Role key for administrative DB operations
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "";

let supabase: any = null;
let isSupabaseConfigured = false;

if (supabaseUrl && supabaseUrl.startsWith("http") && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    isSupabaseConfigured = true;
    const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`[SUPABASE] Connexion à Supabase établie avec succès ! (service_role=${usingServiceRole})`);

    // Automatically delete local JSON cache databases on actual Supabase initialization to avoid double data storing
    if (fs.existsSync(USERS_FILE)) {
      try { fs.unlinkSync(USERS_FILE); console.log("[CLEANUP] users.json supprimé car Supabase est activé."); } catch (e) {}
    }
    if (fs.existsSync(HISTORY_FILE)) {
      try { fs.unlinkSync(HISTORY_FILE); console.log("[CLEANUP] history.json supprimé car Supabase est activé."); } catch (e) {}
    }

    if (!usingServiceRole) {
      console.warn("[SUPABASE] WARNING: Using a non-service (anon) key on the server. Row-Level Security (RLS) may block inserts/updates. Consider setting SUPABASE_SERVICE_ROLE_KEY in your environment for server admin operations.");
    }
  } catch (err) {
    console.error("[SUPABASE] Échec de l'initialisation du client Supabase :", err);
  }
} else {
  console.warn("[SUPABASE] Variables SUPABASE_URL ou SUPABASE_KEY / SUPABASE_ANON_KEY manquantes dans l'environnement. Mode bac à sable local activé.");
}

// Initializing user store fallback

app.use(express.json());

// Set COOP header to same-origin-allow-popups to allow Google/Supabase Auth postMessage communication in popups
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// Initialize Gemini SDK with telemetry header
const geminiApiKey = process.env.GEMINI_API_KEY || "";
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
    });
    console.log("Gemini API Client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
} else {
  console.warn("GEMINI_API_KEY not defined in environment.");
}

// Moneroo Payment Gateway Configuration
const monerooSecretKey = process.env.MONEROO_SECRET_KEY || "";
if (monerooSecretKey) {
  console.log("[MONEROO] Clé secrète Moneroo configurée avec succès.");
} else {
  console.warn("[MONEROO] MONEROO_SECRET_KEY manquante. Les paiements ne fonctionneront pas.");
}

// 0. DB Status Check & Keep-Alive Ping Endpoint
app.get("/api/db/status", async (req, res) => {
  let isAlive = isSupabaseConfigured;
  if (supabase) {
    try {
      // Query Supabase to update activity timer and prevent 7-day auto-pause
      await supabase.from("users").select("id").limit(1);
      isAlive = true;
    } catch (e) {
      console.error("[SUPABASE PING] Keep-alive ping error:", e);
    }
  }
  res.json({
    connected: isAlive,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : null,
    mode: isAlive ? "Supabase Cloud Database" : "Sandbox Local Fallback",
    timestamp: new Date().toISOString(),
  });
});

// REST API Endpoints

// Middleware to verify Supabase JWT
const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non autorisé. Jeton d'authentification manquant." });
  }

  const token = authHeader.split(" ")[1];

  if (isSupabaseConfigured) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: "Non autorisé. Jeton invalide ou expiré." });
      }
      // Attach the secure verified user ID to the request
      (req as any).secureUserId = user.id;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Erreur lors de la vérification de l'autorisation." });
    }
  } else {
    // Mode bac à sable local : pas de sécurité
    (req as any).secureUserId = req.body.userId || "local_user";
    next();
  }
};
// L'inscription et la connexion classiques et Google se font désormais entièrement côté client via Supabase Auth pour des raisons de sécurité.

// 3.5 Supabase Auth Callback: Handle user after OAuth or Native Auth

app.post("/api/auth/supabase-callback", authMiddleware, async (req, res) => {
  const { uid, email, name, provider, googleId } = req.body;
  const secureUserId = (req as any).secureUserId;
  
  if (isSupabaseConfigured && uid !== secureUserId) {
    return res.status(403).json({ error: "Incohérence d'identité détectée." });
  }

  if (!uid || !email) {
    return res.status(400).json({ error: "UID et email requis." });
  }

  try {
    let user: any = null;
    const cleanEmail = email.toLowerCase();

    if (isSupabaseConfigured) {
      // Upsert user in Supabase (insert or update if exists)
      const { data, error } = await supabase
        .from("users")
        .upsert({
          uid,
          name: name || cleanEmail.split("@")[0],
          email: cleanEmail,
          google_id: googleId || null,
          provider: provider || "supabase",
          password: provider === "google" ? `oauth_${provider}_${uid}` : null,
          is_sms_verified: true, // SMS OTP disabled, auto-verify all users
          is_premium: false,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "uid", // uid is the primary key with unique constraint, email is not
        })
        .select("*")
        .single();

      if (error) throw error;

      user = {
        uid: data.uid,
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        isSmsVerified: data.is_sms_verified,
        isPremium: data.is_premium,
      };
    } else {
      // Fallback: Local file-based storage
      const users = readJSONFile(USERS_FILE, []);
      const existingUserIndex = users.findIndex((u: any) => u.email.toLowerCase() === cleanEmail);

      if (existingUserIndex !== -1) {
        // Update existing user
        users[existingUserIndex] = {
          ...users[existingUserIndex],
          uid,
          name: name || users[existingUserIndex].name,
          provider: provider || "supabase",
          googleId: googleId || users[existingUserIndex].googleId,
          isSmsVerified: true,
        };
      } else {
        // Create new user
        users.push({
          uid,
          name: name || cleanEmail.split("@")[0],
          email: cleanEmail,
          password: provider === "google" ? `oauth_${provider}_${uid}` : "",
          phone: "",
          googleId: googleId || null,
          provider: provider || "supabase",
          isSmsVerified: true,
          isPremium: false,
          createdAt: new Date().toISOString(),
        });
      }

      writeJSONFile(USERS_FILE, users);
      const userData = users.find((u: any) => u.email.toLowerCase() === cleanEmail);
      user = {
        uid: userData.uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone || "",
        isSmsVerified: userData.isSmsVerified,
        isPremium: userData.isPremium,
      };
    }

    res.json({
      message: `Authentification ${provider} réussie.`,
      user,
    });
  } catch (err: any) {
    console.error("[SUPABASE CALLBACK ERROR]", err);
    return res.status(500).json({ error: `Erreur lors de l'authentification: ${err.message}` });
  }
});

// 5.5 Moneroo Payment: Initialize payment session
app.post("/api/payment/initialize", authMiddleware, async (req, res) => {
  const { amount, currency, description } = req.body;
  const userId = (req as any).secureUserId;

  if (!monerooSecretKey) {
    return res.status(503).json({ error: "Le service de paiement n'est pas configuré." });
  }

  if (!amount || !currency) {
    return res.status(400).json({ error: "Montant et devise requis." });
  }

  // Get user email from database
  let userEmail = "";
  let userName = "";
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from("users").select("email, name").eq("uid", userId).single();
      if (data) {
        userEmail = data.email;
        userName = data.name;
      }
    } catch (err) {
      console.error("[MONEROO] Failed to fetch user info:", err);
    }
  }

  try {
    const appUrl = process.env.APP_URL || "https://humanizerai.space";
    
    const monerooResponse = await fetch("https://api.moneroo.io/v1/payments/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${monerooSecretKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount)),
        currency: currency.toUpperCase(),
        description: description || "Abonnement Premium Humanizer AI",
        customer: {
          email: userEmail || "client@humanizerai.space",
          first_name: userName || "Client",
          last_name: "HumanizerAI",
        },
        return_url: `${appUrl}?payment=callback&userId=${userId}`,
        metadata: {
          userId: userId,
          plan: "premium_monthly",
          amount: amount,
          currency: currency,
        },
      }),
    });

    const monerooData = await monerooResponse.json();

    if (!monerooResponse.ok) {
      console.error("[MONEROO] API Error:", monerooData);
      return res.status(monerooResponse.status).json({ 
        error: monerooData.message || "Erreur lors de l'initialisation du paiement Moneroo." 
      });
    }

    res.json({
      checkout_url: monerooData.data?.checkout_url,
      transaction_id: monerooData.data?.id,
    });
  } catch (err: any) {
    console.error("[MONEROO] Initialize Error:", err);
    return res.status(500).json({ error: `Erreur de paiement: ${err.message}` });
  }
});

// 5.6 Moneroo Payment: Verify payment status after return
app.get("/api/payment/verify/:transactionId", authMiddleware, async (req, res) => {
  const { transactionId } = req.params;
  const userId = (req as any).secureUserId;

  if (!monerooSecretKey) {
    return res.status(503).json({ error: "Le service de paiement n'est pas configuré." });
  }

  try {
    const monerooResponse = await fetch(`https://api.moneroo.io/v1/payments/${transactionId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${monerooSecretKey}`,
        "Accept": "application/json",
      },
    });

    const monerooData = await monerooResponse.json();

    if (!monerooResponse.ok) {
      console.error("[MONEROO] Verify Error:", monerooData);
      return res.status(monerooResponse.status).json({ 
        error: monerooData.message || "Erreur lors de la vérification du paiement." 
      });
    }

    const paymentStatus = monerooData.data?.status;
    const isSuccess = paymentStatus === "success" || paymentStatus === "completed";

    if (isSuccess) {
      // Upgrade user to premium
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("users")
          .update({ is_premium: true })
          .eq("uid", userId);
        if (error) {
          console.error("[MONEROO] Premium upgrade error:", error);
          return res.status(500).json({ error: "Paiement réussi mais échec de l'activation premium." });
        }
      } else {
        const users = readJSONFile(USERS_FILE, []);
        const userIndex = users.findIndex((u: any) => u.uid === userId);
        if (userIndex !== -1) {
          users[userIndex].isPremium = true;
          writeJSONFile(USERS_FILE, users);
        }
      }

      // Get updated user data
      let updatedUser: any = null;
      if (isSupabaseConfigured) {
        const { data } = await supabase.from("users").select("*").eq("uid", userId).single();
        if (data) {
          updatedUser = {
            uid: data.uid,
            name: data.name,
            email: data.email,
            phone: data.phone || "",
            isSmsVerified: data.is_sms_verified,
            isPremium: true,
          };
        }
      } else {
        const users = readJSONFile(USERS_FILE, []);
        const u = users.find((u: any) => u.uid === userId);
        if (u) {
          updatedUser = {
            uid: u.uid, name: u.name, email: u.email,
            phone: u.phone || "", isSmsVerified: u.isSmsVerified, isPremium: true,
          };
        }
      }

      res.json({
        status: "success",
        message: "Paiement réussi ! Votre abonnement Premium est activé.",
        user: updatedUser,
        paymentDetails: {
          ref: transactionId,
          amount: monerooData.data?.amount,
          method: "Moneroo",
        },
      });
    } else {
      res.json({
        status: paymentStatus || "pending",
        message: `Statut du paiement : ${paymentStatus || "en attente"}`,
      });
    }
  } catch (err: any) {
    console.error("[MONEROO] Verify Error:", err);
    return res.status(500).json({ error: `Erreur de vérification: ${err.message}` });
  }
});

// 6. Premium Subscriptions updates
app.post("/api/subscription/create", authMiddleware, async (req, res) => {
  const { paymentMethod, transactionRef, amount } = req.body;
  const userId = (req as any).secureUserId;
  
  if (!userId) {
    return res.status(400).json({ error: "ID d'utilisateur requis." });
  }

  let updatedUserObj: any = null;

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_premium: true })
        .eq("uid", userId);

      if (error) throw error;

      const { data: dbUser, error: fetchErr } = await supabase
        .from("users")
        .select("*")
        .eq("uid", userId)
        .single();

      if (fetchErr) throw fetchErr;

      updatedUserObj = {
        uid: dbUser.uid,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        isSmsVerified: dbUser.is_sms_verified,
        isPremium: true,
      };
    } catch (dbErr: any) {
      console.error("[SUPABASE PREMIUM ERROR]", dbErr);
      return res.status(500).json({ error: `Erreur d'acquisition premium Supabase: ${dbErr.message}` });
    }
  } else {
    const users = readJSONFile(USERS_FILE, []);
    const userIndex = users.findIndex((u: any) => u.uid === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    users[userIndex].isPremium = true;
    writeJSONFile(USERS_FILE, users);

    updatedUserObj = {
      uid: users[userIndex].uid,
      name: users[userIndex].name,
      email: users[userIndex].email,
      phone: users[userIndex].phone,
      isSmsVerified: users[userIndex].isSmsVerified,
      isPremium: true,
    };
  }

  res.json({
    message: "Abonnement Premium activé avec succès ! Merci pour votre confiance.",
    user: updatedUserObj,
    paymentDetails: {
      amount: amount || "1961 F CFA",
      period: "Mensuel",
      method: paymentMethod || "Mobile Money",
      ref: transactionRef || "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    },
  });
});

// 7. Humanize AI content via Gemini API
app.post("/api/humanize", authMiddleware, async (req, res) => {
  const { text, mode } = req.body;
  const userId = (req as any).secureUserId;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Aucun texte à transformer." });
  }

  const wordCount = text.trim().split(/\s+/).length;

  // Verify premium lock status
  let isPremium = false;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("is_premium")
        .eq("uid", userId)
        .maybeSingle();

      if (!error && data) {
        isPremium = data.is_premium;
      }
    } catch (dbErr) {}
  } else {
    const users = readJSONFile(USERS_FILE, []);
    const user = users.find((u: any) => u.uid === userId);
    isPremium = user ? user.isPremium : false;
  }

  if (wordCount > 200 && !isPremium) {
    return res.status(403).json({
      error: "LIMIT_EXCEEDED",
      message: "Le texte contient plus de 200 mots. Veuillez passer à l'abonnement Premium pour débloquer la génération illimitée.",
      wordCount,
    });
  }

  // Work of humanization
  let mockResultText = "";
  let changesArray: string[] = [];
  let score = 95;
  let aiProbabilityBefore = 95;

  let modeInstruction = "";
  let modeLabel = "Standard";
  if (mode === "academic" || mode === "académique") {
    modeLabel = "Académique";
    modeInstruction = `
CONSIGNE SPÉCIFIQUE DU MODE ACADÉMIQUE :
Adoptez un ton formel, rigoureux et hautement universitaire. Utilisez un vocabulaire soutenu, précis et intellectuellement soigné, parfaitement adapté à un essai, une thèse ou un article scientifique, tout en conservant une structure humaine vivante (variez le rythme des phrases, évitez le jargon robotique creux ou les transitions clichées de l'IA).
`;
  } else if (mode === "creative" || mode === "créatif") {
    modeLabel = "Créatif";
    modeInstruction = `
CONSIGNE SPÉCIFIQUE DU MODE CRÉATIF :
Adoptez un ton engageant, expressif, vivant et percutant. Utilisez des figures de style imagées, un vocabulaire riche, dynamique et évocateur adapté au storytelling, aux articles de blog attrayants ou au copywriting de marketing, tout en conservant un style fluide et naturel qui capte l'intérêt du lecteur.
`;
  } else {
    modeInstruction = `
CONSIGNE SPÉCIFIQUE DU MODE STANDARD :
Adoptez un ton professionnel, fluide et équilibré. C'est le style standard d'une rédaction humaine de haute qualité, claire, directe et naturelle, convenant à tous types d'écrits quotidiens ou professionnels.
`;
  }

  if (!ai) {
    // Sandbox rephrasing fallback when Gemini Key is absent
    const words = text.split(" ");
    const humanizedWords = words.map((w: string) => {
      if (w.toLowerCase().includes("premièrement")) return "Tout d'abord";
      if (w.toLowerCase().includes("crucial")) return "essentiel";
      if (w.toLowerCase().includes("conclusion")) return "Au final";
      if (w.toLowerCase().includes("robuste")) return "solide";
      if (w.toLowerCase() === "témoigne") return "montre";
      return w;
    });

    mockResultText = humanizedWords.join(" ") + `\n\n*(Note de prévisualisation : Clé API Gemini non configurée dans vos variables d'environnement. Reformatage appliqué en mode local - Style ${modeLabel}).*`;
    score = 88;
    changesArray = [
      `Réécriture locale en style ${modeLabel}`,
      "Suppression des répétitions automatiques",
      "Ajustement du rythme des phrases"
    ];
    
    // Fallback heuristic: check if typical AI patterns are present
    const lowerText = text.toLowerCase();
    if (lowerText.includes("crucial") || lowerText.includes("robuste") || lowerText.includes("premièrement") || lowerText.includes("de plus") || lowerText.includes("en conclusion") || lowerText.includes("témoigne")) {
      aiProbabilityBefore = 88;
    } else {
      aiProbabilityBefore = 12; // Appears highly human
    }
  } else {
    try {
      const prompt = `
Vous êtes un rédacteur professionnel humain d'élite, expert en style littéraire et en détection de contenu généré par IA. Votre tâche consiste à analyser le texte d'origine ci-dessous pour estimer s'il a été rédigé par une IA, puis à l'« humaniser » pour qu'il soit absolument indétectable par les logiciels de détection d'IA (GPTZero, CopyLeaks, Turnitin, etc.) et qu'il se lise avec authenticité, clarté et fluidité humaine.

Règles impératives à suivre :
1. Estimez la probabilité (en pourcentage de 0 à 100) que le texte d'origine fourni ait été écrit par une IA (par exemple, un texte écrit par un humain aura une probabilité faible de 5% à 20%, tandis qu'un texte généré par ChatGPT/Gemini aura une probabilité élevée de 85% à 100%).
2. Conservez l'intégralité du sens d'origine, des faits et de la structure logique.
3. Évitez les structures de phrases stéréotypées de l'IA (p. ex., commencer systématiquement par un gérondif, utiliser trop de connecteurs comme "Premièrement", "De plus", "En outre", "Il est crucial de noter", "En conclusion").
4. Variez naturellement la longueur des phrases. Écrivez des phrases courtes et percutantes à côté de phrases plus longues et fluides.
5. Utilisez un français authentique, vivant et naturel. Choisissez des expressions idiomatiques élégantes.
6. Diminuez le niveau d'académisme stérile au profit d'une voix humaine chaleureuse et captivante.
${modeInstruction}

Texte d'origine à analyser et à transformer :
"""
${text}
"""

Renvoie ta réponse au format JSON contenant uniquement ces quatre clés :
- "aiProbabilityBefore": Un entier entre 0 et 100 représentant votre estimation de la probabilité que le texte d'origine fourni ait été écrit par une IA (basé sur le manque de rythme, la répétitivité, les tics de langage caractéristiques des IA, etc.).
- "humanizedText": Le texte réécrit de façon humaine et fluide.
- "score": Un entier entre 90 et 99 représentant l'évaluation estimée de son humanité par rapport au texte initial.
- "changes": Un tableau de 2 ou 3 phrases courtes en français expliquant les optimisations de style menées (p. ex. : "Brise de la monotonie de longueur de phrase", "Remplacement des adverbes artificiels").
`;

      const modelsToTry = [];
      if (process.env.GEMINI_MODEL) {
        modelsToTry.push(process.env.GEMINI_MODEL);
      }
      modelsToTry.push("gemini-2.5-flash");
      modelsToTry.push("gemini-2.0-flash");
      modelsToTry.push("gemini-1.5-flash");

      const uniqueModels = [...new Set(modelsToTry)];

      let response;
      let lastErr: any = null;

      for (const model of uniqueModels) {
        try {
          console.log(`[GEMINI] Tentative de génération avec le modèle : ${model}`);
          response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 1,
            },
          });
          console.log(`[GEMINI] Succès avec le modèle : ${model}`);
          lastErr = null;
          break;
        } catch (err: any) {
          console.warn(`[GEMINI] Échec avec le modèle ${model} :`, err.message || err);
          lastErr = err;
        }
      }

      if (lastErr) {
        throw lastErr;
      }

      const responseText = response.text || "";
      const parsedData = JSON.parse(responseText);

      mockResultText = parsedData.humanizedText || "";
      score = parsedData.score || 95;
      changesArray = parsedData.changes || ["Réduction de l'académisme structurel", "Instauration de variations de rythme"];
      aiProbabilityBefore = parsedData.aiProbabilityBefore !== undefined ? Number(parsedData.aiProbabilityBefore) : 95;

    } catch (err: any) {
      console.error("Gemini humanize error:", err);
      return res.status(500).json({ error: "Une erreur est survenue lors de l'humanisation du texte par l'IA : " + err.message });
    }
  }

  // Create history record
  const newItem = {
    id: "hist_" + Math.random().toString(36).substr(2, 9),
    userId: userId || "anonymous",
    originalText: text,
    humanizedText: mockResultText,
    wordCount: mockResultText.trim().split(/\s+/).length,
    originalWordCount: wordCount,
    humanityScore: score,
    aiProbabilityBefore: aiProbabilityBefore,
    createdAt: new Date().toISOString(),
  };

  // Save history on Supabase or local backup
  if (userId) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("history")
          .insert([{
            user_uid: newItem.userId,
            prompt: newItem.originalText,
            result: newItem.humanizedText,
            created_at: newItem.createdAt
          }]);
        if (error) throw error;
      } catch (dbErr) {
        console.error("[SUPABASE HISTORY SAVE ERROR]", dbErr);
      }
    } else {
      const history = readJSONFile(HISTORY_FILE, []);
      history.unshift(newItem);
      writeJSONFile(HISTORY_FILE, history);
    }
  }

  res.json({
    humanizedText: mockResultText,
    originalWordCount: wordCount,
    humanityScore: score,
    changesMade: changesArray,
    aiProbabilityBefore: aiProbabilityBefore,
  });
});

// 8. History API
app.get("/api/history", authMiddleware, async (req, res) => {
  const userId = (req as any).secureUserId;
  
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("history")
        .select("*")
        .eq("user_uid", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map snake_case database schema fields back to typescript camelCase responses cleanly
      const mappedHistory = (data || []).map((row: any) => {
        // Generate a deterministic score between 95 and 99 based on row ID char code
        const charCode = row.id && row.id.length > 0 ? row.id.charCodeAt(0) : 0;
        const score = 95 + (charCode % 5);
        return {
          id: row.id,
          userId: row.user_uid,
          originalText: row.prompt || "",
          humanizedText: row.result || "",
          wordCount: row.result ? row.result.trim().split(/\s+/).length : 0,
          originalWordCount: row.prompt ? row.prompt.trim().split(/\s+/).length : 0,
          humanityScore: score,
          createdAt: row.created_at,
        };
      });

      return res.json(mappedHistory);
    } catch (dbErr: any) {
      console.error("[SUPABASE HISTORY FETCH ERROR]", dbErr);
      return res.status(500).json({ error: `Erreur d'acquisition de l'historique Supabase: ${dbErr.message}` });
    }
  } else {
    const history = readJSONFile(HISTORY_FILE, []);
    const userHistory = history.filter((item: any) => item.userId === userId);
    res.json(userHistory);
  }
});

// Serve frontend build or Vite middleware
if (process.env.VERCEL !== "1") {
  async function startServer() {
    if (process.env.NODE_ENV !== "production") {
      const viteModule = "vite";
      const { createServer: createViteServer } = await import(viteModule);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[SERVER] Full-stack application running on port ${PORT}`);
    });
  }

  startServer();
}

export default app;

