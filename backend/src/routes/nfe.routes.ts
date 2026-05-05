import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { UserRole, VehicleStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, requireStoreContext } from "../middleware/auth";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";
import { gerarChaveAcesso } from "../services/nfe/chaveAcesso";
import { gerarXmlNFe, DadosNFe } from "../services/nfe/xmlBuilder";
import {
  assinarXml,
  enviarParaSEFAZ,
  gerarDANFE,
  cancelarNFe,
  consultarNFe,
  consultarStatusServico,
  encryptCertPassword,
  decryptCertPassword
} from "../services/nfe/nfeService";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".pfx") || file.mimetype === "application/x-pkcs12") {
      cb(null, true);
      return;
    }
    cb(new AppError("Envie apenas arquivos .pfx", 400));
  }
});

router.use(requireAuth);
router.use(requireRole([UserRole.STORE_OWNER, UserRole.STORE_STAFF]));
router.use(requireStoreContext);

function getCertKey(): string {
  const key = env.NFE_CERT_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new AppError("NFE_CERT_ENCRYPTION_KEY não configurada (deve ter 64 hex chars = 32 bytes)", 500);
  }
  return key;
}

// ─── Configuração Fiscal ─────────────────────────────────────────────────────

// GET /api/nfe/config
router.get("/config", async (req, res, next) => {
  try {
    const fiscal = await prisma.lojaFiscal.findUnique({
      where: { lojaId: req.user!.storeId! },
      select: {
        id: true,
        cnpj: true,
        ie: true,
        crt: true,
        ambiente: true,
        serie: true,
        ultimaNNF: true,
        logradouro: true,
        numero: true,
        bairro: true,
        cMun: true,
        xMun: true,
        uf: true,
        cep: true,
        fone: true,
        cUF: true,
        certificadoPfx: true, // apenas para checar existência, não retornado ao cliente
        createdAt: true,
        updatedAt: true
      }
    });

    const temCertificado = !!fiscal?.certificadoPfx;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { certificadoPfx: _cert, ...fiscalSemCert } = fiscal ?? ({} as typeof fiscal & { certificadoPfx: unknown });

    return res.json({
      configurado: !!fiscal && !!fiscal.cnpj,
      fiscal: fiscal
        ? { ...fiscalSemCert, temCertificado }
        : null
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/nfe/config — salva configuração (sem certificado)
const configSchema = z.object({
  cnpj: z.string().min(14).max(18),
  ie: z.string().min(1).max(30),
  crt: z.coerce.number().int().min(1).max(3).default(1),
  ambiente: z.coerce.number().int().min(1).max(2).default(2),
  serie: z.coerce.number().int().min(1).max(999).default(1),
  logradouro: z.string().min(1).max(60),
  numero: z.string().min(1).max(60),
  bairro: z.string().min(1).max(60),
  cMun: z.string().min(7).max(7),
  xMun: z.string().min(1).max(60),
  uf: z.string().length(2),
  cep: z.string().min(8).max(9),
  fone: z.string().min(8).max(20),
  cUF: z.coerce.number().int().default(33)
});

router.post("/config", async (req, res, next) => {
  try {
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Dados fiscais inválidos: " + JSON.stringify(parsed.error.flatten().fieldErrors), 422);
    }

    const data = parsed.data;

    const fiscal = await prisma.lojaFiscal.upsert({
      where: { lojaId: req.user!.storeId! },
      create: { lojaId: req.user!.storeId!, ...data },
      update: data
    });

    return res.json({ message: "Configuração fiscal salva", fiscal: { id: fiscal.id } });
  } catch (error) {
    return next(error);
  }
});

// POST /api/nfe/config/certificado — upload do .pfx
router.post("/config/certificado", upload.single("certificado"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("Arquivo .pfx não enviado", 400);
    }

    const senha = req.body.senha as string;
    if (!senha) {
      throw new AppError("Senha do certificado é obrigatória", 400);
    }

    const certKey = getCertKey();
    const senhaCriptografada = encryptCertPassword(senha, certKey);

    await prisma.lojaFiscal.upsert({
      where: { lojaId: req.user!.storeId! },
      create: {
        lojaId: req.user!.storeId!,
        cnpj: "",
        ie: "",
        certificadoPfx: req.file.buffer,
        certificadoSenha: senhaCriptografada
      },
      update: {
        certificadoPfx: req.file.buffer,
        certificadoSenha: senhaCriptografada
      }
    });

    return res.json({ message: "Certificado enviado com sucesso" });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/nfe/config/ambiente
router.put("/config/ambiente", async (req, res, next) => {
  try {
    const { ambiente } = req.body;
    if (![1, 2].includes(Number(ambiente))) {
      throw new AppError("Ambiente deve ser 1 (produção) ou 2 (homologação)", 400);
    }

    await prisma.lojaFiscal.update({
      where: { lojaId: req.user!.storeId! },
      data: { ambiente: Number(ambiente) }
    });

    return res.json({
      message: `Ambiente alterado para ${Number(ambiente) === 1 ? "produção" : "homologação"}`
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/nfe/config/numeracao — define qual será o número da próxima NF-e
router.put("/config/numeracao", async (req, res, next) => {
  try {
    const proximaNNF = Number(req.body.proximaNNF);
    if (!Number.isInteger(proximaNNF) || proximaNNF < 1 || proximaNNF > 999999999) {
      throw new AppError("Número inválido. Use um valor entre 1 e 999.999.999", 400);
    }

    const fiscal = await prisma.lojaFiscal.findUnique({ where: { lojaId: req.user!.storeId! } });
    if (!fiscal) throw new AppError("Configuração fiscal não encontrada", 404);

    // Não permitir retroceder abaixo da última emitida
    if (proximaNNF <= fiscal.ultimaNNF) {
      throw new AppError(
        `Não é possível retroceder a numeração. Última NF-e emitida foi a nº ${fiscal.ultimaNNF}. Informe um valor maior que ${fiscal.ultimaNNF}.`,
        400
      );
    }

    await prisma.lojaFiscal.update({
      where: { lojaId: req.user!.storeId! },
      data: { ultimaNNF: proximaNNF - 1 }
    });

    return res.json({ message: `Próxima NF-e será a nº ${proximaNNF}`, proximaNNF });
  } catch (error) {
    return next(error);
  }
});

// GET /api/nfe/config/status — testa conexão com SEFAZ
router.get("/config/status", async (req, res, next) => {
  try {
    const fiscal = await prisma.lojaFiscal.findUnique({
      where: { lojaId: req.user!.storeId! }
    });

    if (!fiscal) {
      throw new AppError("Configuração fiscal não encontrada", 404);
    }

    if (!fiscal.certificadoPfx || !fiscal.certificadoSenha) {
      throw new AppError("Certificado não configurado", 400);
    }
    const certKey = getCertKey();
    const senhaCert = decryptCertPassword(fiscal.certificadoSenha, certKey);
    const pfxBuffer = Buffer.from(fiscal.certificadoPfx);
    const status = await consultarStatusServico(fiscal.ambiente, fiscal.cUF, pfxBuffer, senhaCert);
    return res.json({ status, ambiente: fiscal.ambiente });
  } catch (error) {
    return next(error);
  }
});

// ─── Emissão de NF-e ─────────────────────────────────────────────────────────

const emitirSchema = z.object({
  // Veículo (pode ser por ID ou manual)
  veiculoId: z.string().optional(),
  placa: z.string().min(7).max(8),
  descricao: z.string().min(10).max(120),
  renavam: z.string().optional(),
  chassi: z.string().optional(),
  valorVenda: z.coerce.number().positive(),

  // Destinatário
  cpfCnpjDestinatario: z.string().min(11).max(18),
  nomeDestinatario: z.string().min(3).max(60),
  logradouroDestinatario: z.string().min(1).max(60),
  numeroDestinatario: z.string().min(1).max(60),
  bairroDestinatario: z.string().min(1).max(60),
  cMunDestinatario: z.string().min(7).max(7),
  xMunDestinatario: z.string().min(1).max(60),
  ufDestinatario: z.string().length(2),
  cepDestinatario: z.string().min(8).max(9),
  emailDestinatario: z.string().email().optional(),
  indIEDest: z.string().default("9"),

  // Pagamento
  tipoPagamento: z.string().default("99")
});

// POST /api/nfe/emitir
router.post("/emitir", async (req, res, next) => {
  try {
    const parsed = emitirSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "Dados inválidos: " + JSON.stringify(parsed.error.flatten().fieldErrors),
        422
      );
    }

    const dados = parsed.data;

    // 1. Buscar configuração fiscal da loja
    const fiscal = await prisma.lojaFiscal.findUnique({
      where: { lojaId: req.user!.storeId! }
    });

    if (!fiscal) {
      throw new AppError("Configure os dados fiscais antes de emitir NF-e", 400);
    }

    if (!fiscal.certificadoPfx || !fiscal.certificadoSenha) {
      throw new AppError("Certificado digital não configurado", 400);
    }

    if (!fiscal.cnpj || !fiscal.ie) {
      throw new AppError("CNPJ e IE são obrigatórios na configuração fiscal", 400);
    }

    // 2. Buscar dados da loja
    const loja = await prisma.store.findUnique({
      where: { id: req.user!.storeId! }
    });

    if (!loja) throw new AppError("Loja não encontrada", 404);

    // 3. Incrementar número da NF-e atomicamente
    const fiscalAtualizado = await prisma.lojaFiscal.update({
      where: { lojaId: req.user!.storeId! },
      data: { ultimaNNF: { increment: 1 } }
    });

    const nNF = fiscalAtualizado.ultimaNNF;
    const dhEmi = new Date();

    // 4. Gerar chave de acesso
    const chaveAcesso = gerarChaveAcesso({
      cUF: fiscal.cUF,
      dhEmi,
      cnpj: fiscal.cnpj,
      serie: fiscal.serie,
      nNF
    });

    // 5. Buscar veículo se informado
    let veiculo = null;
    if (dados.veiculoId) {
      veiculo = await prisma.vehicle.findFirst({
        where: { id: dados.veiculoId, storeId: req.user!.storeId! }
      });
    }

    // 6. Montar dados da NF-e
    const dadosNFe: DadosNFe = {
      // Emitente
      cnpjEmitente: fiscal.cnpj,
      nomeEmitente: loja.name,
      nomeFantasia: loja.name,
      logradouro: fiscal.logradouro,
      numero: fiscal.numero,
      bairro: fiscal.bairro,
      cMun: fiscal.cMun,
      xMun: fiscal.xMun,
      uf: fiscal.uf,
      cep: fiscal.cep,
      fone: fiscal.fone,
      ie: fiscal.ie,
      crt: fiscal.crt,
      cUF: fiscal.cUF,

      // Destinatário
      cpfCnpjDestinatario: dados.cpfCnpjDestinatario,
      nomeDestinatario: dados.nomeDestinatario,
      logradouroDestinatario: dados.logradouroDestinatario,
      numeroDestinatario: dados.numeroDestinatario,
      bairroDestinatario: dados.bairroDestinatario,
      cMunDestinatario: dados.cMunDestinatario,
      xMunDestinatario: dados.xMunDestinatario,
      ufDestinatario: dados.ufDestinatario,
      cepDestinatario: dados.cepDestinatario,
      emailDestinatario: dados.emailDestinatario,
      indIEDest: dados.indIEDest,

      // Veículo
      placa: dados.placa,
      descricao: dados.descricao,
      renavam: dados.renavam ?? veiculo?.renavam ?? undefined,
      chassi: dados.chassi ?? veiculo?.chassis ?? undefined,
      valorVenda: dados.valorVenda,

      // Controle
      nNF,
      serie: fiscal.serie,
      chaveAcesso,
      ambiente: fiscal.ambiente,
      dhEmi,
      tipoPagamento: dados.tipoPagamento
    };

    // 7. Gerar XML
    const xmlNFe = gerarXmlNFe(dadosNFe);

    // 8. Assinar XML
    const certKey = getCertKey();
    const senhaCert = decryptCertPassword(fiscal.certificadoSenha, certKey);
    const pfxBuffer = Buffer.from(fiscal.certificadoPfx);
    const xmlAssinado = assinarXml(xmlNFe, pfxBuffer, senhaCert);

    // 9. Salvar como pendente antes de enviar
    const nota = await prisma.notaFiscal.create({
      data: {
        lojaId: req.user!.storeId!,
        veiculoId: veiculo?.id ?? null,
        chaveAcesso,
        nNF,
        serie: fiscal.serie,
        dhEmi,
        nomeDestinatario: dados.nomeDestinatario,
        cpfCnpjDestinatario: dados.cpfCnpjDestinatario,
        emailDestinatario: dados.emailDestinatario ?? null,
        valorTotal: dados.valorVenda,
        renavam: dadosNFe.renavam ?? null,
        chassi: dadosNFe.chassi ?? null,
        xmlEnviado: xmlAssinado,
        status: "pendente"
      }
    });

    // 10. Enviar para SEFAZ
    let retorno;
    try {
      retorno = await enviarParaSEFAZ(xmlAssinado, fiscal.ambiente, pfxBuffer, senhaCert);
    } catch (sefazError: any) {
      await prisma.notaFiscal.update({
        where: { id: nota.id },
        data: {
          status: "erro",
          motivoErro: `Erro de comunicação SEFAZ: ${sefazError?.message ?? "Desconhecido"}`
        }
      });
      throw new AppError(`Falha na comunicação com SEFAZ: ${sefazError?.message}`, 502);
    }

    // 11. Processar retorno
    if (retorno.cStat === "100") {
      // Autorizada
      await prisma.notaFiscal.update({
        where: { id: nota.id },
        data: {
          status: "autorizada",
          protocolo: retorno.protocolo ?? null,
          xmlAutorizado: retorno.xmlAutorizado ?? null
        }
      });

      // Marcar veículo como vendido se informado
      if (veiculo) {
        await prisma.vehicle.update({
          where: { id: veiculo.id },
          data: { status: VehicleStatus.SOLD }
        });
      }

      return res.status(201).json({
        message: "NF-e autorizada com sucesso",
        nota: {
          id: nota.id,
          chaveAcesso,
          nNF,
          protocolo: retorno.protocolo,
          status: "autorizada"
        }
      });
    }

    // Erro SEFAZ
    await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: "erro",
        motivoErro: `cStat: ${retorno.cStat} — ${retorno.xMotivo}`
      }
    });

    return res.status(422).json({
      message: "NF-e rejeitada pela SEFAZ",
      cStat: retorno.cStat,
      xMotivo: retorno.xMotivo,
      notaId: nota.id
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Listagem de NF-e ─────────────────────────────────────────────────────────

// GET /api/nfe/notas
router.get("/notas", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const status = req.query.status ? String(req.query.status) : undefined;

    const where = {
      lojaId: req.user!.storeId!,
      ...(status ? { status } : {})
    };

    const [items, total] = await Promise.all([
      prisma.notaFiscal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          chaveAcesso: true,
          nNF: true,
          serie: true,
          dhEmi: true,
          nomeDestinatario: true,
          cpfCnpjDestinatario: true,
          valorTotal: true,
          protocolo: true,
          status: true,
          motivoErro: true,
          createdAt: true,
          veiculo: {
            select: { id: true, brand: true, model: true, plate: true }
          }
        }
      }),
      prisma.notaFiscal.count({ where })
    ]);

    return res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/nfe/notas/:id
router.get("/notas/:id", async (req, res, next) => {
  try {
    const nota = await prisma.notaFiscal.findFirst({
      where: { id: req.params.id, lojaId: req.user!.storeId! },
      include: { veiculo: { select: { id: true, brand: true, model: true, plate: true } } }
    });

    if (!nota) throw new AppError("Nota fiscal não encontrada", 404);

    return res.json({ ...nota, xmlEnviado: undefined, xmlAutorizado: undefined });
  } catch (error) {
    return next(error);
  }
});

// GET /api/nfe/notas/:id/xml
router.get("/notas/:id/xml", async (req, res, next) => {
  try {
    const nota = await prisma.notaFiscal.findFirst({
      where: { id: req.params.id, lojaId: req.user!.storeId! },
      select: { chaveAcesso: true, nNF: true, xmlAutorizado: true, xmlEnviado: true, status: true }
    });

    if (!nota) throw new AppError("Nota fiscal não encontrada", 404);

    const xml = nota.xmlAutorizado ?? nota.xmlEnviado;
    if (!xml) throw new AppError("XML não disponível", 404);

    res.setHeader("Content-Type", "application/xml");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="NFe${nota.chaveAcesso}.xml"`
    );
    return res.send(xml);
  } catch (error) {
    return next(error);
  }
});

// GET /api/nfe/notas/:id/danfe
router.get("/notas/:id/danfe", async (req, res, next) => {
  try {
    const nota = await prisma.notaFiscal.findFirst({
      where: { id: req.params.id, lojaId: req.user!.storeId! }
    });

    if (!nota) throw new AppError("Nota fiscal não encontrada", 404);
    if (nota.status !== "autorizada") throw new AppError("DANFE disponível apenas para notas autorizadas", 400);

    const loja = await prisma.store.findUnique({ where: { id: req.user!.storeId! } });
    const fiscal = await prisma.lojaFiscal.findUnique({ where: { lojaId: req.user!.storeId! } });

    if (!loja || !fiscal) throw new AppError("Dados da loja não encontrados", 404);

    // Extrair descrição do XML enviado
    const descMatch = nota.xmlEnviado.match(/<xProd>([^<]+)<\/xProd>/);
    const descricao = descMatch?.[1] ?? "Veículo";
    const placaMatch = nota.xmlEnviado.match(/<cProd>([^<]+)<\/cProd>/);
    const placa = placaMatch?.[1] ?? "";

    const pdfBuffer = await gerarDANFE({
      chaveAcesso: nota.chaveAcesso,
      nNF: nota.nNF,
      serie: nota.serie,
      dhEmi: nota.dhEmi,
      protocolo: nota.protocolo ?? undefined,
      nomeEmitente: loja.name,
      cnpjEmitente: fiscal.cnpj,
      ieEmitente: fiscal.ie,
      enderecoEmitente: `${fiscal.logradouro}, ${fiscal.numero} - ${fiscal.bairro}, ${fiscal.xMun}/${fiscal.uf}`,
      nomeDestinatario: nota.nomeDestinatario,
      cpfCnpjDestinatario: nota.cpfCnpjDestinatario,
      enderecoDestinatario: "",
      descricaoProduto: descricao,
      placa,
      renavam: nota.renavam ?? undefined,
      chassi: nota.chassi ?? undefined,
      valorTotal: nota.valorTotal
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="DANFE_NFe${nota.nNF}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

// GET /api/nfe/notas/:id/danfe/preview — DANFE para qualquer status (sem protocolo)
router.get("/notas/:id/danfe/preview", async (req, res, next) => {
  try {
    const nota = await prisma.notaFiscal.findFirst({
      where: { id: req.params.id, lojaId: req.user!.storeId! }
    });

    if (!nota) throw new AppError("Nota fiscal não encontrada", 404);

    const loja = await prisma.store.findUnique({ where: { id: req.user!.storeId! } });
    const fiscal = await prisma.lojaFiscal.findUnique({ where: { lojaId: req.user!.storeId! } });

    if (!loja || !fiscal) throw new AppError("Dados da loja não encontrados", 404);

    const descMatch = nota.xmlEnviado.match(/<xProd>([^<]+)<\/xProd>/);
    const descricao = descMatch?.[1] ?? "Veículo";
    const placaMatch = nota.xmlEnviado.match(/<cProd>([^<]+)<\/cProd>/);
    const placa = placaMatch?.[1] ?? "";

    const pdfBuffer = await gerarDANFE({
      chaveAcesso: nota.chaveAcesso,
      nNF: nota.nNF,
      serie: nota.serie,
      dhEmi: nota.dhEmi,
      protocolo: nota.protocolo ?? undefined,
      nomeEmitente: loja.name,
      cnpjEmitente: fiscal.cnpj,
      ieEmitente: fiscal.ie,
      enderecoEmitente: `${fiscal.logradouro}, ${fiscal.numero} - ${fiscal.bairro}, ${fiscal.xMun}/${fiscal.uf}`,
      nomeDestinatario: nota.nomeDestinatario,
      cpfCnpjDestinatario: nota.cpfCnpjDestinatario,
      enderecoDestinatario: "",
      descricaoProduto: descricao,
      placa,
      renavam: nota.renavam ?? undefined,
      chassi: nota.chassi ?? undefined,
      valorTotal: nota.valorTotal
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="DANFE_preview_NFe${nota.nNF}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

// ─── Cancelamento ─────────────────────────────────────────────────────────────

// POST /api/nfe/notas/:id/cancelar
router.post("/notas/:id/cancelar", async (req, res, next) => {
  try {
    const { justificativa } = req.body;
    if (!justificativa || String(justificativa).length < 15) {
      throw new AppError("Justificativa deve ter pelo menos 15 caracteres", 400);
    }

    const nota = await prisma.notaFiscal.findFirst({
      where: { id: req.params.id, lojaId: req.user!.storeId! }
    });

    if (!nota) throw new AppError("Nota fiscal não encontrada", 404);
    if (nota.status !== "autorizada") throw new AppError("Apenas notas autorizadas podem ser canceladas", 400);
    if (!nota.protocolo) throw new AppError("Protocolo de autorização não encontrado", 400);

    // Verificar prazo (máximo 24 horas)
    const horasDesdeEmissao = (Date.now() - nota.dhEmi.getTime()) / 3600000;
    if (horasDesdeEmissao > 24) {
      throw new AppError("Prazo para cancelamento expirado (máximo 24 horas após emissão)", 400);
    }

    const fiscal = await prisma.lojaFiscal.findUnique({
      where: { lojaId: req.user!.storeId! }
    });

    if (!fiscal?.certificadoPfx || !fiscal.certificadoSenha) {
      throw new AppError("Certificado digital não configurado", 400);
    }

    const certKey = getCertKey();
    const senhaCert = decryptCertPassword(fiscal.certificadoSenha, certKey);
    const pfxBuffer = Buffer.from(fiscal.certificadoPfx);

    const retorno = await cancelarNFe(
      nota.chaveAcesso,
      nota.protocolo,
      String(justificativa),
      pfxBuffer,
      senhaCert,
      fiscal.ambiente
    );

    if (retorno.cStat === "135" || retorno.cStat === "155") {
      // 135 = Evento registrado e vinculado a NF-e, 155 = Cancelamento homologado
      await prisma.notaFiscal.update({
        where: { id: nota.id },
        data: { status: "cancelada" }
      });

      return res.json({
        message: "NF-e cancelada com sucesso",
        cStat: retorno.cStat,
        xMotivo: retorno.xMotivo,
        protocolo: retorno.protocolo
      });
    }

    return res.status(422).json({
      message: "Falha no cancelamento",
      cStat: retorno.cStat,
      xMotivo: retorno.xMotivo
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Consulta na SEFAZ ────────────────────────────────────────────────────────

// GET /api/nfe/notas/:id/consultar
router.get("/notas/:id/consultar", async (req, res, next) => {
  try {
    const nota = await prisma.notaFiscal.findFirst({
      where: { id: req.params.id, lojaId: req.user!.storeId! }
    });

    if (!nota) throw new AppError("Nota fiscal não encontrada", 404);

    const fiscal = await prisma.lojaFiscal.findUnique({
      where: { lojaId: req.user!.storeId! }
    });

    if (!fiscal) throw new AppError("Configuração fiscal não encontrada", 404);

    if (!fiscal.certificadoPfx || !fiscal.certificadoSenha) {
      throw new AppError("Certificado não configurado", 400);
    }
    const certKey = getCertKey();
    const senhaCert = decryptCertPassword(fiscal.certificadoSenha, certKey);
    const pfxBuffer = Buffer.from(fiscal.certificadoPfx);
    const status = await consultarNFe(nota.chaveAcesso, fiscal.ambiente, pfxBuffer, senhaCert);

    return res.json({ status, chaveAcesso: nota.chaveAcesso });
  } catch (error) {
    return next(error);
  }
});

// ─── Busca de veículos para autocomplete ─────────────────────────────────────

// GET /api/nfe/veiculos/busca?q=placa
router.get("/veiculos/busca", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ items: [] });

    const veiculos = await prisma.vehicle.findMany({
      where: {
        storeId: req.user!.storeId!,
        status: { not: VehicleStatus.SOLD },
        OR: [
          { plate: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        color: true,
        plate: true,
        renavam: true,
        chassis: true,
        price: true
      },
      take: 10
    });

    return res.json({ items: veiculos });
  } catch (error) {
    return next(error);
  }
});

export default router;
