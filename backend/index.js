"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);

// src/app.ts
var import_express12 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));

// src/modules/auth/auth.routes.ts
var import_express = require("express");
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));
var import_zod = require("zod");
var import_app2 = require("firebase-admin/app");
var import_auth2 = require("firebase-admin/auth");

// src/config/db.ts
var import_pg = require("pg");

// src/config/env.ts
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
var nodeEnv = process.env.NODE_ENV || "development";
if (nodeEnv === "production") {
  if (!process.env.DATABASE_URL) {
    throw new Error("FATAL: DATABASE_URL environment variable is required in production.");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is required in production.");
  }
}
var ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-rentu-fallback-jwt-secret-do-not-use-in-prod",
  NODE_ENV: nodeEnv,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "rentu-732b7",
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "BDJrNfooBDHVn9HE49Gq-omM8ml0zxaTNhbbqQC3viLcLy0Ug4qWg25yLHMiOeoGM9sYqSZ-bR6xadyWSo7J1Lo",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "RJVgTmQ1qhx1oCXZmh9OENXNyuVev2aX0zd-uUeWJEQ",
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || "mailto:notifications@rentu.internal"
};

// src/config/db.ts
var isRemote = Boolean(
  ENV.DATABASE_URL && (ENV.DATABASE_URL.includes("supabase.co") || ENV.DATABASE_URL.includes("pooler") || ENV.NODE_ENV === "production")
);
var pool = new import_pg.Pool({
  connectionString: ENV.DATABASE_URL || void 0,
  ssl: isRemote ? { rejectUnauthorized: false } : void 0,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3
});
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});
var query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (ENV.NODE_ENV === "development" && duration > 100) {
    console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
  }
  return res;
};

// src/middleware/response.ts
var sendSuccess = (res, data, message, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...message ? { message } : {}
  });
};
var sendError = (res, code, message, statusCode = 400, details) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...details ? { details } : {}
    }
  });
};

// src/middleware/auth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
if (ENV.FIREBASE_PROJECT_ID && (0, import_app.getApps)().length === 0) {
  try {
    (0, import_app.initializeApp)({
      projectId: ENV.FIREBASE_PROJECT_ID
    });
  } catch (err) {
    console.warn("Firebase Admin initialization notice:", err);
  }
}
async function resolveUserFromToken(token) {
  try {
    const decoded = import_jsonwebtoken.default.verify(token, ENV.JWT_SECRET);
    if (decoded && decoded.id) {
      const checkRes = await query(
        "SELECT id, email, role, name FROM users WHERE id = $1",
        [decoded.id]
      );
      if (checkRes.rows.length > 0) {
        const u = checkRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }
    }
  } catch {
  }
  if (ENV.FIREBASE_PROJECT_ID && (0, import_app.getApps)().length > 0) {
    try {
      const decodedFb = await (0, import_auth.getAuth)().verifyIdToken(token);
      if (decodedFb && decodedFb.uid) {
        const firebaseUid = decodedFb.uid;
        const email = decodedFb.email || `${firebaseUid}@firebase.rentu.internal`;
        const name = decodedFb.name || "User";
        let userRes = await query(
          "SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2",
          [firebaseUid, firebaseUid]
        );
        if (userRes.rows.length === 0) {
          await query(
            `INSERT INTO users (id, firebase_uid, name, email, role)
             VALUES ($1, $2, $3, $4, 'USER')
             ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid, updated_at = NOW();`,
            [firebaseUid, firebaseUid, name, email]
          ).catch(() => {
          });
          userRes = await query(
            "SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1",
            [firebaseUid]
          );
        }
        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          return { id: u.id, email: u.email, role: u.role, name: u.name };
        }
      }
    } catch {
    }
  }
  return null;
}
var authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Access token required", 401);
  }
  const token = authHeader.split(" ")[1];
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return sendError(res, "INVALID_TOKEN", "Session expired or token invalid", 401);
    }
    req.user = user;
    next();
  } catch (err) {
    return sendError(res, "INVALID_TOKEN", "Session expired or token invalid", 401);
  }
};
var optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const user = await resolveUserFromToken(token);
      if (user) {
        req.user = user;
      }
    } catch {
    }
  }
  next();
};

