import axios from "axios";
import { createApiServices } from "@workspace/data-access/api";
import { isPublicPath } from "@/lib/auth-paths";

const ApiServices = createApiServices({
  baseUrl: process.env.NEXT_PUBLIC_WEB_SERVER_URL as string,
  tagTypes: [
    "USERS",
    "PROJECTS",
    "PROJECT",
    "ASSETS",
    "TEMPLATES",
    "EXPORTS",
  ],
  onUnauthorized: async () => {
    if (typeof window === "undefined") return;

    // On public/auth screens the user is legitimately signed-out, so there is no
    // session to tear down — and redirecting to /sign-in from a page that itself
    // fired the failing request would reload it and re-fire, looping forever.
    if (isPublicPath(window.location.pathname)) return;

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_WEB_SERVER_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
        },
      );
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/sign-in";
    }
  },
});

export default ApiServices;
