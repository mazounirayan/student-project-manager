/**
 * Couche d’accès HTTP partagée par tous les services du frontend.
 * Le jeton est lu ici une seule fois, les erreurs sont normalisées en français.
 */

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function authHeaders(headers: Headers): Headers {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

/** Enveloppe une erreur de réponse HTTP en message lisible en français. */
async function toApiError(res: Response): Promise<ApiError> {
  const raw = await res.text().catch(() => "");
  let message = raw;
  if (raw) {
    try {
      const data = JSON.parse(raw);
      message = data.error || data.message || raw;
    } catch {
      // corps non JSON : on garde le texte brut
    }
  }
  const readable = new Map<number, string>([
    [400, "Requête invalide"],
    [401, "Session expirée, reconnectez-vous"],
    [403, "Accès refusé"],
    [404, "Ressource introuvable"],
    [413, "Fichier trop volumineux"],
  ]);
  return new ApiError(message || readable.get(res.status) || `Erreur ${res.status}`, res.status);
}

/**
 * Appel API générique vers le backend (préfixe /api).
 * Retourne le JSON de la réponse, ou du texte si la réponse n’est pas du JSON.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = authHeaders(new Headers(options.headers || {}));
  const body = options.body;
  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...options, headers });

  if (!res.ok) {
    throw await toApiError(res);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as Promise<T>;
}

/** Requête JSON typée (GET par défaut). */
export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

/** Requête POST JSON (ou multipart si data est un FormData). */
export function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const body = data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data);
  return apiFetch<T>(path, { method: "POST", body });
}

/** Requête PUT JSON (ou multipart si data est un FormData). */
export function apiPut<T>(path: string, data?: unknown): Promise<T> {
  const body = data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data);
  return apiFetch<T>(path, { method: "PUT", body });
}

/** Requête DELETE. */
export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}

/** Télécharge un fichier servi par l’API (jeton inclus) en déclenchant l’enregistrement dans le navigateur. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, { headers: authHeaders(new Headers()) });
  if (!res.ok) throw await toApiError(res);

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/.exec(disposition);
  const filename = match ? decodeURIComponent(match[1] || match[2] || match[3]) : fallbackName;

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Message d’une erreur à afficher : celui de l’API s’il existe, sinon le texte de repli. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
