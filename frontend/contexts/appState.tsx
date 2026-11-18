// src/services/session.ts
import type { User } from "@/types/auth";

type Listener = () => void;

let USER: User | null = null;
let TOKEN: string | null = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export const saveUser = (user: User | null) => {
  USER = user;
  notify();
};
export const getUser = () => USER;
export const clearUser = () => {
  USER = null;
  notify();
};

export const saveToken = (token: string | null) => {
  TOKEN = token;
  notify();
};
export const getToken = () => TOKEN;
export const clearToken = () => {
  TOKEN = null;
  notify();
};

export const clearAppState = () => {
  USER = null;
  TOKEN = null;
  notify();
};

// Réactivité pour React
export const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
