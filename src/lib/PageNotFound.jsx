import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  const { data: authData, isFetched } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const payload = await api.get("/auth/me");
        return { user: payload.user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[linear-gradient(180deg,_#060911_0%,_#04060a_100%)]">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-[#4f5d79]">404</h1>
            <div className="h-0.5 w-16 bg-white/10 mx-auto"></div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-white">Page Not Found</h2>
            <p className="text-[#9da9c4] leading-relaxed">
              The page <span className="font-medium text-white">"{pageName}"</span> could not be found in this application.
            </p>
          </div>

          {isFetched && authData.isAuthenticated && authData.user?.role === "admin" && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#101927] p-4">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#1c2640]">
                  <div className="h-2 w-2 rounded-full bg-[#8ab3ff]"></div>
                </div>
                <div className="text-left space-y-1">
                  <p className="text-sm font-medium text-white">Admin Note</p>
                  <p className="text-sm text-[#8f9bb7] leading-relaxed">
                    This route is not wired yet. Add it to the Luxx router when you implement the next panel.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex items-center rounded-xl border border-[#2f4777] bg-[#13203b] px-4 py-2 text-sm font-medium text-[#d7e6ff] transition-colors duration-200 hover:bg-[#18284a]"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
