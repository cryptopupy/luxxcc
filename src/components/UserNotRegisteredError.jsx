import React from "react";

const UserNotRegisteredError = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#060911_0%,_#04060a_100%)] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#101927] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#1c2640]">
            <svg className="h-8 w-8 text-[#8ab3ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-black uppercase tracking-[0.14em] text-white">Access Restricted</h1>
          <p className="mb-8 text-sm leading-7 text-[#9aa6c2]">
            This account is not linked to a valid Luxx license. Ask an administrator to issue a key, then register with that code.
          </p>
          <div className="rounded-2xl border border-white/10 bg-[#0a121d] p-4 text-left text-sm text-[#8b97b3]">
            <p className="font-semibold uppercase tracking-[0.22em] text-[#d7e1f7]">What to check</p>
            <p className="mt-3">1. Confirm you registered with the correct license key.</p>
            <p className="mt-2">2. Ask an admin to verify the key has not been revoked or claimed already.</p>
            <p className="mt-2">3. Sign out and register again if the account was created before key validation existed.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
