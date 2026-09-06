import projectRouter from "@/module/project/project.route";
import assetRouter from "@/module/asset/asset.route";
import templateRouter from "@/module/template/template.route";
import exportRouter from "@/module/export/export.route";
import aiRouter from "@/module/ai/ai.route";

export const routes = [
  {
    prefix: "projects",
    route: projectRouter,
  },
  {
    prefix: "assets",
    route: assetRouter,
  },
  {
    prefix: "templates",
    route: templateRouter,
  },
  {
    prefix: "exports",
    route: exportRouter,
  },
  {
    prefix: "ai",
    route: aiRouter,
  },
];