// src/modules/auth/auth.routes.ts
var router = (0, import_express.Router)();
var registerSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email address format"),
  password: import_zod.z.string().min(6, "Password must be at least 6 characters"),
  name: import_zod.z.string().optional(),
  phone: import_zod.z.string().optional(),
  locality: import_zod.z.string().optional(),
  avatar_url: import_zod.z.string().url().optional(),
  bio: import_zod.z.string().optional()
});
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email address format"),
  password: import_zod.z.string().min(1, "Password is required")
});
var generateToken = (user) => {
  return import_jsonwebtoken2.default.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    ENV.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
router.post("/register", async (req, res, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const email = validated.email.toLowerCase();
    const displayName = validated.name || email.split("@")[0];
    const locality = validated.locality || "Saket, New Delhi";
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return sendError(res, "USER_EXISTS", "An account with this email already exists", 409);
    }
    const passwordHash = await import_bcryptjs.default.hash(validated.password, 10);
    const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;
    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, locality, avatar_url, bio, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER')
       RETURNING id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at`,
      [
        email,
        passwordHash,
        displayName,
        validated.phone || null,
        locality,
        defaultAvatar,
        validated.bio || "New member of the Rentu\u207A gear rental network \u26A1"
      ]
    );
    const user = result.rows[0];
    const token = generateToken(user);
    return sendSuccess(res, { user, token }, "Registration successful! Welcome to Rentu\u207A \u{1F680}", 201);
  } catch (error) {
    next(error);
  }
});
router.post("/login", async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await query(
      `SELECT id, email, password_hash, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`,
      [validated.email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const user = result.rows[0];
    const isMatch = await import_bcryptjs.default.compare(validated.password, user.password_hash);
    if (!isMatch) {
      return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);
    return sendSuccess(res, { user: safeUser, token }, "Logged in successfully! \u{1F680}");
  } catch (error) {
    next(error);
  }
});
router.post("/demo-login", async (req, res, next) => {
  try {
    const { role = "lender" } = req.body;
    let targetEmail = "rohit@lens.com";
    if (role === "borrower") targetEmail = "ananya@studio.com";
    if (role === "admin") targetEmail = "admin@borrowflex.com";
    if (role === "creator") targetEmail = "kabir@vibes.com";
    const result = await query(
      `SELECT id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`,
      [targetEmail]
    );
    if (result.rows.length === 0) {
      return sendError(res, "USER_NOT_FOUND", "Demo user not seeded yet", 404);
    }
    const user = result.rows[0];
    const token = generateToken(user);
    return sendSuccess(res, { user, token }, `Demo logged in as ${user.name}`);
  } catch (error) {
    next(error);
  }
});
var firebaseSyncSchema = import_zod.z.object({
  firebaseUid: import_zod.z.string().min(1, "Firebase UID is required"),
  email: import_zod.z.string().email(),
  name: import_zod.z.string().min(1),
  idToken: import_zod.z.string().optional(),
  avatarUrl: import_zod.z.string().optional(),
  locality: import_zod.z.string().optional(),
  phone: import_zod.z.string().optional()
});
var handleSyncUser = async (req, res, next) => {
  try {
    const validated = firebaseSyncSchema.parse(req.body);
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : validated.idToken;
    if (!token) {
      return sendError(res, "UNAUTHORIZED", "Valid Firebase ID token required in Authorization header or body", 401);
    }
    let verifiedUid = validated.firebaseUid;
    let verifiedEmail = validated.email.toLowerCase();
    if ((0, import_app2.getApps)().length > 0) {
      try {
        const decoded = await (0, import_auth2.getAuth)().verifyIdToken(token);
        if (!decoded || !decoded.uid) {
          return sendError(res, "UNAUTHORIZED", "Invalid or unverified Firebase ID token", 401);
        }
        if (decoded.uid !== validated.firebaseUid) {
          return sendError(res, "FORBIDDEN", "Submitted Firebase UID does not match verified token identity", 403);
        }
        verifiedUid = decoded.uid;
        if (decoded.email) {
          verifiedEmail = decoded.email.toLowerCase();
        }
      } catch (err) {
        return sendError(res, "UNAUTHORIZED", `Firebase token verification failed: ${err.message || "invalid token"}`, 401);
      }
    } else if (ENV.NODE_ENV === "production") {
      return sendError(res, "SERVICE_UNAVAILABLE", "Authentication service is not properly configured", 503);
    }
    const uid = verifiedUid;
    const email = verifiedEmail;
    const avatar = validated.avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(validated.name)}`;
    const locality = validated.locality || "Bangalore";
    const existing = await query(
      `SELECT id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, created_at
       FROM users WHERE firebase_uid = $1 OR id = $1 OR email = $2`,
      [uid, email]
    );
    let user;
    if (existing.rows.length > 0) {
      const updated = await query(
        `UPDATE users
         SET firebase_uid = $1,
             name = COALESCE(NULLIF($2, ''), name),
             avatar_url = COALESCE(avatar_url, NULLIF($3, '')),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
        [uid, validated.name, avatar, existing.rows[0].id]
      );
      user = updated.rows[0];
    } else {
      const created = await query(
        `INSERT INTO users (id, firebase_uid, email, name, phone, locality, avatar_url, bio, trust_score, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 85, 'USER')
         RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
        [
          uid,
          uid,
          email,
          validated.name,
          validated.phone || null,
          locality,
          avatar,
          "Member of the Rentu\u207A gear rental community \u26A1"
        ]
      );
      user = created.rows[0];
    }
    const tokenPayload = generateToken(user);
    return sendSuccess(res, { user, token: tokenPayload }, "Firebase session synchronized with Rentu\u207A! \u{1F680}");
  } catch (error) {
    next(error);
  }
};
router.post("/firebase-sync", handleSyncUser);
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return sendError(res, "USER_NOT_FOUND", "User profile not found", 404);
    }
    const user = result.rows[0];
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1) AS lent_count,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1) AS borrowed_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_rents,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`,
      [user.id]
    );
    return sendSuccess(res, {
      ...user,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});
var auth_routes_default = router;

// src/modules/items/items.routes.ts
var import_express2 = require("express");
var import_zod2 = require("zod");

// src/utils/city.ts
function extractCity(locality) {
  if (!locality) return "Bangalore";
  const loc = locality.toLowerCase();
  if (loc.includes("bangalore") || loc.includes("bengaluru") || loc.includes("koramangala") || loc.includes("kengeri") || loc.includes("indiranagar") || loc.includes("whitefield") || loc.includes("hsr")) {
    return "Bangalore";
  }
  if (loc.includes("mumbai") || loc.includes("bandra") || loc.includes("powai") || loc.includes("andheri") || loc.includes("juhu") || loc.includes("colaba")) {
    return "Mumbai";
  }
  if (loc.includes("delhi") || loc.includes("saket") || loc.includes("hauz") || loc.includes("noida") || loc.includes("gurgaon")) {
    return "Delhi";
  }
  return "Bangalore";
}

// src/modules/items/items.routes.ts
var router2 = (0, import_express2.Router)();
var createItemSchema = import_zod2.z.object({
  title: import_zod2.z.string().min(3, "Title must be at least 3 characters"),
  description: import_zod2.z.string().min(10, "Description must be at least 10 characters"),
  category: import_zod2.z.string().min(2, "Category is required"),
  price_per_day: import_zod2.z.number().positive("Price per day must be greater than 0"),
  max_duration_days: import_zod2.z.number().int().positive().default(3),
  image_urls: import_zod2.z.array(import_zod2.z.string().url()).min(1, "At least one photo is required"),
  sticker_badge: import_zod2.z.string().default("\u2728 Weekend Flex"),
  locality: import_zod2.z.string().min(2, "Locality is required"),
  address_text: import_zod2.z.string().optional(),
  pincode: import_zod2.z.string().optional(),
  latitude: import_zod2.z.number().optional(),
  longitude: import_zod2.z.number().optional()
});
var updateItemSchema = import_zod2.z.object({
  title: import_zod2.z.string().min(3).optional(),
  description: import_zod2.z.string().min(10).optional(),
  category: import_zod2.z.string().optional(),
  price_per_day: import_zod2.z.number().positive().optional(),
  max_duration_days: import_zod2.z.number().int().positive().optional(),
  image_urls: import_zod2.z.array(import_zod2.z.string().url()).optional(),
  sticker_badge: import_zod2.z.string().optional(),
  locality: import_zod2.z.string().optional(),
  address_text: import_zod2.z.string().optional(),
  pincode: import_zod2.z.string().optional(),
  latitude: import_zod2.z.number().optional(),
  longitude: import_zod2.z.number().optional(),
  status: import_zod2.z.enum(["AVAILABLE", "RENTED", "UNAVAILABLE"]).optional()
});
router2.get("/", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const {
      category,
      search,
      locality,
      status = "AVAILABLE",
      ownerId,
      latitude,
      longitude,
      radar,
      max_distance
    } = req.query;
    const params = [];
    let distanceField = "NULL AS distance_meters";
    let distanceFilter = "";
    if (latitude && longitude) {
      const latNum = parseFloat(String(latitude));
      const lonNum = parseFloat(String(longitude));
      if (!isNaN(latNum) && !isNaN(lonNum)) {
        params.push(latNum);
        const latIdx = params.length;
        params.push(lonNum);
        const lonIdx = params.length;
        distanceField = `
          ROUND(
            6371000 * acos(
              LEAST(1.0, GREATEST(-1.0, 
                cos(radians($${latIdx})) * cos(radians(i.latitude)) *
                cos(radians(i.longitude) - radians($${lonIdx})) +
                sin(radians($${latIdx})) * sin(radians(i.latitude))
              ))
            )
          ) AS distance_meters
        `;
        if (radar === "true" || radar === "100m" || max_distance) {
          const limitMeters = max_distance ? parseFloat(String(max_distance)) : 100;
          params.push(limitMeters);
          distanceFilter = ` AND (
            6371000 * acos(
              LEAST(1.0, GREATEST(-1.0, 
                cos(radians($${latIdx})) * cos(radians(i.latitude)) *
                cos(radians(i.longitude) - radians($${lonIdx})) +
                sin(radians($${latIdx})) * sin(radians(i.latitude))
              ))
            )
          ) <= $${params.length}`;
        }
      }
    }
    let sql = `
      SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.address_text, i.latitude, i.longitude, i.status, i.created_at,
        ${distanceField},
        COALESCE(u.id, i.owner_id) AS owner_id, 
        COALESCE(u.name, 'Community Member') AS owner_name, 
        u.avatar_url AS owner_avatar,
        COALESCE(u.locality, i.locality) AS owner_locality, 
        COALESCE(u.trust_score, 98) AS owner_trust_score,
        COALESCE(u.rating, 5.00) AS owner_rating
      FROM items i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE 1=1 ${distanceFilter}
    `;
    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }
    if (category && category !== "All") {
      params.push(category);
      sql += ` AND i.category = $${params.length}`;
    }
    if (ownerId) {
      params.push(ownerId);
      sql += ` AND i.owner_id = $${params.length}`;
    } else if (!radar || radar === "false") {
      let userCity = null;
      const authUser = req.user;
      if (authUser?.id) {
        const userRes = await query("SELECT locality FROM users WHERE id = $1", [authUser.id]);
        if (userRes.rows.length > 0 && userRes.rows[0].locality) {
          userCity = extractCity(userRes.rows[0].locality);
        }
      }
      if (locality && locality !== "All" && locality !== "all") {
        const activeCity = extractCity(String(locality));
        params.push(`%${activeCity}%`);
        sql += ` AND (i.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      } else if (userCity) {
        params.push(`%${userCity}%`);
        sql += ` AND (i.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      }
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (i.title ILIKE $${params.length} OR i.description ILIKE $${params.length} OR i.category ILIKE $${params.length})`;
    }
    if (radar === "true" || radar === "100m") {
      sql += ` ORDER BY distance_meters ASC, i.created_at DESC`;
    } else {
      sql += ` ORDER BY i.created_at DESC`;
    }
    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router2.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.status, i.created_at,
        u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
        u.bio AS owner_bio, u.trust_score AS owner_trust_score, u.locality AS owner_locality,
        u.email AS owner_email, u.phone AS owner_phone
      FROM items i
      JOIN users u ON i.owner_id = u.id
      WHERE i.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    const item = result.rows[0];
    const itemCity = extractCity(item.locality);
    const relatedResult = await query(
      `SELECT id, title, category, price_per_day, image_urls, sticker_badge, locality, status
       FROM items
       WHERE category = $1 AND id != $2 AND status = 'AVAILABLE' AND locality ILIKE $3
       LIMIT 4`,
      [item.category, item.id, `%${itemCity}%`]
    );
    return sendSuccess(res, {
      ...item,
      related_items: relatedResult.rows
    });
  } catch (error) {
    next(error);
  }
});
router2.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = createItemSchema.parse(req.body);
    const userRes = await query("SELECT locality FROM users WHERE id = $1", [req.user.id]);
    const userLocality = userRes.rows[0]?.locality || "Delhi";
    const userCity = extractCity(userLocality);
    let finalLocality = validated.locality.trim();
    if (!finalLocality.toLowerCase().includes(userCity.toLowerCase())) {
      finalLocality = `${finalLocality}, ${userCity}`;
    }
    const result = await query(
      `INSERT INTO items 
        (owner_id, title, description, category, price_per_day, max_duration_days, image_urls, sticker_badge, locality, address_text, pincode, latitude, longitude, status)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, 'AVAILABLE')
       RETURNING *`,
      [
        req.user.id,
        validated.title,
        validated.description,
        validated.category,
        validated.price_per_day,
        validated.max_duration_days,
        JSON.stringify(validated.image_urls),
        validated.sticker_badge,
        finalLocality,
        validated.address_text || finalLocality,
        validated.pincode || null,
        validated.latitude || 28.5355,
        validated.longitude || 77.2167
      ]
    );
    return sendSuccess(res, result.rows[0], "Gear listed successfully! \u2728 It is now live on the feed.", 201);
  } catch (error) {
    next(error);
  }
});
router2.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = updateItemSchema.parse(req.body);
    const check = await query("SELECT owner_id FROM items WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "You do not have permission to edit this listing", 403);
    }
    const fields = [];
    const values = [];
    if (validated.title !== void 0) {
      values.push(validated.title);
      fields.push(`title = $${values.length}`);
    }
    if (validated.description !== void 0) {
      values.push(validated.description);
      fields.push(`description = $${values.length}`);
    }
    if (validated.category !== void 0) {
      values.push(validated.category);
      fields.push(`category = $${values.length}`);
    }
    if (validated.price_per_day !== void 0) {
      values.push(validated.price_per_day);
      fields.push(`price_per_day = $${values.length}`);
    }
    if (validated.max_duration_days !== void 0) {
      values.push(validated.max_duration_days);
      fields.push(`max_duration_days = $${values.length}`);
    }
    if (validated.image_urls !== void 0) {
      values.push(JSON.stringify(validated.image_urls));
      fields.push(`image_urls = $${values.length}::jsonb`);
    }
    if (validated.sticker_badge !== void 0) {
      values.push(validated.sticker_badge);
      fields.push(`sticker_badge = $${values.length}`);
    }
    if (validated.locality !== void 0) {
      values.push(validated.locality);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.status !== void 0) {
      values.push(validated.status);
      fields.push(`status = $${values.length}`);
    }
    if (fields.length === 0) {
      return sendError(res, "BAD_REQUEST", "No fields provided for update", 400);
    }
    values.push(id);
    const updateSql = `
      UPDATE items 
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
    const result = await query(updateSql, values);
    return sendSuccess(res, result.rows[0], "Listing updated successfully");
  } catch (error) {
    next(error);
  }
});
router2.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const check = await query("SELECT owner_id FROM items WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "Permission denied", 403);
    }
    await query("DELETE FROM items WHERE id = $1", [id]);
    return sendSuccess(res, { id }, "Listing deleted successfully");
  } catch (error) {
    next(error);
  }
});
var items_routes_default = router2;

// src/modules/requests/requests.routes.ts
var import_express3 = require("express");
var import_zod3 = require("zod");
var router3 = (0, import_express3.Router)();
var createRequestSchema = import_zod3.z.object({
  item_name: import_zod3.z.string().min(3, "Item name must be at least 3 characters"),
  description: import_zod3.z.string().min(5, "Description is required"),
  category: import_zod3.z.string().default("Other"),
  start_date: import_zod3.z.string().min(1, "Needed date is required"),
  start_time: import_zod3.z.string().optional(),
  duration_days: import_zod3.z.number().int().positive().default(1),
  offered_amount: import_zod3.z.number().positive("Offered budget must be greater than 0"),
  locality: import_zod3.z.string().min(2, "Locality is required"),
  address_text: import_zod3.z.string().optional(),
  pincode: import_zod3.z.string().optional(),
  latitude: import_zod3.z.number().optional(),
  longitude: import_zod3.z.number().optional()
});
router3.get("/", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const { category, locality, status = "OPEN", seekerId } = req.query;
    let sql = `
      SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        COALESCE(u.id, r.seeker_id) AS seeker_id, 
        COALESCE(u.name, 'Community Member') AS seeker_name, 
        u.avatar_url AS seeker_avatar,
        COALESCE(u.locality, r.locality) AS seeker_locality, 
        COALESCE(u.trust_score, 98) AS seeker_trust_score,
        u.phone AS seeker_phone, 
        u.email AS seeker_email
      FROM requests r
      LEFT JOIN users u ON r.seeker_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (category && category !== "All") {
      params.push(category);
      sql += ` AND r.category = $${params.length}`;
    }
    if (seekerId) {
      params.push(seekerId);
      sql += ` AND r.seeker_id = $${params.length}`;
    } else {
      let userCity = null;
      const authUser = req.user;
      if (authUser?.id) {
        const userRes = await query("SELECT locality FROM users WHERE id = $1", [authUser.id]);
        if (userRes.rows.length > 0 && userRes.rows[0].locality) {
          userCity = extractCity(userRes.rows[0].locality);
        }
      }
      if (locality && locality !== "All" && locality !== "all") {
        const activeCity = extractCity(String(locality));
        params.push(`%${activeCity}%`);
        sql += ` AND (r.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      } else if (userCity) {
        params.push(`%${userCity}%`);
        sql += ` AND (r.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      }
    }
    sql += ` ORDER BY r.created_at DESC`;
    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router3.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        u.id AS seeker_id, u.name AS seeker_name, u.avatar_url AS seeker_avatar,
        u.locality AS seeker_locality, u.trust_score AS seeker_trust_score,
        u.phone AS seeker_phone, u.email AS seeker_email
      FROM requests r
      JOIN users u ON r.seeker_id = u.id
      WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Wish request not found", 404);
    }
    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});
