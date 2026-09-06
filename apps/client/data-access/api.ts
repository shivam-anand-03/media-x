import { createApiServices } from "@workspace/data-access/api";

const ApiServices = createApiServices({
  baseUrl: process.env.NEXT_PUBLIC_WEB_SERVER_URL as string,
  tagTypes: ["PROJECTS", "PROJECT", "ASSETS", "TEMPLATES", "EXPORTS"],
});

export default ApiServices;
