import cors from "cors";
import express from "express";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { publicLimiter } from "./middleware/rate-limit";
import routes from "./routes";
import publicRoutes from "./routes/public.routes";
import { subscriptionWebhookRouter } from "./routes/subscription.routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.FRONTEND_URL],
    credentials: true
  })
);

app.use("/api/subscriptions", subscriptionWebhookRouter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/public", publicLimiter, publicRoutes);
app.use("/api", routes);

const frontendDistPath = path.resolve(process.cwd(), "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use(errorHandler);