router3.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = createRequestSchema.parse(req.body);
    await query(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES ($1, $2, $3, 'USER', $4)
      ON CONFLICT (id) DO NOTHING;
    `, [
      req.user.id,
      req.user.name || "Rentu Member",
      req.user.email || `${req.user.id}@firebase.rentu.internal`,
      validated.locality || "Delhi"
    ]).catch(() => {
    });
    const userRes = await query("SELECT locality FROM users WHERE id = $1", [req.user.id]);
    const userLocality = userRes.rows[0]?.locality || "Delhi";
    const userCity = extractCity(userLocality);
    let finalLocality = validated.locality.trim();
    if (!finalLocality.toLowerCase().includes(userCity.toLowerCase())) {
      finalLocality = `${finalLocality}, ${userCity}`;
    }
    const result = await query(
      `INSERT INTO requests
        (seeker_id, item_name, description, category, start_date, start_time, duration_days, offered_amount, locality, address_text, pincode, latitude, longitude, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN')
       RETURNING *`,
      [
        req.user.id,
        validated.item_name,
        validated.description,
        validated.category,
        validated.start_date,
        validated.start_time || "10:00",
        validated.duration_days,
        validated.offered_amount,
        finalLocality,
        validated.address_text || finalLocality,
        validated.pincode || null,
        validated.latitude || 28.5355,
        validated.longitude || 77.2167
      ]
    );
    return sendSuccess(res, result.rows[0], "Wish dropped to community feed! \u{1F3AF} Nearby owners will see your bounty.", 201);
  } catch (error) {
    next(error);
  }
});
router3.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = "FULFILLED" } = req.body;
    const check = await query("SELECT seeker_id, status FROM requests WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Wish request not found", 404);
    }
    const result = await query(
      `UPDATE requests
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return sendSuccess(res, result.rows[0], `Wish marked as ${status.toLowerCase()}! \u{1F91D}`);
  } catch (error) {
    next(error);
  }
});
router3.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const check = await query("SELECT seeker_id FROM requests WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Wish request not found", 404);
    }
    if (check.rows[0].seeker_id !== req.user.id && req.user.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "Permission denied", 403);
    }
    await query("DELETE FROM requests WHERE id = $1", [id]);
    return sendSuccess(res, { id }, "Wish request deleted");
  } catch (error) {
    next(error);
  }
});
var requests_routes_default = router3;

