import React from "react";

const UserNotRegisteredError = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#060911] px-4">
    <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#101927] p-8">
      <h1 className="text-3xl font-black text-white text-center">User Not Registered</h1>
      <p className="mt-4 text-center text-[#9aa6c2]">
        Please register an account before signing in.
      </p>
    </div>
  </div>
);

export default UserNotRegisteredError;
