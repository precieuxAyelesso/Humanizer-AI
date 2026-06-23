import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Load .env then .env.local so local overrides take precedence when present
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set up directory for persisting data safely in container filesystem (sandbox fallback fallback)
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

let supabase: any = null;
let isSupabaseConfigured = false;

if (supabaseUrl && supabaseKey) {
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
  console.warn("[SUPABASE] Variables SUPABASE_URL ou SUPABASE_KEY manquantes dans l'environnement. Mode bac à sable local activé.");
}

// Initializing mock/in-memory SMS codes & user store
const activeSmsCodes: { [phone: string]: string } = {};

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const geminiApiKey = process.env.GEMINI_API_KEY || "";
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini API Client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
} else {
  console.warn("GEMINI_API_KEY not defined in environment.");
}

// 0. DB Status Check Endpoint
app.get("/api/db/status", (req, res) => {
  res.json({
    connected: isSupabaseConfigured,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : null,
    mode: isSupabaseConfigured ? "Supabase Cloud Database" : "Sandbox Local Fallback (Fichiers JSON supprimés dès que vous connectez Supabase)",
  });
});

// REST API Endpoints

// 1. Auth: User Registration
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Tous les champs obligatoires (nom, email, mot de passe) doivent être remplis." });
  }

  const cleanEmail = email.toLowerCase();
  const uid = "usr_" + Math.random().toString(36).substr(2, 9);
  const newUser = {
    uid,
    name,
    email: cleanEmail,
    password, // Hash or encrypt for production securely
    phone: phone || "",
    isSmsVerified: false,
    isPremium: false,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      // Check duplicate on Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("email")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est déjà utilisé par un autre compte Supabase." });
      }

      // Save user to Supabase
      const { error: insertError } = await supabase
        .from("users")
        .insert([{
          uid: newUser.uid,
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          phone: newUser.phone,
          is_sms_verified: newUser.isSmsVerified,
          is_premium: newUser.isPremium,
          created_at: newUser.createdAt
        }]);

      if (insertError) throw insertError;
    } catch (dbErr: any) {
      console.error("[SUPABASE REGISTER ERROR]", dbErr);
      return res.status(550).json({ error: `Erreur base de données Supabase: ${dbErr.message || dbErr}` });
    }
  } else {
    // Sandbox local file storage fallback (Automatically deleted on DB connected)
    const users = readJSONFile(USERS_FILE, []);
    if (users.some((u: any) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: "Cet email est déjà utilisé par un autre compte." });
    }
    users.push(newUser);
    writeJSONFile(USERS_FILE, users);
  }

  res.status(201).json({
    message: "Inscription réussie.",
    user: {
      uid: newUser.uid,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      isSmsVerified: newUser.isSmsVerified,
      isPremium: newUser.isPremium,
    },
  });
});

// 2. Auth: User Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe sont requis." });
  }

  const cleanEmail = email.toLowerCase();
  let user: any = null;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .eq("password", password)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        user = {
          uid: data.uid,
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          isSmsVerified: data.is_sms_verified,
          isPremium: data.is_premium,
        };
      }
    } catch (dbErr: any) {
      console.error("[SUPABASE LOGIN ERROR]", dbErr);
      return res.status(500).json({ error: `Erreur d'authentification Supabase: ${dbErr.message}` });
    }
  } else {
    const users = readJSONFile(USERS_FILE, []);
    const matching = users.find(
      (u: any) => u.email.toLowerCase() === cleanEmail && u.password === password
    );
    if (matching) {
      user = {
        uid: matching.uid,
        name: matching.name,
        email: matching.email,
        phone: matching.phone || "",
        isSmsVerified: matching.isSmsVerified,
        isPremium: matching.isPremium,
      };
    }
  }

  if (!user) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  }

  res.json({
    message: "Connexion réussie.",
    user,
  });
});