// src/modules/bookings/bookings.routes.ts
var import_express4 = require("express");
var import_zod4 = require("zod");

// src/modules/realtime/realtime.service.ts
var RealtimeService = class {
  static clients = /* @__PURE__ */ new Map();
  static heartbeatInterval = null;
  static init() {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.broadcastPing();
      }, 25e3);
      if (this.heartbeatInterval.unref) {
        this.heartbeatInterval.unref();
      }
    }
  }
  static addClient(userId, res) {
    this.init();
    if (!this.clients.has(userId)) {
      this.clients.set(userId, /* @__PURE__ */ new Set());
    }
    const userClients = this.clients.get(userId);
    userClients.add(res);
    res.write(`event: connected
data: ${JSON.stringify({ userId, connectedAt: (/* @__PURE__ */ new Date()).toISOString() })}

`);
    res.on("close", () => {
      userClients.delete(res);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    });
  }
  static sendToUser(userId, event, data) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) return;
    const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
    for (const res of userClients) {
      try {
        res.write(payload);
      } catch (err) {
        console.warn(`Failed to write to SSE client for user ${userId}:`, err);
        userClients.delete(res);
      }
    }
  }
  static broadcastPing() {
    for (const [userId, clientSet] of this.clients.entries()) {
      for (const res of clientSet) {
        try {
          res.write(":ping\n\n");
        } catch {
          clientSet.delete(res);
        }
      }
      if (clientSet.size === 0) {
        this.clients.delete(userId);
      }
    }
  }
  static getConnectedCount(userId) {
    if (userId) {
      return this.clients.get(userId)?.size || 0;
    }
    let total = 0;
    for (const set of this.clients.values()) {
      total += set.size;
    }
    return total;
  }
};

// src/modules/push/push.service.ts
var import_web_push = __toESM(require("web-push"));
if (ENV.VAPID_PUBLIC_KEY && ENV.VAPID_PRIVATE_KEY) {
  try {
    import_web_push.default.setVapidDetails(
      ENV.VAPID_SUBJECT,
      ENV.VAPID_PUBLIC_KEY,
      ENV.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.warn("Failed to initialize web-push VAPID details:", err);
  }
}
var PushService = class {
  /**
   * Save or update a user's browser push subscription
   */
  static async saveSubscription(userId, subscription) {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw new Error("Invalid push subscription object");
    }
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE 
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             created_at = CURRENT_TIMESTAMP;`,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );
  }
  /**
   * Remove a user's browser push subscription (when disabling notifications)
   */
  static async removeSubscription(userId, endpoint) {
    await query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2;`,
      [userId, endpoint]
    );
  }
  /**
   * Send a Web Push notification to all active devices registered by the user
   */
  static async sendPushToUser(userId, payload) {
    try {
      const subsRes = await query(
        `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1;`,
        [userId]
      );
      if (subsRes.rows.length === 0) return;
      const notificationData = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/favicon.ico",
        badge: payload.badge || "/favicon.ico",
        url: payload.url || "/",
        tag: payload.tag || "rentu-notification",
        data: payload.data || {}
      });
      const sendPromises = subsRes.rows.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        try {
          await import_web_push.default.sendNotification(pushSubscription, notificationData);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await query("DELETE FROM push_subscriptions WHERE id = $1;", [sub.id]).catch(() => {
            });
          } else {
            console.warn(`Web push delivery failed for endpoint ${sub.endpoint.substring(0, 30)}...:`, err.message);
          }
        }
      });
      await Promise.all(sendPromises);
    } catch (err) {
      console.warn("Error in PushService.sendPushToUser:", err);
    }
  }
};

// src/modules/notifications/notification.service.ts
var NotificationService = {
  /**
   * Safely create an in-app notification.
   * Dispatches real-time SSE stream events and Web Push notifications.
   * If notification delivery fails, it logs without interrupting parent workflows.
   */
  async create(params) {
    try {
      const { userId, type, title, body, data = {} } = params;
      if (!userId || !title || !body) {
        console.warn("NotificationService.create: missing required parameters", { userId, title });
        return null;
      }
      const res = await query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [userId, type, title, body, JSON.stringify(data)]
      );
      const notif = res.rows[0] || null;
      if (notif) {
        RealtimeService.sendToUser(userId, "notification", notif);
        PushService.sendPushToUser(userId, {
          title,
          body,
          url: data?.booking_id ? `/bookings` : "/",
          tag: `notif-${type}-${data?.booking_id || notif.id}`,
          data: {
            notification_id: notif.id,
            type,
            ...data
          }
        }).catch((pushErr) => {
          console.warn("Web push dispatch error:", pushErr);
        });
      }
      return notif;
    } catch (err) {
      console.error("Failed to create in-app notification:", err);
      return null;
    }
  },
  /**
   * Fetch notifications belonging exclusively to the authenticated user.
   */
  async getUserNotifications(userId, options = {}) {
    const limit = Math.min(Math.max(options.limit || 20, 1), 50);
    const offset = Math.max(options.offset || 0, 0);
    let sql = `
      SELECT id, user_id, type, title, body, data, read_at, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params = [userId];
    if (options.unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);
    const res = await query(sql, params);
    return res.rows;
  },
  /**
   * Get unread notification count for authenticated user.
   */
  async getUnreadCount(userId) {
    const res = await query(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || "0", 10);
  },
  /**
   * Mark an individual notification as read.
   * Strictly verifies that the notification belongs to the authenticated user.
   */
  async markAsRead(notificationId, userId) {
    const res = await query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING *`,
      [notificationId, userId]
    );
    return res.rows[0] || null;
  },
  /**
   * Mark all unread notifications belonging to the authenticated user as read.
   */
  async markAllAsRead(userId) {
    const res = await query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return res.rowCount || 0;
  }
};

