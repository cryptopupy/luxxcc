import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <div className="luxx-shell">
        <div className="luxx-surface overflow-hidden">
          <div className="flex min-h-[78px] items-center justify-between px-5 sm:px-6">
            <span className="text-[2rem] font-black tracking-[-0.06em] text-white">LUXX</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#d7dfef]">Secure Access</span>
          </div>
          <div className="luxx-strip px-5 py-3 sm:px-6">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#7f8ca9]">Loader-style account gateway</p>
          </div>

          <div className="grid lg:grid-cols-[0.95fr,1.05fr]">
            <div className="hidden border-r border-white/[0.05] bg-[radial-gradient(circle_at_center,_rgba(63,108,191,0.16),_transparent_52%)] p-10 lg:block">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#6fb3ff]">Licensed Entry</p>
              <h2 className="mt-5 text-4xl font-black uppercase leading-none tracking-[-0.04em] text-white">
                Clean.<br />Dark.<br />Locked in.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#8b99b4]">
                Access the LUXX panel with a username, a secure password hash, and an admin-issued license key.
              </p>
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
      </div>
    </div>
  );
}
