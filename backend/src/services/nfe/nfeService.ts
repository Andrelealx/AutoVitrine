import crypto from "crypto";
import https from "https";
import forge from "node-forge";
import axios from "axios";
import PDFDocument from "pdfkit";
import { gerarXmlNFe, DadosNFe } from "./xmlBuilder";

// ─── Criptografia da senha do certificado ────────────────────────────────────

const CIPHER_ALGORITHM = "aes-256-gcm";

export function encryptCertPassword(password: string, key: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, Buffer.from(key, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptCertPassword(encrypted: string, key: string): string {
  const [ivHex, authTagHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, Buffer.from(key, "hex"), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}

// ─── Assinatura Digital XMLDSig ───────────────────────────────────────────────

interface CertInfo {
  privateKeyPem: string;
  certPem: string;
  certDerBase64: string;
}

/**
 * Carrega chave privada e certificado de um arquivo PFX
 */
function carregarPfx(pfxBuffer: Buffer, senha: string): CertInfo {
  const p12Der = forge.util.createBuffer(pfxBuffer.toString("binary"));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

  // Extrair chave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) {
    throw new Error("Chave privada não encontrada no certificado PFX");
  }

  // Extrair certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) {
    throw new Error("Certificado não encontrado no arquivo PFX");
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certPem = forge.pki.certificateToPem(certBag.cert);
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
  const certDerBase64 = forge.util.encode64(certDer);

  return { privateKeyPem, certPem, certDerBase64 };
}

/**
 * Aplica C14N (Canonicalization) simples ao conteúdo de um elemento XML
 * Para XML gerado programaticamente já está em forma canônica suficiente
 */
function c14n(xmlContent: string): string {
  // Remove espaços entre tags e normaliza
  return xmlContent
    .replace(/>\s+</g, "><")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/**
 * Extrai o conteúdo do elemento <infNFe> incluindo a tag raiz
 */
function extractElement(xml: string, tagName: string): string {
  const startTag = `<${tagName}`;
  const endTag = `</${tagName}>`;
  const startIdx = xml.indexOf(startTag);
  const endIdx = xml.lastIndexOf(endTag) + endTag.length;
  if (startIdx === -1 || endIdx === endTag.length - 1) {
    throw new Error(`Elemento <${tagName}> não encontrado no XML`);
  }
  return xml.slice(startIdx, endIdx);
}

/**
 * Assina o XML da NF-e com o certificado digital A1 (.pfx)
 * Implementa XMLDSig conforme padrão SEFAZ
 */
export function assinarXml(xmlStr: string, pfxBuffer: Buffer, senha: string): string {
  const { privateKeyPem, certDerBase64 } = carregarPfx(pfxBuffer, senha);

  // Extrair elemento infNFe para assinar
  const infNFeElement = extractElement(xmlStr, "infNFe");
  const canonicalInfNFe = c14n(infNFeElement);

  // 1. Calcular DigestValue (SHA-1 do canonical infNFe)
  const digestHex = crypto.createHash("sha1").update(canonicalInfNFe, "utf8").digest();
  const digestBase64 = digestHex.toString("base64");

  // 2. Extrair o Id da referência
  const idMatch = infNFeElement.match(/Id="([^"]+)"/);
  const refId = idMatch ? idMatch[1] : "NFe";

  // 3. Montar bloco SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${refId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestBase64}</DigestValue></Reference></SignedInfo>`;

  // 4. Calcular SignatureValue (RSA-SHA1 do canonical SignedInfo)
  const canonicalSignedInfo = c14n(signedInfo);
  const sign = crypto.createSign("RSA-SHA1");
  sign.update(canonicalSignedInfo, "utf8");
  const signatureBase64 = sign.sign(privateKeyPem, "base64");

  // 5. Montar bloco Signature completo
  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureBase64}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certDerBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  // 6. Inserir Signature dentro de <NFe> antes do fechamento </NFe>
  return xmlStr.replace("</NFe>", `${signatureBlock}</NFe>`);
}

// ─── Endpoints SEFAZ ─────────────────────────────────────────────────────────

const SEFAZ_URLS: Record<number, Record<string, string>> = {
  1: {
    // Produção
    NFeAutorizacao4: "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
    NFeRetAutorizacao4: "https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
    NFeConsultaProtocolo4: "https://nfe.svrs.rs.gov.br/ws/NfeConsultaProtocolo/NfeConsultaProtocolo4.asmx",
    NFeInutilizacao4: "https://nfe.svrs.rs.gov.br/ws/NfeInutilizacao/NfeInutilizacao4.asmx",
    NFeStatusServico4: "https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
    NFeRecepcaoEvento4: "https://nfe.svrs.rs.gov.br/ws/recepcaoEvento/recepcaoEvento4.asmx"
  },
  2: {
    // Homologação
    NFeAutorizacao4: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
    NFeRetAutorizacao4: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
    NFeConsultaProtocolo4: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsultaProtocolo/NfeConsultaProtocolo4.asmx",
    NFeInutilizacao4: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeInutilizacao/NfeInutilizacao4.asmx",
    NFeStatusServico4: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
    NFeRecepcaoEvento4: "https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoEvento/recepcaoEvento4.asmx"
  }
};

function getUrl(ambiente: number, servico: string): string {
  const url = SEFAZ_URLS[ambiente]?.[servico];
  if (!url) throw new Error(`URL SEFAZ não configurada: ambiente=${ambiente}, serviço=${servico}`);
  return url;
}

function buildSoapEnvelope(action: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/1999/XMLSchema-instance">
<soapenv:Body>
${body}
</soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Cria agente HTTPS com mutual TLS usando o certificado .pfx do emitente.
 * O SEFAZ exige que o cliente apresente seu certificado durante o handshake TLS.
 * Usa node-forge para converter PFX → PEM (compatível com PKCS12 moderno do OpenSSL 3.x).
 */
function criarAgenteSEFAZ(pfxBuffer: Buffer, pfxPassword: string): https.Agent {
  const pfxDer = forge.util.createBuffer(pfxBuffer.toString("binary"));
  const p12Asn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pfxPassword);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

  if (!cert || !key) throw new Error("Certificado ou chave não encontrados no PFX");

  return new https.Agent({
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(key),
    rejectUnauthorized: false // ICP-Brasil não está nas CAs padrão do Node
  });
}

async function soapPost(
  url: string,
  soapAction: string,
  envelope: string,
  agente: https.Agent
): Promise<string> {
  try {
    const response = await axios.post(url, envelope, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction
      },
      timeout: 30000,
      maxBodyLength: Infinity,
      httpsAgent: agente,
      validateStatus: () => true // captura qualquer status HTTP para analisar o body
    });
    const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
    return body;
  } catch (err: any) {
    if (err.response) {
      const body = typeof err.response.data === "string" ? err.response.data : JSON.stringify(err.response.data);
      throw new Error(`HTTP ${err.response.status}: ${body.slice(0, 300)}`);
    }
    throw err;
  }
}

