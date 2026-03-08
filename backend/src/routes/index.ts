import { Router } from "express";
import authRoutes from "./auth.routes";
import storeRoutes from "./store.routes";
import vehicleRoutes from "./vehicle.routes";
import subscriptionRoutes from "./subscription.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.get("/health", (_req, res) => {
  return res.json({
    message: "AutoVitrine API online",
    timestamp: new Date().toISOString()
  });
});

router.use("/auth", authRoutes);
router.use("/stores", storeRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/admin", adminRoutes);

export default router;