// src/modules/bookings/bookings.routes.ts
var router4 = (0, import_express4.Router)();
var createBookingSchema = import_zod4.z.object({
  item_id: import_zod4.z.string().uuid("Invalid item ID format"),
  start_date: import_zod4.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  start_time: import_zod4.z.string().optional(),
  duration_days: import_zod4.z.number().int().positive("Duration must be at least 1 day").max(90, "Duration cannot exceed 90 days"),
  message: import_zod4.z.string().max(2e3, "Message cannot exceed 2000 characters").optional()
});
var updateStatusSchema = import_zod4.z.object({
  status: import_zod4.z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"])
});
router4.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = createBookingSchema.parse(req.body);
    const borrowerId = req.user.id;
    const startDateObj = /* @__PURE__ */ new Date(`${validated.start_date}T00:00:00`);
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(startDateObj.getTime()) || startDateObj < today) {
      return sendError(res, "BAD_REQUEST", "Start date cannot be in the past", 400);
    }
    const itemRes = await query(
      "SELECT id, owner_id, price_per_day, title, status, max_duration_days FROM items WHERE id = $1",
      [validated.item_id]
    );
    if (itemRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    const item = itemRes.rows[0];
    if (item.status === "UNAVAILABLE") {
      return sendError(res, "BAD_REQUEST", "This gear is currently marked unavailable", 400);
    }
    if (item.owner_id === borrowerId) {
      return sendError(res, "BAD_REQUEST", "You cannot borrow your own gear \u{1F609}", 400);
    }
    if (item.max_duration_days && validated.duration_days > item.max_duration_days) {
      return sendError(res, "BAD_REQUEST", `Maximum rental duration for this item is ${item.max_duration_days} days`, 400);
    }
    const overlapRes = await query(
      `SELECT id FROM bookings
       WHERE item_id = $1
         AND status = 'ACCEPTED'
         AND start_date <= ($2::date + ($3::integer - 1) * INTERVAL '1 day')
         AND ($2::date <= start_date + (duration_days - 1) * INTERVAL '1 day')`,
      [item.id, validated.start_date, validated.duration_days]
    );
    if (overlapRes.rows.length > 0) {
      return sendError(res, "CONFLICT", "This item already has a confirmed booking for the selected dates", 409);
    }
    const totalPrice = Number(item.price_per_day) * validated.duration_days;
    const bookingRes = await query(
      `INSERT INTO bookings
        (item_id, borrower_id, lender_id, start_date, start_time, duration_days, total_price, status, message)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
       RETURNING *`,
      [
        item.id,
        borrowerId,
        item.owner_id,
        validated.start_date,
        validated.start_time || "10:00",
        validated.duration_days,
        totalPrice,
        validated.message || `Hey! Would love to rent your ${item.title}.`
      ]
    );
    const booking = bookingRes.rows[0];
    if (validated.message) {
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)`,
        [booking.id, borrowerId, item.owner_id, validated.message]
      );
    }
    await NotificationService.create({
      userId: item.owner_id,
      type: "BOOKING_REQUEST",
      title: `New Rental Proposal for ${item.title}`,
      body: `${req.user.name} requested to rent your ${item.title} for ${validated.duration_days} day(s).`,
      data: {
        booking_id: booking.id,
        item_id: item.id,
        borrower_id: borrowerId,
        borrower_name: req.user.name,
        start_date: validated.start_date,
        duration_days: validated.duration_days,
        total_price: totalPrice
      }
    });
    return sendSuccess(res, booking, "Proposal sent to lender! You will be notified when they accept.", 201);
  } catch (error) {
    next(error);
  }
});
router4.get("/", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { role } = req.query;
    let sql = `
      SELECT 
        b.id, b.item_id, b.borrower_id, b.lender_id, 
        b.start_date, b.start_time, b.duration_days, b.total_price, 
        b.status, b.message, b.created_at,
        i.title AS item_title, i.image_urls AS item_images, i.category AS item_category,
        i.locality AS item_locality, i.price_per_day AS item_rate,
        borrower.name AS borrower_name, borrower.avatar_url AS borrower_avatar, 
        borrower.phone AS borrower_phone, borrower.email AS borrower_email,
        lender.name AS lender_name, lender.avatar_url AS lender_avatar,
        lender.phone AS lender_phone, lender.email AS lender_email
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON b.lender_id = lender.id
      WHERE (b.borrower_id = $1 OR b.lender_id = $1)
    `;
    const params = [userId];
    if (role === "borrower") {
      sql += ` AND b.borrower_id = $1`;
    } else if (role === "lender") {
      sql += ` AND b.lender_id = $1`;
    }
    sql += ` ORDER BY b.created_at DESC`;
    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router4.patch("/:id/status", authMiddleware, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status: targetStatus } = updateStatusSchema.parse(req.body);
    const userId = req.user.id;
    await client.query("BEGIN");
    const bookingRes = await client.query(
      `SELECT b.*, i.title AS item_title, lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users lender ON b.lender_id = lender.id
       JOIN users borrower ON b.borrower_id = borrower.id
       WHERE b.id = $1
       FOR UPDATE OF b`,
      [id]
    );
    if (bookingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return sendError(res, "NOT_FOUND", "Booking not found", 404);
    }
    const booking = bookingRes.rows[0];
    const isLender = booking.lender_id === userId;
    const isBorrower = booking.borrower_id === userId;
    const isAdmin = req.user.role === "ADMIN";
    if (!isLender && !isBorrower && !isAdmin) {
      await client.query("ROLLBACK");
      return sendError(res, "FORBIDDEN", "Permission denied for this booking", 403);
    }
    const terminalStates = ["REJECTED", "COMPLETED", "CANCELLED"];
    if (terminalStates.includes(booking.status)) {
      await client.query("ROLLBACK");
      return sendError(
        res,
        "BAD_REQUEST",
        `Booking is already in terminal state '${booking.status}' and cannot be updated`,
        400
      );
    }
    if (targetStatus === "ACCEPTED" || targetStatus === "REJECTED") {
      if (!isLender && !isAdmin) {
        await client.query("ROLLBACK");
        return sendError(res, "FORBIDDEN", "Only the gear owner can accept or reject proposals", 403);
      }
      if (booking.status !== "PENDING") {
        await client.query("ROLLBACK");
        return sendError(res, "BAD_REQUEST", `Only PENDING proposals can be ${targetStatus.toLowerCase()}`, 400);
      }
    }
    if (targetStatus === "COMPLETED") {
      if (booking.status !== "ACCEPTED") {
        await client.query("ROLLBACK");
        return sendError(res, "BAD_REQUEST", "Only ACCEPTED bookings can be marked as COMPLETED", 400);
      }
    }
    if (targetStatus === "CANCELLED") {
      if (booking.status !== "PENDING" && booking.status !== "ACCEPTED") {
        await client.query("ROLLBACK");
        return sendError(res, "BAD_REQUEST", "Only PENDING or ACCEPTED bookings can be cancelled", 400);
      }
    }
    if (targetStatus === "ACCEPTED") {
      const overlapRes = await client.query(
        `SELECT id FROM bookings
         WHERE item_id = $1
           AND id != $2
           AND status = 'ACCEPTED'
           AND start_date <= ($3::date + ($4::integer - 1) * INTERVAL '1 day')
           AND ($3::date <= start_date + (duration_days - 1) * INTERVAL '1 day')`,
        [booking.item_id, booking.id, booking.start_date, booking.duration_days]
      );
      if (overlapRes.rows.length > 0) {
        await client.query("ROLLBACK");
        return sendError(res, "CONFLICT", "Cannot accept: another booking is already confirmed for these dates", 409);
      }
    }
    const updateRes = await client.query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [targetStatus, id]
    );
    if (targetStatus === "ACCEPTED") {
      await client.query(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [booking.item_id]);
      await client.query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, '\u{1F389} Proposal accepted! You can coordinate pickup/dropoff here.')`,
        [id, booking.lender_id, booking.borrower_id]
      );
    } else if (targetStatus === "COMPLETED" || targetStatus === "CANCELLED" || targetStatus === "REJECTED") {
      const activeAccepted = await client.query(
        `SELECT id FROM bookings WHERE item_id = $1 AND status = 'ACCEPTED' AND id != $2`,
        [booking.item_id, booking.id]
      );
      if (activeAccepted.rows.length === 0) {
        await client.query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
      }
    }
    await client.query("COMMIT");
    const updatedBooking = updateRes.rows[0];
    if (targetStatus === "ACCEPTED") {
      await NotificationService.create({
        userId: booking.borrower_id,
        type: "BOOKING_ACCEPTED",
        title: "Proposal Accepted! \u{1F389}",
        body: `${booking.lender_name || "The owner"} accepted your rental request for ${booking.item_title}. Coordinate pickup now!`,
        data: { booking_id: booking.id, item_id: booking.item_id }
      });
    } else if (targetStatus === "REJECTED") {
      await NotificationService.create({
        userId: booking.borrower_id,
        type: "BOOKING_REJECTED",
        title: "Rental Request Declined",
        body: `${booking.lender_name || "The owner"} was unable to accept your request for ${booking.item_title}.`,
        data: { booking_id: booking.id, item_id: booking.item_id }
      });
    } else if (targetStatus === "CANCELLED") {
      const recipientId = userId === booking.lender_id ? booking.borrower_id : booking.lender_id;
      await NotificationService.create({
        userId: recipientId,
        type: "BOOKING_CANCELLED",
        title: "Booking Cancelled",
        body: `The booking for ${booking.item_title} was cancelled by ${req.user.name}.`,
        data: { booking_id: booking.id, item_id: booking.item_id }
      });
    } else if (targetStatus === "COMPLETED") {
      const recipientId = userId === booking.lender_id ? booking.borrower_id : booking.lender_id;
      await NotificationService.create({
        userId: recipientId,
        type: "BOOKING_COMPLETED",
        title: "Rental Completed! \u{1F31F}",
        body: `The rental for ${booking.item_title} has been marked complete. Don't forget to leave a review!`,
        data: { booking_id: booking.id, item_id: booking.item_id }
      });
    }
    return sendSuccess(res, updatedBooking, `Proposal updated to ${targetStatus}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
    });
    next(error);
  } finally {
    client.release();
  }
});
var bookings_routes_default = router4;

// src/modules/analytics/analytics.routes.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.get("/overview", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const pulseSql = `
      SELECT 
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(DISTINCT owner_id) FROM items)::int AS active_lenders,
        (SELECT COUNT(DISTINCT borrower_id) FROM bookings)::int AS active_borrowers,
        (SELECT COUNT(*) FROM items WHERE status = 'AVAILABLE')::int AS available_gear,
        (SELECT COUNT(*) FROM items WHERE status = 'RENTED')::int AS currently_rented_gear,
        (SELECT COUNT(*) FROM bookings)::int AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED')::int AS completed_bookings,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('ACCEPTED', 'COMPLETED'))::numeric AS total_community_volume,
        (SELECT COUNT(*) FROM requests WHERE status = 'OPEN')::int AS open_wishes,
        (SELECT COUNT(*) FROM requests WHERE status = 'FULFILLED')::int AS fulfilled_wishes
    `;
    const pulseRes = await query(pulseSql);
    const pulse = pulseRes.rows[0];
    const categoryRes = await query(`
      SELECT 
        category, 
        COUNT(*)::int AS count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate
      FROM items
      GROUP BY category
      ORDER BY count DESC
    `);
    const topLendersRes = await query(`
      SELECT 
        u.id, u.name, u.avatar_url, u.locality, u.trust_score,
        COUNT(i.id)::int AS gear_count
      FROM users u
      JOIN items i ON u.id = i.owner_id
      GROUP BY u.id
      ORDER BY gear_count DESC
      LIMIT 5
    `);
    return sendSuccess(res, {
      pulse,
      categories: categoryRes.rows,
      topLenders: topLendersRes.rows
    });
  } catch (error) {
    next(error);
  }
});
router5.get("/categories", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        category, 
        COUNT(*)::int AS item_count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate,
        (SELECT COUNT(*) FROM requests r WHERE r.category = i.category)::int AS demand_count
      FROM items i
      GROUP BY category
      ORDER BY item_count DESC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
var analytics_routes_default = router5;

// src/modules/users/users.routes.ts
var import_express6 = require("express");
var import_zod5 = require("zod");
var router6 = (0, import_express6.Router)();
var updateProfileSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(2).optional(),
  phone: import_zod5.z.string().optional(),
  locality: import_zod5.z.string().min(2).optional(),
  avatar_url: import_zod5.z.string().url().or(import_zod5.z.literal("")).optional(),
  banner_url: import_zod5.z.string().url().or(import_zod5.z.literal("")).optional(),
  bio: import_zod5.z.string().max(300).optional(),
  address_text: import_zod5.z.string().optional(),
  pincode: import_zod5.z.string().optional(),
  latitude: import_zod5.z.number().optional(),
  longitude: import_zod5.z.number().optional()
});
router6.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRes = await query(
      `SELECT id, name, locality, avatar_url, banner_url, bio, trust_score, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    if (userRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "User not found", 404);
    }
    const user = userRes.rows[0];
    const itemsRes = await query(
      `SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, status, created_at
       FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
       ORDER BY created_at DESC`,
      [id]
    );
    const statsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`,
      [id]
    );
    return sendSuccess(res, {
      ...user,
      items: itemsRes.rows,
      stats: statsRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
});
router6.put("/profile", authMiddleware, async (req, res, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const userId = req.user.id;
    const fields = [];
    const values = [];
    if (validated.name !== void 0) {
      values.push(validated.name);
      fields.push(`name = $${values.length}`);
    }
    if (validated.phone !== void 0) {
      values.push(validated.phone);
      fields.push(`phone = $${values.length}`);
    }
    if (validated.locality !== void 0) {
      values.push(validated.locality);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.avatar_url !== void 0) {
      values.push(validated.avatar_url);
      fields.push(`avatar_url = $${values.length}`);
    }
    if (validated.banner_url !== void 0) {
      values.push(validated.banner_url);
      fields.push(`banner_url = $${values.length}`);
    }
    if (validated.bio !== void 0) {
      values.push(validated.bio);
      fields.push(`bio = $${values.length}`);
    }
    if (validated.address_text !== void 0) {
      values.push(validated.address_text);
      fields.push(`address_text = $${values.length}`);
    }
    if (validated.pincode !== void 0) {
      values.push(validated.pincode);
      fields.push(`pincode = $${values.length}`);
    }
    if (validated.latitude !== void 0) {
      values.push(validated.latitude);
      fields.push(`latitude = $${values.length}`);
    }
    if (validated.longitude !== void 0) {
      values.push(validated.longitude);
      fields.push(`longitude = $${values.length}`);
    }
    if (fields.length === 0) {
      return sendError(res, "BAD_REQUEST", "No fields to update", 400);
    }
    values.push(userId);
    const updateSql = `
      UPDATE users 
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at
    `;
    const result = await query(updateSql, values);
    return sendSuccess(res, result.rows[0], "Profile updated successfully \u2728");
  } catch (error) {
    next(error);
  }
});
var users_routes_default = router6;

// src/modules/messages/messages.routes.ts
var import_express7 = require("express");
var import_zod6 = require("zod");
var router7 = (0, import_express7.Router)();
var sendMessageSchema = import_zod6.z.object({
  booking_id: import_zod6.z.string().uuid("Invalid booking ID format"),
  receiver_id: import_zod6.z.string().optional(),
  content: import_zod6.z.string().trim().min(1, "Message cannot be empty").max(2e3, "Message cannot exceed 2000 characters")
});
router7.get("/conversations", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT * FROM (
        SELECT DISTINCT ON (b.id)
          b.id AS booking_id,
          b.status AS booking_status,
          b.start_date,
          b.duration_days,
          b.total_price,
          b.created_at AS booking_created_at,
          i.id AS item_id,
          i.title AS item_title,
          i.image_urls AS item_images,
          i.locality AS item_locality,
          i.price_per_day,
          CASE WHEN b.borrower_id = $1 THEN lender.id ELSE borrower.id END AS partner_id,
          CASE WHEN b.borrower_id = $1 THEN lender.name ELSE borrower.name END AS partner_name,
          CASE WHEN b.borrower_id = $1 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
          CASE WHEN b.borrower_id = $1 THEN lender.phone ELSE borrower.phone END AS partner_phone,
          CASE WHEN b.borrower_id = $1 THEN 'Lender' ELSE 'Renter' END AS partner_role,
          m.content AS last_message,
          m.created_at AS last_message_at
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        JOIN users borrower ON b.borrower_id = borrower.id
        JOIN users lender ON b.lender_id = lender.id
        LEFT JOIN LATERAL (
          SELECT content, created_at FROM messages 
          WHERE booking_id = b.id 
          ORDER BY created_at DESC LIMIT 1
        ) m ON true
        WHERE (b.borrower_id = $1 OR b.lender_id = $1)
        ORDER BY b.id, m.created_at DESC NULLS LAST
      ) convos
      ORDER BY COALESCE(last_message_at, booking_created_at) DESC`,
      [userId]
    );
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router7.get("/:bookingId", authMiddleware, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const uuidValidation = import_zod6.z.string().uuid().safeParse(bookingId);
    if (!uuidValidation.success) {
      return sendError(res, "INVALID_BOOKING_ID", "Invalid booking ID format", 400);
    }
    const bookingCheck = await query(
      `SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (bookingCheck.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Conversation not found", 404);
    }
    const booking = bookingCheck.rows[0];
    if (booking.borrower_id !== userId && booking.lender_id !== userId) {
      return sendError(res, "FORBIDDEN", "Access denied to this conversation", 403);
    }
    const bookingRes = await query(
      `SELECT 
        b.*, 
        i.title AS item_title, 
        i.image_urls AS item_images, 
        i.price_per_day,
        i.locality AS item_locality,
        CASE WHEN b.borrower_id = $2 THEN lender.id ELSE borrower.id END AS partner_id,
        CASE WHEN b.borrower_id = $2 THEN lender.name ELSE borrower.name END AS partner_name,
        CASE WHEN b.borrower_id = $2 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
        CASE WHEN b.borrower_id = $2 THEN lender.phone ELSE borrower.phone END AS partner_phone,
        CASE WHEN b.borrower_id = $2 THEN 'Lender' ELSE 'Renter' END AS partner_role
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users borrower ON b.borrower_id = borrower.id
       JOIN users lender ON b.lender_id = lender.id
       WHERE b.id = $1`,
      [bookingId, userId]
    );
    const messagesRes = await query(
      `SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
        u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );
    return sendSuccess(res, {
      booking: bookingRes.rows[0],
      messages: messagesRes.rows
    });
  } catch (error) {
    next(error);
  }
});
router7.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = sendMessageSchema.parse(req.body);
    const senderId = req.user.id;
    const bookingRes = await query(
      `SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`,
      [validated.booking_id]
    );
    if (bookingRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Booking not found", 404);
    }
    const booking = bookingRes.rows[0];
    if (booking.borrower_id !== senderId && booking.lender_id !== senderId) {
      return sendError(res, "FORBIDDEN", "Cannot send message to this booking", 403);
    }
    const legitimateReceiverId = booking.borrower_id === senderId ? booking.lender_id : booking.borrower_id;
    const result = await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [validated.booking_id, senderId, legitimateReceiverId, validated.content]
    );
    const message = result.rows[0];
    const messageWithSender = {
      ...message,
      sender_name: req.user.name
    };
    RealtimeService.sendToUser(legitimateReceiverId, "message", messageWithSender);
    RealtimeService.sendToUser(senderId, "message", messageWithSender);
    await NotificationService.create({
      userId: legitimateReceiverId,
      type: "NEW_MESSAGE",
      title: `Message from ${req.user.name}`,
      body: validated.content.length > 80 ? `${validated.content.substring(0, 80)}...` : validated.content,
      data: {
        booking_id: booking.id,
        message_id: message.id,
        sender_id: senderId,
        sender_name: req.user.name
      }
    });
    return sendSuccess(res, messageWithSender, "Message sent");
  } catch (error) {
    next(error);
  }
});
var messages_routes_default = router7;