// 3. Auth: Google Login Integration (Simulated OAuth and auto-registration)
app.post("/api/auth/google", async (req, res) => {
  const { name, email, googleId } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Informations de connexion Google manquantes." });
  }

  const cleanEmail = email.toLowerCase();
  let user: any = null;

  if (isSupabaseConfigured) {
    try {
      // Find existing user by email
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        user = {
          uid: data.uid,
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          isSmsVerified: true, // Google login auto-verifies
          isPremium: data.is_premium,
        };
        // Update database if it wasn't verified
        if (!data.is_sms_verified) {
          await supabase
            .from("users")
            .update({ is_sms_verified: true })
            .eq("uid", data.uid);
        }
      } else {
        // User does not exist, auto-create on Supabase
        const uniqueUid = "usr_g_" + (googleId || Math.random().toString(36).substr(2, 9));
        user = {
          uid: uniqueUid,
          name,
          email: cleanEmail,
          phone: "",
          isSmsVerified: true, // Google accounts should be pre-verified
          isPremium: false,
          createdAt: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("users")
          .insert([{
            uid: user.uid,
            name: user.name,
            email: user.email,
            password: "google_login_secured_" + Math.random().toString(36).substr(2, 5),
            phone: user.phone,
            is_sms_verified: true, // Auto-verify on insert
            is_premium: user.isPremium,
            created_at: user.createdAt
          }]);

        if (insertError) throw insertError;
      }
    } catch (dbErr: any) {
      console.error("[SUPABASE GOOGLE ERROR]", dbErr);
      return res.status(500).json({ error: `Erreur de connexion Google Supabase: ${dbErr.message}` });
    }
  } else {
    // Falls back to json list
    const users = readJSONFile(USERS_FILE, []);
    const matchingIndex = users.findIndex((u: any) => u.email.toLowerCase() === cleanEmail);

    if (matchingIndex !== -1) {
      const matching = users[matchingIndex];
      user = {
        uid: matching.uid,
        name: matching.name,
        email: matching.email,
        phone: matching.phone || "",
        isSmsVerified: true,
        isPremium: matching.isPremium,
      };
      
      // Update in local file
      if (!matching.isSmsVerified) {
        users[matchingIndex].isSmsVerified = true;
        writeJSONFile(USERS_FILE, users);
      }
    } else {
      user = {
        uid: "usr_g_" + (googleId || Math.random().toString(36).substr(2, 9)),
        name,
        email: cleanEmail,
        phone: "",
        isSmsVerified: true, // Google accounts are pre-verified
        isPremium: false,
        createdAt: new Date().toISOString(),
      };
      
      const completeRecord = {
        ...user,
        password: "google_login_secured_" + Math.random().toString(36).substr(2, 5),
      };
      users.push(completeRecord);
      writeJSONFile(USERS_FILE, users);
    }
  }

  res.json({
    message: "Connexion Google réussie.",
    user,
  });
});

// 3.5 Supabase Auth Callback: Handle user after OAuth
app.post("/api/auth/supabase-callback", async (req, res) => {
  const { uid, email, name, provider, googleId } = req.body;
  
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
          is_sms_verified: provider === "google", // Auto-verify for OAuth
          is_premium: false,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "email", // If email exists, update the row
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
          isSmsVerified: provider === "google" || users[existingUserIndex].isSmsVerified,
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
          isSmsVerified: provider === "google",
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

// 4. Verification identity SMS: Send code
app.post("/api/auth/send-sms", async (req, res) => {
  const { phone, userId } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Numéro de téléphone requis." });
  }

  // Generate a random 6-digit numeric verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  activeSmsCodes[phone] = code;

  // Update user's phone in database
  if (userId) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("users")
          .update({ phone })
          .eq("uid", userId);
        if (error) throw error;
      } catch (dbErr: any) {
        console.error("[SUPABASE SMS PHONE UPDATE ERROR]", dbErr);
      }
    } else {
      const users = readJSONFile(USERS_FILE, []);
      const userIndex = users.findIndex((u: any) => u.uid === userId);
      if (userIndex !== -1) {
        users[userIndex].phone = phone;
        writeJSONFile(USERS_FILE, users);
      }
    }
  }

  console.log(`[SMS-GATEWAY-ROUTING] SMS d'authentification envoyé à ${phone}. Code de sécurité: ${code}`);

  res.json({
    message: "Un code de vérification SMS sécurisé a été généré.",
    verificationCode: code, // Shared in response strictly for demonstration/ease
    phone,
  });
});

