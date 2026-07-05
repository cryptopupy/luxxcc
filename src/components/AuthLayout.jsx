import React from "react";
import { motion } from "framer-motion";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <motion.div 
      className="min-h-screen px-4 py-6 sm:px-6"
      initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -4, filter: "blur(8px)" }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="luxx-shell">
        <div className="luxx-surface overflow-hidden">
          <div className="flex min-h-[78px] items-center justify-between px-5 sm:px-6">
            <span className="text-[2rem] font-black tracking-[-0.06em] text-white border-b border-[#444] pb-1 mr-2">LUXX</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#d7dfef] pl-2">Secure Access</span>
          </div>
          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <div className="mb-8">
              <h1 className="text-[2.15rem] font-black uppercase tracking-[-0.04em] text-white">{title}</h1>
              {subtitle && (
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.26em] text-[#8fa3c7]">
                  {subtitle}
                </p>
              )}
            </div>

            <div>{children}</div>

            {footer && <div className="mt-8 text-center text-[13px] text-[#7d879b]">{footer}</div>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
