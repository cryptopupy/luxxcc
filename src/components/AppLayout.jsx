import React, { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronRight, LogOut, Settings, User2, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const location = useLocation();
  const { user, home, logout } = useAuth();
  const [activePanel, setActivePanel] = useState(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const isAdmin = user?.role === "admin";
  const isConnected = Boolean(home?.scriptConnected);
  const navItems = [
    { label: "Home", path: "/" },
  ];

  if (isConnected) {
    navItems.push({ label: "Dashboard", path: "/dashboard" });
  }

  if (isAdmin) {
    navItems.push({ label: "Admin Panel", path: "/admin" });
  }

  const isActive = (path) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));

  const notificationItems = useMemo(
    () => [
      {
        title: home?.scriptConnected ? "Game found" : "Waiting for game",
        detail: home?.gameFound || "No detected session yet",
        meta: home?.executor || "Keep the script running",
      },
      {
        title: home?.activeConfigName || "No active config",
        detail: "Current panel config",
        meta: home?.sessionCode || "Session pending",
      },
      {
        title: user?.licenseKeyPreview || "License hidden",
        detail: "Active account key",
        meta: user?.lastLoginAt ? formatDate(user.lastLoginAt) : "Fresh session",
      },
    ],
    [home, user],
  );

  useEffect(() => {
    setActivePanel(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!home) return;
    if (!home.scriptConnected || !home.activeConfigName) {
      setHasUnreadNotifications(true);
    }
  }, [home]);

  useEffect(() => {
    if (!activePanel) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActivePanel(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel]);

  const openNotifications = () => {
    setActivePanel("notifications");
    setHasUnreadNotifications(false);
  };

  const openSettings = () => {
    setActivePanel("settings");
  };

  return (
    <div className="min-h-screen text-white">
      <header className="pt-4 sm:pt-5">
        <div className="luxx-shell">
          <div className="luxx-surface overflow-hidden">
            <div className="flex min-h-[78px] items-center justify-between gap-4 px-5 sm:px-6">
              <Link to="/" className="inline-flex items-center">
                <span className="text-[2rem] font-black tracking-[-0.06em] text-white">LUXX</span>
              </Link>
              <a
                href="https://discord.gg"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#d7dfef] transition-colors hover:text-white"
              >
                Discord
              </a>
            </div>

            <div className="luxx-strip">
              <div className="flex min-h-[48px] items-center justify-between gap-4 px-3 sm:px-4">
                <nav className="hidden items-center md:flex">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`luxx-nav-link ${isActive(item.path) ? "luxx-nav-link-active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <nav className="flex items-center overflow-x-auto md:hidden">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`luxx-nav-link ${isActive(item.path) ? "luxx-nav-link-active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="flex items-center gap-2">
                  <button onClick={openNotifications} className="luxx-icon-button relative" title="Notifications">
                    <Bell size={15} />
                    {hasUnreadNotifications ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#69b0ff]" /> : null}
                  </button>
                  <button onClick={openSettings} className="luxx-icon-button" title="Settings">
                    <Settings size={15} />
                  </button>
                  <button onClick={() => logout()} className="luxx-icon-button" title="Logout">
                    <LogOut size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="luxx-shell py-5 sm:py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Outlet context={{ user }} />
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {activePanel ? (
          <>
            <motion.button
              type="button"
              aria-label="Close panel overlay"
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePanel(null)}
            />

            <motion.aside
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed right-4 top-4 z-50 h-[calc(100vh-2rem)] w-[min(420px,calc(100vw-2rem))] border border-white/[0.08] bg-[#101520]/98 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7a88a5]">
                    {activePanel === "notifications" ? "Notifications" : "Settings"}
                  </p>
                  <h2 className="mt-2 text-xl font-black uppercase tracking-[0.04em] text-white">
                    {activePanel === "notifications" ? "Activity Center" : "Panel Settings"}
                  </h2>
                </div>
                <button onClick={() => setActivePanel(null)} className="luxx-icon-button">
                  <X size={15} />
                </button>
              </div>

              {activePanel === "notifications" ? (
                <div className="space-y-3 px-5 py-5">
                  {notificationItems.map((item) => (
                    <div key={item.title} className="border border-white/[0.06] bg-[#0c111a] px-4 py-4">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm text-[#8d9ab4]">{item.detail}</p>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6d7a94]">{item.meta}</p>
                    </div>
                  ))}

                  {isConnected ? (
                    <Link to="/dashboard" onClick={() => setActivePanel(null)} className="luxx-button w-full justify-between">
                      Open Dashboard
                      <ChevronRight size={14} />
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-5 px-5 py-5">
                  <div className="border border-white/[0.06] bg-[#0c111a] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center border border-white/[0.08] bg-[#151d2c] text-[#86beff]">
                        <User2 size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{user?.displayName || "LUXX User"}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6f7b95]">
                          {user?.email || "username"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <SettingsRow
                      label="Current Session"
                      value={home?.sessionCode || "Pending"}
                      detail={home?.scriptConnected ? "Connected to site" : "Waiting for heartbeat"}
                    />
                    <SettingsRow
                      label="Active Config"
                      value={home?.activeConfigName || "None loaded"}
                      detail={home?.executor || "No executor reported"}
                    />
                    <SettingsRow
                      label="License Preview"
                      value={user?.licenseKeyPreview || "Unavailable"}
                      detail="Issued through the LUXX admin panel"
                    />
                  </div>

                  <button onClick={() => logout()} className="luxx-button w-full justify-between">
                    Sign Out
                    <LogOut size={14} />
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SettingsRow({ label, value, detail }) {
  return (
    <div className="border border-white/[0.06] bg-[#0c111a] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6d7a94]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-[#8d9ab4]">{detail}</p>
    </div>
  );
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}
