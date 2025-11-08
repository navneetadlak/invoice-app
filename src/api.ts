import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE_URL || "https://alitinvoiceappapi.azurewebsites.net/api";
const baseURL = BASE.replace(/\/+$/, "");

const api = axios.create({ baseURL, timeout: 15000, headers: { Accept: "application/json" } });

export const readToken = () => localStorage.getItem("jwt") || sessionStorage.getItem("jwt") || null;

export const setAuthHeader = (token: string | null) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};

// initialize header at import time if token exists
setAuthHeader(readToken());

export default api;