// src/modules/notifications/notifications.routes.ts
var import_express8 = require("express");
var import_zod7 = require("zod");
var router8 = (0, import_express8.Router)();
router8.use(authMiddleware);
var getNotificationsQuerySchema = import_zod7.z.object({
  limit: import_zod7.z.coerce.number().int().min(1).max(50).default(20),
  offset: import_zod7.z.coerce.number().int().min(0).default(0),
  unread_only: import_zod7.z.enum(["true", "false"]).optional()
});
router8.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query2 = getNotificationsQuerySchema.parse(req.query);
    const unreadOnly = query2.unread_only === "true";
    const [notifications, unreadCount] = await Promise.all([
      NotificationService.getUserNotifications(userId, {
        limit: query2.limit,
        offset: query2.offset,
        unreadOnly
      }),
      NotificationService.getUnreadCount(userId)
    ]);
    return sendSuccess(res, {
      notifications,
      unread_count: unreadCount,
      limit: query2.limit,
      offset: query2.offset
    });
  } catch (error) {
    next(error);
  }
});
router8.get("/unread-count", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await NotificationService.getUnreadCount(userId);
    return sendSuccess(res, { unread_count: count });
  } catch (error) {
    next(error);
  }
});
router8.patch("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const uuidValidation = import_zod7.z.string().uuid().safeParse(id);
    if (!uuidValidation.success) {
      return sendError(res, "INVALID_ID", "Notification ID must be a valid UUID", 400);
    }
    const checkRes = await query("SELECT user_id, read_at FROM notifications WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Notification not found", 404);
    }
    if (checkRes.rows[0].user_id !== userId) {
      return sendError(res, "FORBIDDEN", "Access denied: notification belongs to another user", 403);
    }
    const updated = await NotificationService.markAsRead(id, userId);
    return sendSuccess(res, updated || { id, read: true }, "Notification marked as read");
  } catch (error) {
    next(error);
  }
});
router8.patch("/read-all", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await NotificationService.markAllAsRead(userId);
    return sendSuccess(res, { marked_count: count, count }, "All notifications marked as read");
  } catch (error) {
    next(error);
  }
});
var notifications_routes_default = router8;

