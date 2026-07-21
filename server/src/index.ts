import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { buildNutritionSummary } from "../../lib/services/nutritionStructure";
import { calculateDailyCalorieTarget } from "../../lib/services/calorieTargets";
import { getEpicurePairings } from "../../lib/services/epicureService";
import { applyRecipeCalorieEstimates } from "../../lib/services/recipeCalories";

// Load .env file manually if it exists to support local development without extra dependencies
if (existsSync(".env")) {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] ??= value;
    }
  }
}

type Json = Record<string, unknown>;
type RecordRow = { record_type: string; record_id: string; record_date: string | null; data_json: string; created_at: string; updated_at: string };
type User = { id: string; email: string; subscribed: boolean };

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL ?? "file:./daily-health-cloud.db";
const databaseAuthToken = process.env.DATABASE_AUTH_TOKEN;
const jwtSecretText = process.env.AUTH_JWT_SECRET ?? "daily-health-default-secret-at-least-32-chars";
const allowedOriginsString = process.env.ALLOWED_ORIGINS ?? "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081";
const allowedOrigins = new Set(allowedOriginsString.split(",").map((v) => v.trim()).filter(Boolean));
const demoSubscribedEmails = new Set((process.env.DEMO_SUBSCRIBED_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
const db = createClient({ url: databaseUrl, authToken: databaseAuthToken || undefined });

function now() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}_${randomUUID()}`; }
function secret() {
  if (jwtSecretText.length < 32) throw new Error("AUTH_JWT_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(jwtSecretText);
}
function asObject(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function asText(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function asNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function parseRow<T>(row: RecordRow | undefined): T | null { if (!row) return null; try { return JSON.parse(row.data_json) as T; } catch { return null; } }
function isoDate(value: unknown) { const text = asText(value); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; }

async function setup() {
  await db.batch([
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, subscribed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS health_records (owner_id TEXT NOT NULL, record_type TEXT NOT NULL, record_id TEXT NOT NULL, record_date TEXT, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (owner_id, record_type, record_id))",
    "CREATE TABLE IF NOT EXISTS error_logs (id TEXT PRIMARY KEY, owner_id TEXT, source TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, data_json TEXT, created_at TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS health_records_owner_type_date ON health_records(owner_id, record_type, record_date)",
    "CREATE INDEX IF NOT EXISTS health_records_owner_type_updated ON health_records(owner_id, record_type, updated_at)"
  ]);
}

async function readBody(request: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const next = Buffer.from(chunk);
    total += next.length;
    if (total > 10 * 1024 * 1024) throw new HttpError(413, "Request body is too large.");
    chunks.push(next);
  }
  if (!chunks.length) return {};
  try { return asObject(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { throw new HttpError(400, "Invalid JSON request body."); }
}

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function originHeaders(request: IncomingMessage) {
  const origin = request.headers.origin;
  if (!origin) return {};
  // If the origin is in our allowed list, reflect it back.
  // This is required for browsers to allow the cross-origin request.
  if (allowedOrigins.has(origin)) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type, accept",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-allow-credentials": "true",
      "vary": "Origin"
    };
  }
  return { "vary": "Origin" };
}
function send(response: ServerResponse, request: IncomingMessage, status: number, data: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...originHeaders(request) });
  response.end(JSON.stringify(data));
}
async function tokenFor(user: User) {
  return new SignJWT({ email: user.email, subscribed: user.subscribed }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("30d").sign(secret());
}
async function authenticatedUser(request: IncomingMessage): Promise<User> {
  const value = request.headers.authorization;

  // Development bypass: Accept the hardcoded dev-token-bypass from the client
  if (process.env.NODE_ENV !== "production" && value === "Bearer dev-token-bypass") {
    return { id: "dev-user-id", email: "dev@example.com", subscribed: true };
  }

  if (!value?.startsWith("Bearer ")) throw new HttpError(401, "Sign in is required.");
  try {
    const verified = await jwtVerify(value.slice(7), secret());
    const userId = verified.payload.sub;
    if (!userId) throw new Error("no subject");
    const result = await db.execute({ sql: "SELECT id, email, subscribed FROM users WHERE id = ? LIMIT 1", args: [userId] });
    const row = result.rows[0] as unknown as { id: string; email: string; subscribed: number } | undefined;
    if (!row) throw new Error("not found");
    return { id: row.id, email: row.email, subscribed: Boolean(row.subscribed) };
  } catch { throw new HttpError(401, "Your session has expired. Please sign in again."); }
}
async function getRecord<T>(ownerId: string, type: string, recordId: string) {
  const result = await db.execute({ sql: "SELECT record_type, record_id, record_date, data_json, created_at, updated_at FROM health_records WHERE owner_id = ? AND record_type = ? AND record_id = ? LIMIT 1", args: [ownerId, type, recordId] });
  return { row: result.rows[0] as unknown as RecordRow | undefined, data: parseRow<T>(result.rows[0] as unknown as RecordRow | undefined) };
}
async function listRecords<T>(ownerId: string, type: string, date?: string) {
  const result = date
    ? await db.execute({ sql: "SELECT record_type, record_id, record_date, data_json, created_at, updated_at FROM health_records WHERE owner_id = ? AND record_type = ? AND record_date = ? ORDER BY created_at ASC", args: [ownerId, type, date] })
    : await db.execute({ sql: "SELECT record_type, record_id, record_date, data_json, created_at, updated_at FROM health_records WHERE owner_id = ? AND record_type = ? ORDER BY created_at DESC", args: [ownerId, type] });
  return result.rows.flatMap((item) => { const data = parseRow<T>(item as unknown as RecordRow); return data === null ? [] : [data]; });
}
async function putRecord<T>(ownerId: string, type: string, recordId: string, data: T, recordDate: string | null, createdAt = now()) {
  const updatedAt = now();
  await db.execute({
    sql: "INSERT INTO health_records (owner_id, record_type, record_id, record_date, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, record_type, record_id) DO UPDATE SET record_date = excluded.record_date, data_json = excluded.data_json, updated_at = excluded.updated_at",
    args: [ownerId, type, recordId, recordDate, JSON.stringify(data), createdAt, updatedAt]
  });
  return { createdAt, updatedAt };
}
async function deleteRecord(ownerId: string, type: string, recordId: string) {
  const result = await db.execute({ sql: "DELETE FROM health_records WHERE owner_id = ? AND record_type = ? AND record_id = ?", args: [ownerId, type, recordId] });
  return result.rowsAffected > 0;
}
async function ensureProfile(user: User) {
  const profileResult = await getRecord<Json>(user.id, "profile", user.id);
  const settingsResult = await getRecord<Json>(user.id, "settings", user.id);
  const createdAt = now();
  const profile = profileResult.data ?? { id: user.id, displayName: null, gender: null, birthYear: null, heightCm: null, weightKg: null, activityLevel: "sedentary", calorieGoal: "maintain", dailyCalorieTarget: null, createdAt, updatedAt: createdAt };
  const settings = settingsResult.data ?? { locale: "en", theme: "light", defaultWaterTargetMl: 2000 };
  if (!profileResult.data) await putRecord(user.id, "profile", user.id, profile, null, createdAt);
  if (!settingsResult.data) await putRecord(user.id, "settings", user.id, settings, null, createdAt);
  return { profile, settings };
}
function requireDate(value: unknown) { const date = isoDate(value); if (!date) throw new HttpError(400, "A YYYY-MM-DD date is required."); return date; }
async function water(user: User, date: string) {
  const { settings } = await ensureProfile(user);
  const entries = await listRecords<Json>(user.id, "water-entry", date);
  const target = await getRecord<Json>(user.id, "water-target", date);
  const normalized = entries.map((entry) => ({ id: asText(entry.id), amountMl: asNumber(entry.amountMl) ?? 0, createdAt: asText(entry.createdAt) })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { date, entries: normalized, totalMl: normalized.reduce((sum, entry) => sum + entry.amountMl, 0), targetMl: asNumber(target.data?.targetMl) ?? asNumber(settings.defaultWaterTargetMl) ?? 2000 };
}
function fallbackRecipes(userId: string, scan: Json, locale: string) {
  const ingredients = Array.isArray(scan.ingredients) ? scan.ingredients.map(asObject).slice(0, 8) : [];
  const names = ingredients.map((item) => asText(locale === "zh-CN" ? item.displayNameZh : item.displayNameEn) || asText(item.normalizedName)).filter(Boolean);
  const joined = names.slice(0, 3).join(locale === "zh-CN" ? "、" : ", ") || (locale === "zh-CN" ? "家常食材" : "Simple ingredients");
  const variants = locale === "zh-CN" ? ["快手热炒", "清爽汤品", "暖心盖饭"] : ["Quick Stir-Fry", "Light Soup", "Warm Bowl"];
  return variants.map((title, index) => {
    const createdAt = now(); const recipeId = id("recipe");
    return { id: recipeId, profileId: userId, sourceScanId: asText(scan.id) || null, cuisineStyle: "Home style", difficulty: index === 2 ? "medium" : "easy", referenceImageQuery: `${joined} ${title}`.slice(0, 120), referenceImage: null, estimatedCookingMinutes: [20, 30, 25][index], servings: 2, estimatedCaloriesPerServing: null, estimatedProteinGramsPerServing: null, estimatedCarbsGramsPerServing: null, estimatedFatGramsPerServing: null, isFavorite: false, createdAt, updatedAt: createdAt, translations: [{ locale: "en", title: `${names.join(" & ") || "Simple ingredients"} ${["Stir-Fry", "Soup", "Bowl"][index]}`, shortDescription: "A practical meal using the confirmed ingredients.", nutritionDisclaimer: "Nutrition is an everyday estimate." }, { locale: "zh-CN", title: `${joined}${title}`, shortDescription: "使用已确认食材制作的实用家常料理。", nutritionDisclaimer: "营养数据仅供日常参考。" }], ingredients: ingredients.map((item, position) => ({ id: id("ingredient"), position, normalizedName: asText(item.normalizedName), nameEn: asText(item.displayNameEn), nameZh: asText(item.displayNameZh), amount: asText(item.estimatedAmount) || "as available", isRecognizedIngredient: true, isOptional: false })), steps: [{ id: id("step"), stepNumber: 1, estimatedMinutes: 5, instructionEn: "Prepare the ingredients in bite-size pieces.", instructionZh: "把食材处理成方便入口的小块。" }, { id: id("step"), stepNumber: 2, estimatedMinutes: 15, instructionEn: "Cook over medium heat until tender and serve warm.", instructionZh: "中火烹煮至熟软后趁热享用。" }], tips: [{ id: id("tip"), position: 0, contentEn: "Adjust seasoning for your actual ingredients.", contentZh: "请根据实际食材调整调味。" }], missingIngredients: [] };
  });
}
async function cloudAnalyze(user: User, input: Json) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, "Cloud AI is not configured.");
  const dataUrl = asText(input.imageDataUrl);
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new HttpError(400, "A supported image data URL is required.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ generationConfig: { responseMimeType: "application/json", temperature: 0.2 }, contents: [{ parts: [{ text: "Analyze visible food and ingredients only. Return JSON with overallConfidence, uncertaintyNoteEn, uncertaintyNoteZh, ingredients. Every ingredient must include normalizedName, displayNameEn, displayNameZh, estimatedAmount, estimatedCalories, confidence, notes." }, { inlineData: { mimeType: match[1], data: match[2].replace(/\s/g, "") } }] }] }) });
  if (!response.ok) throw new HttpError(502, "Cloud AI could not analyze this image.");
  const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = result.candidates?.[0]?.content?.parts?.map((item) => item.text ?? "").join("") ?? "";
  let output: Json; try { output = asObject(JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""))); } catch { throw new HttpError(502, "Cloud AI returned an invalid recognition result."); }
  const createdAt = now();
  const ingredients = Array.isArray(output.ingredients) ? output.ingredients.map(asObject).filter((item) => asText(item.normalizedName) && asText(item.displayNameEn) && asText(item.displayNameZh)).map((item, position) => ({ id: id("ingredient"), position, normalizedName: asText(item.normalizedName), displayNameEn: asText(item.displayNameEn), displayNameZh: asText(item.displayNameZh), estimatedAmount: asText(item.estimatedAmount) || "as available", estimatedCalories: asNumber(item.estimatedCalories), confidence: ["high", "medium", "low"].includes(asText(item.confidence)) ? asText(item.confidence) : "medium", notes: asText(item.notes) })) : [];
  const scan = { id: id("scan"), imageName: asText(input.imageName) || "scan.jpg", imageMimeType: asText(input.imageMimeType) || match[1], overallConfidence: ["high", "medium", "low"].includes(asText(output.overallConfidence)) ? asText(output.overallConfidence) : "medium", uncertaintyNoteEn: asText(output.uncertaintyNoteEn) || "Confirm the ingredient list before using it.", uncertaintyNoteZh: asText(output.uncertaintyNoteZh) || "使用前请确认食材清单。", confirmedAt: null, createdAt, ingredients };
  await putRecord(user.id, "ingredient-scan", scan.id, scan, createdAt.slice(0, 10), createdAt);
  return scan;
}

async function cloudGenerateRecipes(user: User, input: Json) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, "Cloud AI is not configured.");

  let sourceIngredients: any[] = [];
  let sourceScanId: string | null = null;

  if (input.scanId) {
    const scan = await getRecord<Json>(user.id, "ingredient-scan", asText(input.scanId));
    if (scan.data) {
      sourceIngredients = Array.isArray(scan.data.ingredients) ? scan.data.ingredients : [];
      sourceScanId = scan.data.id as string;
    }
  } else if (input.sourceRecipeId) {
    const recipe = await getRecord<Json>(user.id, "recipe", asText(input.sourceRecipeId));
    if (recipe.data) {
      sourceIngredients = Array.isArray(recipe.data.ingredients) ? recipe.data.ingredients.map((i: any) => ({
        normalizedName: i.normalizedName,
        displayNameEn: i.nameEn,
        displayNameZh: i.nameZh,
        estimatedAmount: i.amount,
        confidence: "high"
      })) : [];
    }
  } else if (Array.isArray(input.manualIngredients)) {
    sourceIngredients = input.manualIngredients.map(name => ({ normalizedName: name, displayNameEn: name, displayNameZh: name, estimatedAmount: "as available", confidence: "high" }));
  }

  const epicure = await getEpicurePairings({
    ingredients: sourceIngredients,
    preferences: input.preferences as any
  });

  const ingredientText = sourceIngredients.map((i: any) => `${i.displayNameEn} (${i.normalizedName}) - ${i.estimatedAmount}`).join("\n");
  const pairingText = epicure.pairings.map((p: any) => `${p.sourceIngredient} + ${p.suggestedIngredient}: ${p.reasonEn}`).join("\n");

  const prompt = [
    "Generate exactly 3 practical home-cooking recipes using these ingredients:",
    ingredientText,
    "Flavor pairings:",
    pairingText,
    "Preferences:",
    JSON.stringify(input.preferences ?? {}),
    "Return JSON only: { recipes: [{ cuisineStyle, difficulty, estimatedCookingMinutes, servings, translations: [{ locale: 'en', title, shortDescription, nutritionDisclaimer }, { locale: 'zh-CN', title, shortDescription, nutritionDisclaimer }], ingredients: [{ normalizedName, nameEn, nameZh, amount, isRecognizedIngredient, isOptional }], steps: [{ stepNumber, instructionEn, instructionZh }], tips: [{ contentEn, contentZh }], missingIngredients: [{ normalizedName, nameEn, nameZh, isOptional }] }] }",
    "Each recipe must be different. Provide detailed steps and tips."
  ].join("\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) throw new HttpError(502, "Cloud AI could not generate recipes.");
  const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = result.candidates?.[0]?.content?.parts?.map((item) => item.text ?? "").join("") ?? "";

  let output: any;
  try {
    output = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new HttpError(502, "Cloud AI returned an invalid recipe result.");
  }

  const generatedRecipes = await applyRecipeCalorieEstimates({
    recipes: output.recipes,
    sourceIngredients,
    pairings: epicure.pairings
  });

  const recipes = generatedRecipes.map((recipe: any) => {
    const recipeId = id("recipe");
    const createdAt = now();
    return {
      ...recipe,
      id: recipeId,
      profileId: user.id,
      sourceScanId,
      createdAt,
      updatedAt: createdAt,
      ingredients: (recipe.ingredients ?? []).map((ing: any, pos: number) => ({ ...ing, id: id("ing"), position: pos })),
      steps: (recipe.steps ?? []).map((step: any) => ({ ...step, id: id("step") })),
      tips: (recipe.tips ?? []).map((tip: any, pos: number) => ({ ...tip, id: id("tip"), position: pos })),
      missingIngredients: (recipe.missingIngredients ?? []).map((msg: any) => ({ ...msg, id: id("msg") }))
    };
  });

  await Promise.all(recipes.map((recipe: any) => putRecord(user.id, "recipe", recipe.id, recipe, recipe.createdAt.slice(0, 10), recipe.createdAt)));
  return recipes;
}

async function api(request: IncomingMessage, response: ServerResponse, url: URL, user: User, body: Json) {
  const path = url.pathname; const method = request.method ?? "GET";
  if (path === "/api/profile") { const current = await ensureProfile(user); if (method === "POST") return send(response, request, 200, current); if (method === "GET") return send(response, request, 200, { profile: current.profile }); if (method === "PATCH") { const profile = { ...current.profile, ...body, id: user.id, updatedAt: now(), createdAt: asText(current.profile.createdAt) || now() }; await putRecord(user.id, "profile", user.id, profile, null, profile.createdAt); return send(response, request, 200, { profile }); } }
  if (path === "/api/service-status" && method === "GET") {
    const items = [
      { id: "app", state: "ok", titleEn: "API Server", titleZh: "接口服务器", summaryEn: "Node.js runtime", summaryZh: "Node.js 运行环境", detailsEn: [`Port ${port}`], detailsZh: [`端口 ${port}`] },
      { id: "database", state: "ok", titleEn: "Database", titleZh: "数据库", summaryEn: databaseUrl.startsWith("file:") ? "SQLite" : "libSQL", summaryZh: databaseUrl.startsWith("file:") ? "SQLite" : "libSQL", detailsEn: [databaseUrl], detailsZh: [databaseUrl] },
      { id: "ai", state: process.env.GEMINI_API_KEY ? "ok" : "warning", titleEn: "Google Gemini", titleZh: "Google Gemini", summaryEn: "AI recognition & recipes", summaryZh: "AI 识别与菜谱", detailsEn: [process.env.GEMINI_API_KEY ? "Configured" : "Not configured"], detailsZh: [process.env.GEMINI_API_KEY ? "已配置" : "未配置"] },
      { id: "epicure", state: "ok", titleEn: "Epicure Flavor", titleZh: "Epicure 风味", summaryEn: "MCP service", summaryZh: "MCP 服务", detailsEn: ["Connected"], detailsZh: ["已连接"] }
    ];
    return send(response, request, 200, { overall: items.every(i => i.state === "ok") ? "ok" : "warning", checkedAt: now(), items });
  }
  if (path === "/api/error-logs" && method === "GET") {
    const limit = Number(url.searchParams.get("limit") ?? 10);
    const result = await db.execute({ sql: "SELECT id, source, severity, message, data_json, created_at FROM error_logs WHERE owner_id = ? OR owner_id IS NULL ORDER BY created_at DESC LIMIT ?", args: [user.id, limit] });
    return send(response, request, 200, { logs: result.rows });
  }
  if (path === "/api/log-error" && method === "POST") {
    const logId = id("err");
    await db.execute({
      sql: "INSERT INTO error_logs (id, owner_id, source, severity, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [logId, user.id, asText(body.source) || "client", asText(body.severity) || "error", asText(body.message), JSON.stringify(body.data ?? {}), now()]
    });
    return send(response, request, 201, { id: logId });
  }
  if (path === "/api/settings") { const current = await ensureProfile(user); if (method === "GET") return send(response, request, 200, { settings: current.settings }); if (method === "PATCH") { const settings = { ...current.settings, ...(body.locale === "en" || body.locale === "zh-CN" ? { locale: body.locale } : {}), ...(body.theme === "light" || body.theme === "dark" || body.theme === "system" ? { theme: body.theme } : {}), ...(asNumber(body.defaultWaterTargetMl) ? { defaultWaterTargetMl: Math.max(250, Math.round(asNumber(body.defaultWaterTargetMl) ?? 2000)) } : {}) }; await putRecord(user.id, "settings", user.id, settings, null); return send(response, request, 200, { settings }); } }
  if (path === "/api/ai-settings") { const configured = Boolean(process.env.GEMINI_API_KEY); const aiSettings = { provider: "gemini", model: "gemini-3.1-flash-lite", configured, profileKeyConfigured: false, environmentKeyConfigured: configured, providers: { gemini: { configured, profileKeyConfigured: false }, openai: { configured: false, profileKeyConfigured: false } } }; return send(response, request, 200, { aiSettings }); }
  if (path === "/api/analyze-ingredients" && method === "POST") return send(response, request, 201, { scan: await cloudAnalyze(user, body) });
  if (path === "/api/estimate-nutrition" && method === "POST") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new HttpError(503, "Cloud AI is not configured.");
    const name = asText(body.nameEn) || asText(body.nameZh);
    if (!name) throw new HttpError(400, "A food name is required for estimation.");
    const prompt = `Estimate nutrition for "${name}". Return JSON only: { calories, proteinGrams, carbsGrams, fatGrams, confidence, notesEn, notesZh }. Values should be numbers or null.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    if (!response.ok) throw new HttpError(502, "Cloud AI could not estimate nutrition.");
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = result.candidates?.[0]?.content?.parts?.map((item) => item.text ?? "").join("") ?? "";
    try {
      const estimate = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      return send(response, request, 200, { estimate });
    } catch {
      throw new HttpError(502, "Cloud AI returned an invalid estimation result.");
    }
  }
  if (path === "/api/ingredient-scans" && method === "GET") return send(response, request, 200, { scans: await listRecords<Json>(user.id, "ingredient-scan") });
  const scanMatch = path.match(/^\/api\/ingredient-scans\/([^/]+)$/); if (scanMatch && method === "PATCH") { const record = await getRecord<Json>(user.id, "ingredient-scan", decodeURIComponent(scanMatch[1])); if (!record.data) throw new HttpError(404, "Ingredient scan not found."); const ingredients = Array.isArray(body.ingredients) ? body.ingredients.map(asObject).map((item, position) => ({ ...item, id: asText(item.id) || id("ingredient"), position })) : record.data.ingredients; const scan: Json = { ...record.data, ingredients, confirmedAt: body.confirmed ? now() : null }; await putRecord(user.id, "ingredient-scan", asText(scan.id), scan, asText(scan.createdAt).slice(0, 10), record.row?.created_at); return send(response, request, 200, { scan }); }
  if (path === "/api/recipes" && method === "GET") {
    const recipes = await listRecords<Json>(user.id, "recipe");
    const favoritesOnly = url.searchParams.get("favorites") === "1";
    return send(response, request, 200, { recipes: favoritesOnly ? recipes.filter((r) => r.isFavorite) : recipes });
  }
  const recipeMatch = path.match(/^\/api\/recipes\/([^/]+)$/);
  if (recipeMatch && method === "PATCH") {
    const record = await getRecord<Json>(user.id, "recipe", decodeURIComponent(recipeMatch[1]));
    if (!record.data) throw new HttpError(404, "Recipe not found.");
    const updated = { ...record.data, ...body, id: record.data.id, updatedAt: now() };
    await putRecord(user.id, "recipe", asText(updated.id), updated, asText(updated.createdAt).slice(0, 10), record.row?.created_at);
    return send(response, request, 200, { recipe: updated });
  }
  if (path === "/api/generate-recipes" && method === "POST") {
    try {
      const recipes = await cloudGenerateRecipes(user, body);
      return send(response, request, 201, { recipes });
    } catch (error) {
      // Fallback to simpler generator if Gemini fails or is not configured
      const scanId = asText(body.scanId);
      const scan = scanId ? await getRecord<Json>(user.id, "ingredient-scan", scanId) : { data: null };
      const recipes = fallbackRecipes(user.id, scan.data || {}, asText(body.locale) || "en");
      await Promise.all(recipes.map((recipe) => putRecord(user.id, "recipe", asText(recipe.id), recipe, asText(recipe.createdAt).slice(0, 10), asText(recipe.createdAt))));
      return send(response, request, 201, { recipes });
    }
  }
  if (path === "/api/water") { const date = method === "GET" ? requireDate(url.searchParams.get("date")) : requireDate(body.date); if (method === "GET") return send(response, request, 200, { water: await water(user, date) }); if (method === "POST") { const amountMl = Math.round(asNumber(body.amountMl) ?? 0); if (amountMl <= 0 || amountMl > 5000) throw new HttpError(400, "Enter a valid water amount."); const createdAt = now(); const entry = { id: id("water"), amountMl, createdAt }; await putRecord(user.id, "water-entry", entry.id, entry, date, createdAt); return send(response, request, 201, { water: await water(user, date) }); } if (method === "PATCH") { const targetMl = Math.round(asNumber(body.targetMl) ?? 0); if (targetMl < 250 || targetMl > 20000) throw new HttpError(400, "Enter a valid water target."); await putRecord(user.id, "water-target", date, { targetMl }, date); return send(response, request, 200, { water: await water(user, date) }); } if (method === "DELETE") { await db.execute({ sql: "DELETE FROM health_records WHERE owner_id = ? AND record_type = 'water-entry' AND record_date = ?", args: [user.id, date] }); return send(response, request, 200, { water: await water(user, date) }); } }
  if (path === "/api/food-logs") {
    const date = method === "GET" ? requireDate(url.searchParams.get("date")) : requireDate(body.date);
    if (method === "DELETE") {
      await deleteRecord(user.id, "food-log", asText(body.id));
      const logs = await listRecords<FoodLogView>(user.id, "food-log", date);
      const total = logs.reduce((sum, item) => sum + (item.calories ?? 0), 0);
      return send(response, request, 200, { deleted: true, total });
    }
    const previous = method === "PATCH" ? await getRecord<Json>(user.id, "food-log", asText(body.id)) : null;
    if (["POST", "PATCH"].includes(method)) {
      const createdAt = asText(previous?.data?.createdAt) || now();
      const log = { ...body, id: asText(body.id) || id("food"), recipeId: body.recipeId ?? null, date, nameEn: asText(body.nameEn), nameZh: asText(body.nameZh) || null, notes: asText(body.notes) || null, createdAt, updatedAt: now() };
      if (!log.nameEn) throw new HttpError(400, "Enter a food name.");
      await putRecord(user.id, "food-log", log.id, log, date, createdAt);
    }
    const logs = await listRecords<FoodLogView>(user.id, "food-log", date);
    const total = logs.reduce((sum, item) => sum + (item.calories ?? 0), 0);
    const nutritionSummary = buildNutritionSummary(logs, total);
    const { profile } = await ensureProfile(user);
    const calorieTarget = calculateDailyCalorieTarget(profile as UserProfileView).targetCalories;
    return send(response, request, method === "POST" ? 201 : 200, { logs, total, nutritionSummary, calorieTarget });
  }
  if (path === "/api/exercise") { const date = method === "GET" ? requireDate(url.searchParams.get("date")) : requireDate(body.date); if (method === "GET") return send(response, request, 200, { logs: await listRecords<Json>(user.id, "exercise", date) }); if (method === "DELETE") return send(response, request, 200, { deleted: await deleteRecord(user.id, "exercise", asText(body.id)) }); const previous = method === "PATCH" ? await getRecord<Json>(user.id, "exercise", asText(body.id)) : null; const createdAt = asText(previous?.data?.createdAt) || now(); const log = { ...body, id: asText(body.id) || id("exercise"), date, type: asText(body.type), durationMinutes: Math.round(asNumber(body.durationMinutes) ?? 0), estimatedCaloriesBurned: asNumber(body.estimatedCaloriesBurned), notes: asText(body.notes) || null, createdAt, updatedAt: now() }; if (!log.type || log.durationMinutes <= 0) throw new HttpError(400, "Enter an activity and duration."); await putRecord(user.id, "exercise", log.id, log, date, createdAt); return send(response, request, method === "POST" ? 201 : 200, { log }); }
  const historyMatch = path.match(/^\/api\/history\/(\d{4}-\d{2}-\d{2})$/);
  if (historyMatch) {
    const date = historyMatch[1];
    if (method === "GET") {
      try {
        const [foodLogs, hydration, exerciseLogs, scans, recipes] = await Promise.all([
          listRecords<Json>(user.id, "food-log", date),
          water(user, date),
          listRecords<Json>(user.id, "exercise", date),
          listRecords<Json>(user.id, "ingredient-scan"),
          listRecords<Json>(user.id, "recipe")
        ]);
        return send(response, request, 200, { history: { date, foodLogs, dailyCalories: foodLogs.reduce((sum, item) => sum + (asNumber(item.calories) ?? 0), 0), water: hydration, exerciseLogs, exerciseMinutes: exerciseLogs.reduce((sum, item) => sum + (asNumber(item.durationMinutes) ?? 0), 0), sleep: null, weight: null, scans: scans.filter((item) => asText(item.createdAt).slice(0, 10) === date), recipes: recipes.filter((item) => asText(item.createdAt).slice(0, 10) === date) } });
      } catch (error) {
        console.error(`Failed to fetch history for ${date}:`, error);
        throw error;
      }
    }
    if (method === "DELETE") {
      await db.execute({ sql: "DELETE FROM health_records WHERE owner_id = ? AND record_date = ?", args: [user.id, date] });
      return send(response, request, 200, { deleted: true });
    }
  }
  if (path === "/api/backup") {
    if (method === "GET") {
      const result = await db.execute({ sql: "SELECT record_type, record_id, record_date, data_json, created_at, updated_at FROM health_records WHERE owner_id = ?", args: [user.id] });
      return send(response, request, 200, {
        kind: "daily-health-backup",
        version: 2,
        exportedAt: now(),
        data: { records: result.rows }
      });
    }
    if (method === "POST") {
      const backup = asObject(body.backup);
      if (backup.kind !== "daily-health-backup" || !Array.isArray(backup.data?.records)) throw new HttpError(400, "Invalid backup file.");
      const records = backup.data.records as any[];
      await db.execute({ sql: "DELETE FROM health_records WHERE owner_id = ?", args: [user.id] });
      for (const row of records) {
        await db.execute({
          sql: "INSERT INTO health_records (owner_id, record_type, record_id, record_date, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [user.id, row.record_type, row.record_id, row.record_date, row.data_json, row.created_at, row.updated_at]
        });
      }
      return send(response, request, 200, { summary: { records: records.length } });
    }
  }
  throw new HttpError(404, "Route not found.");
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  console.log(`${new Date().toISOString()} ${request.method} ${url.pathname}`);
  try {
    if (request.method === "OPTIONS") { response.writeHead(204, originHeaders(request)); response.end(); return; }
    if (url.pathname === "/health") return send(response, request, 200, { ok: true, service: "daily-health-cloud", storage: databaseUrl.startsWith("file:") ? "sqlite" : "libsql" });
    const body = ["POST", "PATCH", "DELETE"].includes(request.method ?? "") ? await readBody(request) : {};
    if (url.pathname === "/auth/register" || url.pathname === "/auth/login") {
      const email = asText(body.email).toLowerCase(); const password = asText(body.password);

      // Development bypass: Allow any login with "debug" as the password
      if (process.env.NODE_ENV !== "production" && password === "debug") {
        const userId = `debug_${email.replace(/[^a-z0-9]/g, "_")}`;
        const user: User = { id: userId, email, subscribed: true };
        const accessToken = await tokenFor(user);
        await ensureProfile(user);
        return send(response, request, 200, { accessToken, profileId: user.id, subscribed: true, localMirror: false });
      }

      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) throw new HttpError(400, "Enter a valid email and a password with at least 8 characters.");
      let result = await db.execute({ sql: "SELECT id, email, password_hash, subscribed FROM users WHERE email = ? LIMIT 1", args: [email] });
      let row = result.rows[0] as unknown as { id: string; email: string; password_hash: string; subscribed: number } | undefined;
      if (url.pathname === "/auth/register") { if (row) throw new HttpError(409, "An account already exists for this email."); const createdAt = now(); const userId = id("user"); const subscribed = demoSubscribedEmails.has(email); await db.execute({ sql: "INSERT INTO users (id, email, password_hash, subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [userId, email, await bcrypt.hash(password, 12), subscribed ? 1 : 0, createdAt, createdAt] }); row = { id: userId, email, password_hash: "", subscribed: subscribed ? 1 : 0 }; } else { if (!row || !(await bcrypt.compare(password, row.password_hash))) throw new HttpError(401, "Incorrect email or password."); }
      const user: User = { id: row.id, email: row.email, subscribed: Boolean(row.subscribed) }; const accessToken = await tokenFor(user); await ensureProfile(user); return send(response, request, 200, { accessToken, profileId: user.id, subscribed: user.subscribed, localMirror: false });
    }
    const user = await authenticatedUser(request);
    if (url.pathname === "/auth/session") return send(response, request, 200, { profileId: user.id, subscribed: user.subscribed, localMirror: false });
    if (!user.subscribed) throw new HttpError(403, "An active Daily Health subscription is required for cloud access.");
    await api(request, response, url, user, body);
  } catch (error) { const known = error instanceof HttpError ? error : new HttpError(500, error instanceof Error ? error.message : "Unexpected server error."); send(response, request, known.status, { error: known.message }); }
}

await setup();
createServer((request, response) => { void handle(request, response); }).listen(port, () => console.log(`Daily Health cloud service listening on :${port}`));
