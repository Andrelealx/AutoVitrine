import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";

const router = Router();
router.use(requireAuth);

const clienteSchema = z.object({
  nome:       z.string().min(2).max(60),
  cpfCnpj:    z.string().min(11).max(18),
  telefone:   z.string().optional(),
  email:      z.string().email().optional().or(z.literal("")),
  logradouro: z.string().max(60).default(""),
  numero:     z.string().max(60).default(""),
  bairro:     z.string().max(60).default(""),
  cep:        z.string().max(9).default(""),
  cMun:       z.string().max(7).default(""),
  xMun:       z.string().max(60).default(""),
  uf:         z.string().length(2).or(z.literal("")).default("")
});

// GET /api/clientes?q=&page=1&pageSize=20
router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const where = {
      storeId: req.user!.storeId!,
      ...(q ? {
        OR: [
          { nome:    { contains: q, mode: "insensitive" as const } },
          { cpfCnpj: { contains: q, mode: "insensitive" as const } },
          { telefone: { contains: q, mode: "insensitive" as const } },
          { email:   { contains: q, mode: "insensitive" as const } }
        ]
      } : {})
    };

    const [items, total] = await Promise.all([
      prisma.cliente.findMany({ where, orderBy: { nome: "asc" }, skip, take: pageSize }),
      prisma.cliente.count({ where })
    ]);

    return res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) { return next(err); }
});

// POST /api/clientes
router.post("/", async (req, res, next) => {
  try {
    const parsed = clienteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Dados inválidos: " + JSON.stringify(parsed.error.flatten().fieldErrors), 422);

    const cliente = await prisma.cliente.create({
      data: { storeId: req.user!.storeId!, ...parsed.data, email: parsed.data.email || null }
    });
    return res.status(201).json(cliente);
  } catch (err) { return next(err); }
});

// PUT /api/clientes/:id
router.put("/:id", async (req, res, next) => {
  try {
    const parsed = clienteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Dados inválidos: " + JSON.stringify(parsed.error.flatten().fieldErrors), 422);

    const existing = await prisma.cliente.findFirst({ where: { id: req.params.id, storeId: req.user!.storeId! } });
    if (!existing) throw new AppError("Cliente não encontrado", 404);

    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: { ...parsed.data, email: parsed.data.email || null }
    });
    return res.json(cliente);
  } catch (err) { return next(err); }
});

// DELETE /api/clientes/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.cliente.findFirst({ where: { id: req.params.id, storeId: req.user!.storeId! } });
    if (!existing) throw new AppError("Cliente não encontrado", 404);
    await prisma.cliente.delete({ where: { id: req.params.id } });
    return res.json({ message: "Cliente removido" });
  } catch (err) { return next(err); }
});

export default router;
