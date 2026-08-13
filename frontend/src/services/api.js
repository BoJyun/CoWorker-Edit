import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

/**
 * 把後端錯誤轉成可顯示的字串。
 *
 * FastAPI 的錯誤一律包在物件裡：
 *   - HTTPException  -> { detail: "訊息" }
 *   - 驗證失敗 (422) -> { detail: [{ msg, loc, ... }] }
 * 直接把 err.response.data 丟給 toast 會變成物件，畫面上什麼都不會出現。
 */
export function errorMessage(err, fallback = "發生錯誤，請稍後再試") {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail)) return data.detail[0]?.msg || fallback;
  return err?.message || fallback;
}

export default api;