// src/modules/upload/upload.routes.ts
var import_express9 = require("express");
var import_crypto = __toESM(require("crypto"));
var import_zod8 = require("zod");

// src/config/supabase.ts
var import_supabase_js = require("@supabase/supabase-js");
var supabase = (0, import_supabase_js.createClient)(
  ENV.SUPABASE_URL || "https://placeholder.supabase.co",
  ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY || "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
var BUCKET_NAME = "item-photos";
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return true;
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) return true;
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") return true;
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return true;
  return false;
}
async function uploadItemPhoto(filePath, fileBuffer, contentType = "image/jpeg") {
  if (!ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
    throw new Error(`Unsupported image type: ${contentType}. Allowed: JPEG, PNG, WEBP, GIF.`);
  }
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(fileBuffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds 5MB limit.`);
  }
  if (!isValidImageBuffer(fileBuffer)) {
    throw new Error("Invalid image binary content.");
  }
  const sanitizedPath = filePath.replace(/\.\./g, "").replace(/^\/+/, "");
  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(sanitizedPath, fileBuffer, {
    contentType,
    upsert: true
  });
  if (error) {
    console.error("Supabase upload error:", error);
    throw error;
  }
  const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
  return publicData.publicUrl;
}

// src/modules/upload/upload.routes.ts
var router9 = (0, import_express9.Router)();
var uploadPayloadSchema = import_zod8.z.object({
  base64Data: import_zod8.z.string().min(1, "Base64 image data is required"),
  contentType: import_zod8.z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
  folder: import_zod8.z.enum(["items", "avatars", "banners"]).default("items")
});
router9.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { base64Data, contentType, folder } = uploadPayloadSchema.parse(req.body);
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9-+.]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      return sendError(res, "PAYLOAD_TOO_LARGE", "Uploaded image cannot exceed 5MB", 413);
    }
    const extMap = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif"
    };
    const ext = extMap[contentType] || "jpg";
    const uniqueName = `${import_crypto.default.randomUUID()}.${ext}`;
    const filePath = `${folder}/${uniqueName}`;
    const publicUrl = await uploadItemPhoto(filePath, buffer, contentType);
    return sendSuccess(res, { url: publicUrl, path: filePath }, "Image uploaded successfully", 201);
  } catch (err) {
    if (err.message?.includes("Invalid image binary content") || err.message?.includes("Unsupported image type")) {
      return sendError(res, "INVALID_FILE", err.message, 400);
    }
    next(err);
  }
});
var upload_routes_default = router9;

// src/modules/push/push.routes.ts
var import_express10 = require("express");
var import_zod9 = require("zod");
var router10 = (0, import_express10.Router)();
var subscribeSchema = import_zod9.z.object({
  subscription: import_zod9.z.object({
    endpoint: import_zod9.z.string().url("Invalid push endpoint URL"),
    keys: import_zod9.z.object({
      p256dh: import_zod9.z.string().min(1, "p256dh key is required"),
      auth: import_zod9.z.string().min(1, "auth secret is required")
    })
  })
});
var unsubscribeSchema = import_zod9.z.object({
  endpoint: import_zod9.z.string().url("Invalid push endpoint URL")
});
router10.get("/vapid-public-key", (req, res) => {
  return sendSuccess(res, { publicKey: ENV.VAPID_PUBLIC_KEY });
});
router10.post("/subscribe", authMiddleware, async (req, res, next) => {
  try {
    const { subscription } = subscribeSchema.parse(req.body);
    const userId = req.user.id;
    await PushService.saveSubscription(userId, subscription);
    return sendSuccess(res, { subscribed: true }, "Push notifications registered successfully");
  } catch (error) {
    next(error);
  }
});
router10.post("/unsubscribe", authMiddleware, async (req, res, next) => {
  try {
    const { endpoint } = unsubscribeSchema.parse(req.body);
    const userId = req.user.id;
    await PushService.removeSubscription(userId, endpoint);
    return sendSuccess(res, { subscribed: false }, "Push notifications unregistered successfully");
  } catch (error) {
    next(error);
  }
});
var push_routes_default = router10;

// src/modules/realtime/realtime.routes.ts
var import_express11 = require("express");
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"));
var import_app3 = require("firebase-admin/app");
var import_auth13 = require("firebase-admin/auth");
var router11 = (0, import_express11.Router)();
async function authenticateSseRequest(req) {
  let token = "";
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }
  if (!token) return null;
  try {
    const decoded = import_jsonwebtoken3.default.verify(token, ENV.JWT_SECRET);
    if (decoded && decoded.id) {
      const userRes = await query("SELECT id, name FROM users WHERE id = $1", [decoded.id]);
      if (userRes.rows.length > 0) {
        return { id: userRes.rows[0].id, name: userRes.rows[0].name };
      }
    }
  } catch {
  }
  if (ENV.FIREBASE_PROJECT_ID && (0, import_app3.getApps)().length > 0) {
    try {
      const decodedFb = await (0, import_auth13.getAuth)().verifyIdToken(token);
      if (decodedFb && decodedFb.uid) {
        const userRes = await query(
          "SELECT id, name FROM users WHERE firebase_uid = $1 OR id = $1",
          [decodedFb.uid]
        );
        if (userRes.rows.length > 0) {
          return { id: userRes.rows[0].id, name: userRes.rows[0].name };
        }
      }
    } catch {
    }
  }
  return null;
}
router11.get("/stream", async (req, res) => {
  const user = await authenticateSseRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: "Unauthorized: Valid token required for real-time stream" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();
  RealtimeService.addClient(user.id, res);
});
var realtime_routes_default = router11;

// src/middleware/error.ts
var import_zod10 = require("zod");
var errorHandler = (err, req, res, next) => {
  if (err instanceof import_zod10.ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message
    }));
    return sendError(res, "VALIDATION_ERROR", "Input validation failed", 400, details);
  }
  console.error("Unhandled Server Error:", err);
  return sendError(
    res,
    "INTERNAL_SERVER_ERROR",
    err.message || "An unexpected internal error occurred",
    500
  );
};

// src/app.ts
var createApp = () => {
  const app2 = (0, import_express12.default)();
  const allowedOrigins = [
    ENV.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ].filter(Boolean);
  app2.use(
    (0, import_cors.default)({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ENV.NODE_ENV !== "production" || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true
    })
  );
  app2.use(import_express12.default.json({ limit: "10mb" }));
  app2.use(import_express12.default.urlencoded({ extended: true }));
  app2.get(["/api/health", "/health"], async (req, res) => {
    let dbStatus = "disconnected";
    try {
      await query("SELECT 1");
      dbStatus = "connected";
    } catch (err) {
      dbStatus = `error: ${err.message}`;
    }
    return sendSuccess(res, {
      status: "healthy",
      app: "Rentu\u207A Headless REST API",
      version: "1.0.0",
      database: dbStatus,
      supabase: {
        configured: Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY),
        url: ENV.SUPABASE_URL || "not_configured"
      },
      firebase: {
        configured: Boolean(ENV.FIREBASE_PROJECT_ID),
        projectId: ENV.FIREBASE_PROJECT_ID
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.use(["/api/auth", "/auth"], auth_routes_default);
  app2.use(["/api/items", "/items"], items_routes_default);
  app2.use(["/api/requests", "/requests"], requests_routes_default);
  app2.use(["/api/bookings", "/bookings"], bookings_routes_default);
  app2.use(["/api/analytics", "/analytics"], analytics_routes_default);
  app2.use(["/api/users", "/users"], users_routes_default);
  app2.use(["/api/messages", "/messages"], messages_routes_default);
  app2.use(["/api/notifications", "/notifications"], notifications_routes_default);
  app2.use(["/api/upload", "/upload"], upload_routes_default);
  app2.use(["/api/push", "/push"], push_routes_default);
  app2.use(["/api/realtime", "/realtime"], realtime_routes_default);
  app2.use((req, res) => {
    return sendError(res, "ROUTE_NOT_FOUND", `Cannot ${req.method} ${req.originalUrl}`, 404);
  });
  app2.use(errorHandler);
  return app2;
};

// src/db/migrate.ts
var runMigrations = async () => {
  console.log("Running database migrations (Supabase Compatible)...");
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`).catch(() => {
    });
    await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis";`).catch(() => {
      console.log("PostGIS extension not available locally; using Haversine proximity formulas.");
    });
    await client.query("BEGIN");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
          CREATE TYPE item_status AS ENUM ('AVAILABLE', 'RENTED', 'UNAVAILABLE');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
          CREATE TYPE request_status AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
          CREATE TYPE booking_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        phone VARCHAR(20),
        bio TEXT DEFAULT 'Creator & Gear Sharer',
        avatar_url TEXT,
        address_text TEXT,
        locality VARCHAR(120),
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        rating NUMERIC(3, 2) DEFAULT 5.00,
        trust_score INT DEFAULT 98,
        role user_role DEFAULT 'USER',
        clerk_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS address_text TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_locality ON users(locality);
      CREATE INDEX IF NOT EXISTS idx_users_coords ON users(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id TEXT NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(60) NOT NULL,
        price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day >= 0),
        max_duration_days INTEGER DEFAULT 3 CHECK (max_duration_days > 0),
        image_urls JSONB DEFAULT '[]'::JSONB,
        sticker_badge VARCHAR(50) DEFAULT '\u2728 Weekend Flex',
        locality VARCHAR(120),
        address_text TEXT DEFAULT 'South Delhi',
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION DEFAULT 28.5355,
        longitude DOUBLE PRECISION DEFAULT 77.2167,
        status item_status DEFAULT 'AVAILABLE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE items ADD COLUMN IF NOT EXISTS address_text TEXT DEFAULT 'South Delhi';
      ALTER TABLE items ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE items ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 28.5355;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 77.2167;

      CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_coords ON items(latitude, longitude);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seeker_id TEXT NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(60),
        start_date DATE NOT NULL,
        start_time TIME,
        duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days > 0),
        offered_amount NUMERIC(10, 2) NOT NULL CHECK (offered_amount >= 0),
        locality VARCHAR(120),
        address_text TEXT DEFAULT 'South Delhi',
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION DEFAULT 28.5355,
        longitude DOUBLE PRECISION DEFAULT 77.2167,
        status request_status DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE requests ADD COLUMN IF NOT EXISTS address_text TEXT DEFAULT 'South Delhi';
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 28.5355;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 77.2167;

      CREATE INDEX IF NOT EXISTS idx_requests_seeker ON requests(seeker_id);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
      CREATE INDEX IF NOT EXISTS idx_requests_coords ON requests(latitude, longitude);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
        borrower_id TEXT NOT NULL,
        lender_id TEXT NOT NULL,
        start_date DATE NOT NULL,
        start_time TIME,
        duration_days INTEGER NOT NULL CHECK (duration_days > 0),
        total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
        status booking_status DEFAULT 'PENDING',
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_borrower ON bookings(borrower_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_lender ON bookings(lender_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(60) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSONB DEFAULT '{}'::jsonb,
        read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
    `);
    await client.query("COMMIT");
    console.log("Database migrations completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
};
if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}

// src/server.ts
var app = createApp();
var startServer = async () => {
  try {
    await runMigrations().catch((err) => {
      console.warn("Migrations notice on startup:", err.message);
    });
    const server = app.listen(ENV.PORT, "0.0.0.0", () => {
      console.log(`\u26A1 Rentu\u207A API Service listening on http://localhost:${ENV.PORT} (0.0.0.0)`);
      console.log(`\u{1F331} Environment: ${ENV.NODE_ENV}`);
      console.log(`\u{1F4E1} Ready for rental requests!`);
    });
    const shutdown = () => {
      console.log("\nShutting down Rentu\u207A API server gracefully...");
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};
if (require.main === module && !process.env.VERCEL) {
  startServer();
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = app;
  module.exports.default = app;
  module.exports.app = app;
}
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
