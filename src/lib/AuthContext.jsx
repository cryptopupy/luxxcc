import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";

const AuthContext = createContext(null);
const HOME_POLL_INTERVAL_MS = 5000;

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [home, setHome] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const applyAuthenticatedState = useCallback((payload) => {
    setUser(payload.user);
    setHome(payload.home);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
  }, []);

  const applySignedOutState = useCallback((error = null) => {
    setUser(null);
    setHome(null);
    setIsAuthenticated(false);
    if (error && error.status !== 401) {
      setAuthError({ type: "auth_required", message: error.message });
    } else {
      setAuthError(null);
    }
    setAuthChecked(true);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const payload = await api.get("/auth/me");
      applyAuthenticatedState(payload);
    } catch (error) {
      applySignedOutState(error);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [applyAuthenticatedState, applySignedOutState]);

  const refreshHomeState = useCallback(async () => {
    try {
      const payload = await api.get("/auth/me");
      applyAuthenticatedState(payload);
    } catch (error) {
      if (error.status === 401) {
        applySignedOutState(error);
      }
    }
  }, [applyAuthenticatedState, applySignedOutState]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) {
      return undefined;
    }

    const intervalId = window.setInterval(refreshHomeState, HOME_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshHomeState();
      }
    };

    window.addEventListener("focus", refreshHomeState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshHomeState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authChecked, isAuthenticated, refreshHomeState]);

  const logout = useCallback(async (shouldRedirect = true) => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setHome(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (shouldRedirect) {
        navigate("/login", { replace: true });
      }
    }
  }, [navigate]);

  const navigateToLogin = useCallback(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        home,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        authChecked,
        appPublicSettings: null,
        setUser,
        setHome,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
