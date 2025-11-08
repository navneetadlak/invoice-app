import api from "../api";

export const AuthService = {
  login: (email: string, password: string, rememberMe: boolean) =>
    api.post("/Auth/Login", { email, password, rememberMe }),

  signup: (formData: FormData) =>
    api.post("/Auth/Signup", formData, { headers: { "Content-Type": "multipart/form-data" } }),

  getProfile: () => api.get("/Auth/GetProfile")
};
