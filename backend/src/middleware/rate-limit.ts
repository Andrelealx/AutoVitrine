import rateLimit from "express-rate-limit";

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Muitas requisicoes. Tente novamente em alguns minutos."
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Muitas tentativas de autenticacao. Aguarde e tente novamente."
  }
});