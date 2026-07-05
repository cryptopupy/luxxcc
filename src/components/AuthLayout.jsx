import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthLayout({ title, subtitle, footer, children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const isRegister = location.pathname === "/register";

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <div className="luxx-shell">
        <div className="luxx-surface overflow-hidden" style={{ borderRadius: 0 }}>
          {/* ─── Top Bar ─── */}
          <div className="flex items-center justify-between px-5 sm:px-6" style={{ height: "56px" }}>
            <span className="text-[1.5rem] font-black tracking-[-0.04em] text-white select-none">
              LUXX
            </span>
            <div className="flex items-center gap-0">
              <Link
                to="/login"
                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  isLogin ? "text-white" : "text-[#6b7280] hover:text-white"
                }`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  isRegister ? "text-white" : "text-[#6b7280] hover:text-white"
                }`}
              >
                Register
              </Link>
              <span className="mx-2 h-4 w-px bg-white/10" />
              <a
                href="https://discord.gg/luxx"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] hover:text-white transition-colors"
              >
                Discord
              </a>
            </div>
          </div>

          {/* ─── Gradient Line ─── */}
          <div
            style={{
              height: "2px",
              background: "linear-gradient(90deg, #3b82f6, #06b6d4, #8b5cf6)",
            }}
          />

          {/* ─── Form Content with blur transition ─── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="px-5 py-8 sm:px-8 sm:py-10"
            >
              <div className="mb-8">
                <h1 className="text-[2.15rem] font-black uppercase tracking-[-0.04em] text-white">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.26em] text-[#8fa3c7]">
                    {subtitle}
                  </p>
                )}
              </div>
              <div>{children}</div>
              {footer && (
                <div className="mt-8 text-center text-[13px] text-[#7d879b]">
                  {footer}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
