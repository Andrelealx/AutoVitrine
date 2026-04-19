import cors from "cors";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import fs from "fs";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { publicLimiter, leadsLimiter } from "./middleware/rate-limit";
import routes from "./routes";
import publicRoutes from "./routes/public.routes";
import { subscriptionWebhookRouter } from "./routes/subscription.routes";

export const app = express();

// Comprime respostas HTTP — reduz bandwidth no Railway
app.use(compression());

app.use(helmet());
app.use(
  cors({
    origin: [env.FRONTEND_URL],
    credentials: true
  })
);

app.use("/api/subscriptions", subscriptionWebhookRouter);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/public", publicLimiter, publicRoutes);
app.use("/api", routes);

const frontendDistPath = path.resolve(process.cwd(), "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(
    express.static(frontendDistPath, {
      maxAge: "7d",
      etag: true
    })
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use(errorHandler);