// ─── Envio para SEFAZ ─────────────────────────────────────────────────────────

export interface RetornoSEFAZ {
  cStat: string;
  xMotivo: string;
  protocolo?: string;
  dhRecbto?: string;
  xmlAutorizado?: string;
  infProt?: string;
}

/**
 * Envia o XML assinado para a SEFAZ via SOAP (lote síncrono)
 */
export async function enviarParaSEFAZ(
  xmlAssinado: string,
  ambiente: number,
  pfxBuffer: Buffer,
  pfxSenha: string,
  idLote?: string
): Promise<RetornoSEFAZ> {
  const url = getUrl(ambiente, "NFeAutorizacao4");
  const lote = idLote ?? String(Date.now());
  const agente = criarAgenteSEFAZ(pfxBuffer, pfxSenha);

  const nfeDadosMsg = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${lote}</idLote><indSinc>1</indSinc>${xmlAssinado}</enviNFe>`;

  const body = `<nfeAutorizacaoLote4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><nfeDadosMsg>${nfeDadosMsg}</nfeDadosMsg></nfeAutorizacaoLote4>`;

  const envelope = buildSoapEnvelope("http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote", body);

  const responseXml = await soapPost(
    url,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
    envelope,
    agente
  );

  return parsarRetornoAutorizacao(responseXml, xmlAssinado);
}

function parsarRetornoAutorizacao(responseXml: string, xmlAssinado: string): RetornoSEFAZ {
  // Extrair cStat e xMotivo do retorno
  const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);
  const protocoloMatch = responseXml.match(/<nProt>(\d+)<\/nProt>/);
  const dhRecbtoMatch = responseXml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);

  const cStat = cStatMatch?.[1] ?? "999";
  const xMotivo = xMotivoMatch?.[1] ?? "Erro desconhecido";
  const protocolo = protocoloMatch?.[1];
  const dhRecbto = dhRecbtoMatch?.[1];

  if (cStat === "100") {
    // Autorizada — montar XML com protocolo (nfeProc)
    const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
    const chave = chaveMatch?.[1] ?? "";
    const infProtMatch = responseXml.match(/<infProt[^>]*>[\s\S]*?<\/infProt>/);
    const infProt = infProtMatch?.[0] ?? "";

    const xmlAutorizado =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      xmlAssinado.replace(`<?xml version="1.0" encoding="UTF-8"?>`, "").trim() +
      `<protNFe versao="4.00"><infProt>${infProt}</infProt></protNFe>` +
      `</nfeProc>`;

    return { cStat, xMotivo, protocolo, dhRecbto, xmlAutorizado, infProt };
  }

  return { cStat, xMotivo };
}

// ─── Consulta de NF-e ─────────────────────────────────────────────────────────

export interface StatusNFe {
  cStat: string;
  xMotivo: string;
  protocolo?: string;
}

export async function consultarNFe(
  chave: string,
  ambiente: number,
  pfxBuffer: Buffer,
  pfxSenha: string
): Promise<StatusNFe> {
  const url = getUrl(ambiente, "NFeConsultaProtocolo4");
  const agente = criarAgenteSEFAZ(pfxBuffer, pfxSenha);

  const body = `<nfeConsultaNF4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><nfeDadosMsg><consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe></nfeDadosMsg></nfeConsultaNF4>`;

  const envelope = buildSoapEnvelope("", body);
  const responseXml = await soapPost(url, "", envelope, agente);

  const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);
  const protocoloMatch = responseXml.match(/<nProt>(\d+)<\/nProt>/);

  return {
    cStat: cStatMatch?.[1] ?? "999",
    xMotivo: xMotivoMatch?.[1] ?? "Erro desconhecido",
    protocolo: protocoloMatch?.[1]
  };
}

// ─── Cancelamento ─────────────────────────────────────────────────────────────

export interface RetornoCancelamento {
  cStat: string;
  xMotivo: string;
  protocolo?: string;
}

export async function cancelarNFe(
  chave: string,
  protocolo: string,
  justificativa: string,
  pfxBuffer: Buffer,
  senha: string,
  ambiente: number
): Promise<RetornoCancelamento> {
  if (justificativa.length < 15) {
    throw new Error("Justificativa deve ter pelo menos 15 caracteres");
  }

  const url = getUrl(ambiente, "NFeRecepcaoEvento4");
  const dhEvento = new Date().toISOString().slice(0, 19) + "-03:00";
  const nSeqEvento = "1";

  const detEvento = `<detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${justificativa}</xJust></detEvento>`;

  const infEvento = `<infEvento Id="ID110111${chave}${nSeqEvento.padStart(2, "0")}"><cOrgao>91</cOrgao><tpAmb>${ambiente}</tpAmb><CNPJ>${chave.slice(6, 20)}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento>${detEvento}</infEvento>`;

  let eventoXml = `<?xml version="1.0" encoding="UTF-8"?><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote><evento versao="1.00"><infEvento Id="ID110111${chave}${nSeqEvento.padStart(2, "0")}">${infEvento}</infEvento></evento></envEvento>`;

  // Assinar evento
  eventoXml = assinarXml(eventoXml, pfxBuffer, senha);

  const agente = criarAgenteSEFAZ(pfxBuffer, senha);
  const body = `<nfeRecepcaoEvento4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg>${eventoXml}</nfeDadosMsg></nfeRecepcaoEvento4>`;
  const envelope = buildSoapEnvelope("", body);
  const responseXml = await soapPost(url, "", envelope, agente);

  const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);
  const protocoloMatch = responseXml.match(/<nProt>(\d+)<\/nProt>/);

  return {
    cStat: cStatMatch?.[1] ?? "999",
    xMotivo: xMotivoMatch?.[1] ?? "Erro desconhecido",
    protocolo: protocoloMatch?.[1]
  };
}

// ─── Geração de DANFE simplificado em PDF ────────────────────────────────────

export async function gerarDANFE(dados: {
  chaveAcesso: string;
  nNF: number;
  serie: number;
  dhEmi: Date;
  protocolo?: string;
  nomeEmitente: string;
  cnpjEmitente: string;
  ieEmitente: string;
  enderecoEmitente: string;
  nomeDestinatario: string;
  cpfCnpjDestinatario: string;
  enderecoDestinatario: string;
  descricaoProduto: string;
  placa: string;
  renavam?: string;
  chassi?: string;
  valorTotal: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `DANFE NF-e ${dados.nNF}` } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const ML = 15, MT = 15;                 // margens esquerda/topo
      const PW = doc.page.width - ML * 2;     // largura útil ≈ 565pt
      const BK = "#000000";
      const LB = "#888888";

      // helpers
      const box = (x: number, y: number, w: number, h: number) =>
        doc.rect(x, y, w, h).stroke(BK);

      const label = (txt: string, x: number, y: number, w = 200) =>
        doc.font("Helvetica").fontSize(6).fillColor(LB).text(txt, x + 2, y + 2, { width: w - 4, lineBreak: false });

      const value = (txt: string, x: number, y: number, w = 200, opts: object = {}) =>
        doc.font("Helvetica-Bold").fontSize(8).fillColor(BK).text(txt, x + 2, y + 10, { width: w - 4, lineBreak: false, ...opts });

      const cell = (lbl: string, val: string, x: number, y: number, w: number, h: number, opts: object = {}) => {
        box(x, y, w, h);
        label(lbl, x, y, w);
        value(val, x, y, w, opts);
      };

      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 1 — CABEÇALHO (emitente | DANFE | NF-e)
      // ══════════════════════════════════════════════════════════════════════
      let y = MT;
      const H1 = 90;
      const wEmit = Math.round(PW * 0.42);
      const wDanfe = Math.round(PW * 0.16);
      const wNFe = PW - wEmit - wDanfe;

      // Caixa emitente
      box(ML, y, wEmit, H1);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BK)
        .text(dados.nomeEmitente.toUpperCase(), ML + 4, y + 6, { width: wEmit - 8 });
      doc.font("Helvetica").fontSize(7).fillColor(BK)
        .text(dados.enderecoEmitente, ML + 4, y + 22, { width: wEmit - 8 })
        .text(`CNPJ: ${formatDoc(dados.cnpjEmitente)}`, ML + 4, y + 42)
        .text(`IE: ${dados.ieEmitente}`, ML + 4, y + 52);

      // Caixa DANFE central
      const xD = ML + wEmit;
      box(xD, y, wDanfe, H1);
      doc.font("Helvetica-Bold").fontSize(14).fillColor(BK)
        .text("DANFE", xD, y + 8, { width: wDanfe, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(6).fillColor(BK)
        .text("Documento Auxiliar da", xD, y + 26, { width: wDanfe, align: "center", lineBreak: false })
        .text("Nota Fiscal Eletrônica", xD, y + 33, { width: wDanfe, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(7).fillColor(BK)
        .text("0 - ENTRADA", xD + 4, y + 48)
        .text("1 - SAÍDA", xD + 4, y + 58);
      // quadrado marcado
      doc.rect(xD + 4, y + 56, 8, 8).stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor(BK).text("1", xD + 6, y + 57);

      // Caixa NF-e
      const xN = xD + wDanfe;
      box(xN, y, wNFe, H1);
      label("NF-e", xN, y, wNFe);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(BK)
        .text(`Nº ${String(dados.nNF).padStart(9, "0")}`, xN + 2, y + 12, { width: wNFe - 4, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(BK)
        .text(`Série: ${dados.serie}`, xN + 2, y + 28, { width: wNFe - 4, align: "center", lineBreak: false });
      const dtEmi = dados.dhEmi.toLocaleDateString("pt-BR");
      const hrEmi = dados.dhEmi.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      doc.font("Helvetica").fontSize(7).fillColor(BK)
        .text(`Emissão: ${dtEmi}  ${hrEmi}`, xN + 4, y + 42);
      if (dados.protocolo) {
        doc.font("Helvetica").fontSize(6).fillColor(BK)
          .text(`Protocolo: ${dados.protocolo}`, xN + 4, y + 56, { width: wNFe - 8 });
      } else {
        doc.font("Helvetica").fontSize(6).fillColor("#CC0000")
          .text("SEM PROTOCOLO - NÃO AUTORIZADA", xN + 4, y + 56, { width: wNFe - 8 });
      }

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 2 — CHAVE DE ACESSO
      // ══════════════════════════════════════════════════════════════════════
      y += H1;
      const H2 = 28;
      box(ML, y, PW, H2);
      label("CHAVE DE ACESSO", ML, y, PW);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(BK)
        .text(formatChave(dados.chaveAcesso), ML + 2, y + 12, { width: PW - 4, align: "center", characterSpacing: 1 });

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 3 — NATUREZA DA OPERAÇÃO / PROTOCOLO
      // ══════════════════════════════════════════════════════════════════════
      y += H2;
      const H3 = 24;
      const wNat = Math.round(PW * 0.6);
      const wProt = PW - wNat;
      cell("NATUREZA DA OPERAÇÃO", "SAÍDA DE VEÍCULO - VENDA", ML, y, wNat, H3);
      cell("PROTOCOLO DE AUTORIZAÇÃO DE USO", dados.protocolo ?? "PENDENTE", ML + wNat, y, wProt, H3);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 4 — DADOS DO EMITENTE (IE, CNPJ, CRT)
      // ══════════════════════════════════════════════════════════════════════
      y += H3;
      const H4 = 22;
      const w4 = Math.round(PW / 3);
      cell("INSCRIÇÃO ESTADUAL", dados.ieEmitente, ML, y, w4, H4);
      cell("CNPJ", formatDoc(dados.cnpjEmitente), ML + w4, y, w4, H4);
      cell("CRT", "1 - Simples Nacional", ML + w4 * 2, y, PW - w4 * 2, H4);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 5 — DESTINATÁRIO
      // ══════════════════════════════════════════════════════════════════════
      y += H4;
      // Header strip
      box(ML, y, PW, 14);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text("DESTINATÁRIO / REMETENTE", ML + 2, y + 3);
      y += 14;

      const H5a = 22, H5b = 22;
      const wNome = Math.round(PW * 0.55);
      const wCpf = Math.round(PW * 0.28);
      const wDt = PW - wNome - wCpf;
      cell("NOME / RAZÃO SOCIAL", dados.nomeDestinatario.toUpperCase(), ML, y, wNome, H5a);
      cell("CPF / CNPJ", formatDoc(dados.cpfCnpjDestinatario), ML + wNome, y, wCpf, H5a);
      cell("DATA DE EMISSÃO", dtEmi, ML + wNome + wCpf, y, wDt, H5a);
      y += H5a;

      cell("ENDEREÇO", dados.enderecoDestinatario || "—", ML, y, Math.round(PW * 0.5), H5b);
      cell("MUNICÍPIO", "Rio de Janeiro", ML + Math.round(PW * 0.5), y, Math.round(PW * 0.25), H5b);
      cell("UF", "RJ", ML + Math.round(PW * 0.75), y, Math.round(PW * 0.1), H5b);
      cell("CEP", "—", ML + Math.round(PW * 0.85), y, PW - Math.round(PW * 0.85), H5b);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 6 — CÁLCULO DO IMPOSTO
      // ══════════════════════════════════════════════════════════════════════
      y += H5b;
      box(ML, y, PW, 14);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text("CÁLCULO DO IMPOSTO", ML + 2, y + 3);
      y += 14;

      const H6 = 22;
      const iw = Math.round(PW / 6);
      cell("BASE CÁLC. ICMS", "0,00", ML, y, iw, H6, { align: "right" });
      cell("VALOR ICMS", "0,00", ML + iw, y, iw, H6, { align: "right" });
      cell("BASE CÁLC. ICMS-ST", "0,00", ML + iw * 2, y, iw, H6, { align: "right" });
      cell("VALOR ICMS-ST", "0,00", ML + iw * 3, y, iw, H6, { align: "right" });
      cell("VALOR IPI", "0,00", ML + iw * 4, y, iw, H6, { align: "right" });
      cell("VALOR TOTAL NF", `R$ ${fmt(dados.valorTotal)}`, ML + iw * 5, y, PW - iw * 5, H6, { align: "right" });
      y += H6;

      const iw2 = Math.round(PW / 5);
      cell("VALOR DO FRETE", "0,00", ML, y, iw2, H6, { align: "right" });
      cell("VALOR DO SEGURO", "0,00", ML + iw2, y, iw2, H6, { align: "right" });
      cell("DESCONTO", "0,00", ML + iw2 * 2, y, iw2, H6, { align: "right" });
      cell("OUTRAS DESP. ACESS.", "0,00", ML + iw2 * 3, y, iw2, H6, { align: "right" });
      cell("VALOR TOTAL DOS PRODUTOS", `R$ ${fmt(dados.valorTotal)}`, ML + iw2 * 4, y, PW - iw2 * 4, H6, { align: "right" });

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 7 — TRANSPORTADOR / VOLUMES
      // ══════════════════════════════════════════════════════════════════════
      y += H6;
      box(ML, y, PW, 14);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text("TRANSPORTADOR / VOLUMES TRANSPORTADOS", ML + 2, y + 3);
      y += 14;

      const H7 = 22;
      const wT1 = Math.round(PW * 0.4), wT2 = Math.round(PW * 0.15), wT3 = Math.round(PW * 0.15);
      cell("RAZÃO SOCIAL", "A CARGO DO DESTINATÁRIO", ML, y, wT1, H7);
      cell("FRETE POR CONTA", "9 - Sem Frete", ML + wT1, y, wT2, H7);
      cell("CÓDIGO ANTT", "—", ML + wT1 + wT2, y, wT3, H7);
      cell("PLACA DO VEÍCULO", dados.placa, ML + wT1 + wT2 + wT3, y, PW - wT1 - wT2 - wT3, H7);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 8 — DADOS DOS PRODUTOS / SERVIÇOS
      // ══════════════════════════════════════════════════════════════════════
      y += H7;
      box(ML, y, PW, 14);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text("DADOS DOS PRODUTOS / SERVIÇOS", ML + 2, y + 3);
      y += 14;

      // Colunas da tabela de produtos
      const tCols = [
        { label: "CÓD.", w: 52 },
        { label: "DESCRIÇÃO DO PRODUTO / SERVIÇO", w: 155 },
        { label: "NCM/SH", w: 44 },
        { label: "CST", w: 28 },
        { label: "CFOP", w: 30 },
        { label: "UN", w: 20 },
        { label: "QTD.", w: 28 },
        { label: "VL. UNIT.", w: 48 },
        { label: "VL. TOTAL", w: 55 },
        { label: "BC ICMS", w: 40 },
        { label: "VL. ICMS", w: 40 },
        { label: "VL. IPI", w: 30 }
      ];
      const totalW = tCols.reduce((s, c) => s + c.w, 0);
      // Ajusta última coluna para fechar exatamente
      tCols[tCols.length - 1].w += PW - totalW;

      // Header da tabela
      const HT = 16;
      let xc = ML;
      tCols.forEach(col => {
        box(xc, y, col.w, HT);
        doc.font("Helvetica").fontSize(5.5).fillColor(LB)
          .text(col.label, xc + 1, y + 2, { width: col.w - 2, lineBreak: false });
        xc += col.w;
      });
      y += HT;

      // Linha do produto
      const HR = 22;
      const rowVals = [
        dados.placa,
        dados.descricaoProduto.slice(0, 45),
        "87032310",
        "102",
        "5114",
        "UN",
        "1",
        fmt(dados.valorTotal),
        fmt(dados.valorTotal),
        "0,00",
        "0,00",
        "0,00"
      ];
      xc = ML;
      tCols.forEach((col, i) => {
        box(xc, y, col.w, HR);
        doc.font("Helvetica").fontSize(7).fillColor(BK)
          .text(rowVals[i], xc + 2, y + 5, { width: col.w - 4, lineBreak: false });
        xc += col.w;
      });
      y += HR;

      // Linha de infos complementares do veículo
      if (dados.renavam || dados.chassi) {
        const HR2 = 16;
        box(ML, y, PW, HR2);
        const extra = [
          dados.renavam ? `RENAVAM: ${dados.renavam}` : "",
          dados.chassi ? `CHASSI: ${dados.chassi}` : ""
        ].filter(Boolean).join("   ");
        doc.font("Helvetica").fontSize(6.5).fillColor(LB)
          .text(extra, ML + 4, y + 4, { width: PW - 8, lineBreak: false });
        y += HR2;
      }

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO 9 — DADOS ADICIONAIS
      // ══════════════════════════════════════════════════════════════════════
      y += 4;
      box(ML, y, PW, 14);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text("DADOS ADICIONAIS", ML + 2, y + 3);
      y += 14;

      const H9 = 55;
      const wDadosAdd = Math.round(PW * 0.65);
      const wFisco = PW - wDadosAdd;
      box(ML, y, wDadosAdd, H9);
      box(ML + wDadosAdd, y, wFisco, H9);
      label("INFORMAÇÕES COMPLEMENTARES", ML, y, wDadosAdd);
      label("RESERVADO AO FISCO", ML + wDadosAdd, y, wFisco);

      const infComp = [
        `Nota Fiscal emitida por VitrineAuto v1.0`,
        dados.protocolo ? `Autorizada pelo SEFAZ em ${dtEmi}` : `Ambiente de HOMOLOGAÇÃO - SEM VALOR FISCAL`,
        dados.placa ? `Placa: ${dados.placa}` : "",
        dados.chassi ? `Chassi: ${dados.chassi}` : ""
      ].filter(Boolean).join("\n");

      doc.font("Helvetica").fontSize(6.5).fillColor(BK)
        .text(infComp, ML + 2, y + 12, { width: wDadosAdd - 6, lineBreak: true });

      // ══════════════════════════════════════════════════════════════════════
      // RODAPÉ
      // ══════════════════════════════════════════════════════════════════════
      const yRodape = doc.page.height - 22;
      doc.font("Helvetica").fontSize(6).fillColor(LB)
        .text(
          "DANFE - Documento Auxiliar da NF-e — Consulte a autenticidade em https://www.nfe.fazenda.gov.br",
          ML, yRodape, { width: PW, align: "center", lineBreak: false }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function formatChave(chave: string): string {
  return chave.replace(/(\d{4})/g, "$1 ").trim();
}

// ─── Status do serviço SEFAZ ─────────────────────────────────────────────────

export async function consultarStatusServico(
  ambiente: number,
  cUF: number,
  pfxBuffer: Buffer,
  pfxSenha: string
): Promise<{ cStat: string; xMotivo: string }> {
  const url = getUrl(ambiente, "NFeStatusServico4");
  const agente = criarAgenteSEFAZ(pfxBuffer, pfxSenha);

  const body = `<nfeStatusServicoNF4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><nfeDadosMsg><consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></nfeStatusServicoNF4>`;

  const envelope = buildSoapEnvelope("", body);
  const responseXml = await soapPost(url, "", envelope, agente);

  const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);

  return {
    cStat: cStatMatch?.[1] ?? "999",
    xMotivo: xMotivoMatch?.[1] ?? "Indisponível"
  };
}