// 5. Verification identity SMS: Verify code
app.post("/api/auth/verify-sms", async (req, res) => {
  const { phone, code, userId } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: "Téléphone et code de sécurité requis." });
  }

  const expectedCode = activeSmsCodes[phone];
  if (!expectedCode || expectedCode !== code) {
    return res.status(400).json({ error: "Le code de vérification SMS saisi est incorrect ou a expiré." });
  }

  // Delete consumed code
  delete activeSmsCodes[phone];

  // Set users as verified in database
  if (userId) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("users")
          .update({ is_sms_verified: true })
          .eq("uid", userId);

        if (error) throw error;

        // Retrieve verified user information
        const { data: updatedUser, error: fetchErr } = await supabase
          .from("users")
          .select("*")
          .eq("uid", userId)
          .single();

        if (fetchErr) throw fetchErr;

        return res.json({
          message: "Identité vérifiée par SMS avec succès.",
          user: {
            uid: updatedUser.uid,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            isSmsVerified: true,
            isPremium: updatedUser.is_premium,
          },
        });
      } catch (dbErr: any) {
        console.error("[SUPABASE SMS VERIFY ERROR]", dbErr);
        return res.status(500).json({ error: `Erreur d'écriture Supabase: ${dbErr.message}` });
      }
    } else {
      const users = readJSONFile(USERS_FILE, []);
      const userIndex = users.findIndex((u: any) => u.uid === userId);
      if (userIndex !== -1) {
        users[userIndex].isSmsVerified = true;
        writeJSONFile(USERS_FILE, users);
        
        return res.json({
          message: "Identité vérifiée par SMS avec succès.",
          user: {
            uid: users[userIndex].uid,
            name: users[userIndex].name,
            email: users[userIndex].email,
            phone: users[userIndex].phone,
            isSmsVerified: true,
            isPremium: users[userIndex].isPremium,
          },
        });
      }
    }
  }

  res.json({ message: "Code SMS validé avec succès." });
});

// 6. Premium Subscriptions updates
app.post("/api/subscription/create", async (req, res) => {
  const { userId, paymentMethod, transactionRef } = req.body;
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
      amount: "500 CFA",
      period: "Mensuel",
      method: paymentMethod || "Mobile Money",
      ref: transactionRef || "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    },
  });
});

// 7. Humanize AI content via Gemini API
app.post("/api/humanize", async (req, res) => {
  const { text, userId } = req.body;
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

    mockResultText = humanizedWords.join(" ") + "\n\n*(Note de prévisualisation : Clé API Gemini non configurée dans vos variables d'environnement. Reformatage appliqué en mode local).*";
    score = 88;
    changesArray = ["Suppression des répétitions automatiques", "Ajustement du rythme des phrases", "Simplification des connecteurs logiques"];
  } else {
    try {
      const prompt = `
Vous êtes un rédacteur professionnel humain d'élite et expert en style littéraire. Votre tâche consiste à "humaniser" le texte ci-dessous pour qu'il soit absolument indétectable par les logiciels de détection d'IA (GPTZero, CopyLeaks, etc.) et qu'il se lise avec authenticité, clarté et fluidité humaine.

Règles impératives à suivre :
1. Conservez l'intégralité du sens d'origine, des faits et de la structure logique.
2. Évitez les structures de phrases stéréotypées de l'IA (p. ex., commencer systématiquement par un gérondif, utiliser trop de connecteurs comme "Premièrement", "De plus", "En outre", "Il est crucial de noter", "En conclusion").
3. Variez naturellement la longueur des phrases. Écrivez des phrases courtes et percutantes à côté de phrases plus longues et fluides.
4. Utilisez un français authentique, vivant et naturel. Choisissez des expressions idiomatiques élégantes.
5. Diminuez le niveau d'académisme stérile au profit d'une voix humaine chaleureuse et captivante.

Texte généré par l'IA à transformer :
"""
${text}
"""

Renvoie ta réponse au format JSON contenant uniquement trois clés :
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
    createdAt: new Date().toISOString(),
  };

  // Save history on Supabase or local backup
  if (userId) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("history")
          .insert([{
            id: newItem.id,
            user_uid: newItem.userId,
            original_text: newItem.originalText,
            humanized_text: newItem.humanizedText,
            word_count: newItem.wordCount,
            original_word_count: newItem.originalWordCount,
            humanity_score: newItem.humanityScore,
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
  });
});

// 8. History API
app.get("/api/history/:userId", async (req, res) => {
  const { userId } = req.params;
  
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("history")
        .select("*")
        .eq("user_uid", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map snake_case database schema fields back to typescript camelCase responses cleanly
      const mappedHistory = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_uid,
        originalText: row.original_text,
        humanizedText: row.humanized_text,
        wordCount: row.word_count,
        originalWordCount: row.original_word_count,
        humanityScore: row.humanity_score,
        createdAt: row.created_at,
      }));

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
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

