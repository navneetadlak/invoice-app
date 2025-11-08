import React, { createContext, useEffect, useState } from "react";
import api, { readToken, setAuthHeader } from "../api";

export const AuthContext = createContext<any>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // derive isAuthenticated from token presence and expiry is optional
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token = readToken();
    if (token) {
      setAuthHeader(token);       // ensure axios has header immediately
      setIsAuthenticated(true);  // we consider presence of token => authenticated
    } else {
      setIsAuthenticated(false);
    }
    setLoading(false);
  }, []);

  const saveToken = (token: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem("jwt", token);
      sessionStorage.removeItem("jwt");
    } else {
      sessionStorage.setItem("jwt", token);
      localStorage.removeItem("jwt");
    }
    setAuthHeader(token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("jwt");
    sessionStorage.removeItem("jwt");
    setAuthHeader(null);
    setUser(null);
    setCompany(null);
    setIsAuthenticated(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{
      user, company, setUser, setCompany,
      saveToken, logout,
      loading, isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};