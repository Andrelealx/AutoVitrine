import crypto from "crypto";
import https from "https";
import forge from "node-forge";
import axios from "axios";
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
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
  // Gera barcode Code128 da chave de acesso
  let barcodePng: Buffer | null = null;
  try {
    barcodePng = await bwipjs.toBuffer({
      bcid: "code128",
      text: dados.chaveAcesso,
      scale: 2,
      height: 8,
      includetext: false
    });
  } catch { /* sem barcode se falhar */ }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `DANFE NF-e ${dados.nNF}` } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const ML = 10;
      const PW = doc.page.width - ML * 2;  // ≈ 575pt
      const BK = "#000000";
      const LB = "#555555";

      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const dtEmi = dados.dhEmi.toLocaleDateString("pt-BR");
      const hrEmi = dados.dhEmi.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const nNFstr = String(dados.nNF).padStart(9, "0");
      const nNFfmt = nNFstr.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");

      const box = (x: number, y: number, w: number, h: number) =>
        doc.rect(x, y, w, h).lineWidth(0.5).stroke(BK);

      const lbl = (txt: string, x: number, y: number, w: number) =>
        doc.font("Helvetica").fontSize(5.5).fillColor(LB)
          .text(txt, x + 2, y + 2, { width: w - 4, lineBreak: false });

      const val = (txt: string, x: number, y: number, w: number, size = 7.5, opts: object = {}) =>
        doc.font("Helvetica-Bold").fontSize(size).fillColor(BK)
          .text(txt, x + 2, y + 11, { width: w - 4, lineBreak: false, ...opts });

      const cell = (label: string, value: string, x: number, y: number, w: number, h: number, vSize = 7.5, vOpts: object = {}) => {
        box(x, y, w, h);
        lbl(label, x, y, w);
        val(value, x, y, w, vSize, vOpts);
      };

      // ══════════════════════════════════════════════════════════════════════
      // TIRA DE RECEBIMENTO (topo destacável)
      // ══════════════════════════════════════════════════════════════════════
      let y = 8;
      const HTira = 36;
      box(ML, y, PW - 70, HTira);
      doc.font("Helvetica").fontSize(6).fillColor(BK)
        .text(
          `RECEBEMOS DE ${dados.nomeEmitente.toUpperCase()} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ${dtEmi}  VALOR TOTAL: R$ ${fmt(dados.valorTotal)}`,
          ML + 2, y + 3, { width: PW - 74, lineBreak: true }
        )
        .text(`DESTINATÁRIO: ${dados.nomeDestinatario}`, ML + 2, y + 21, { width: PW - 74, lineBreak: false });
      // caixa NF-e na tira
      const xTiraNF = ML + PW - 70;
      box(xTiraNF, y, 60, HTira);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text("NF-e", xTiraNF + 2, y + 3, { width: 56, align: "center" })
        .text(`Nº. ${nNFfmt}`, xTiraNF + 2, y + 13, { width: 56, align: "center" })
        .text(`Série ${String(dados.serie).padStart(3, "0")}`, xTiraNF + 2, y + 23, { width: 56, align: "center" });

      // linha tracejada separadora
      y += HTira + 2;
      doc.moveTo(ML, y).lineTo(ML + PW, y).dash(3, { space: 3 }).lineWidth(0.5).stroke("#999999");
      doc.undash();
      y += 4;

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO A — CABEÇALHO PRINCIPAL
      // Emitente (35%) | DANFE (22%) | NF/Chave/Barcode (43%)
      // ══════════════════════════════════════════════════════════════════════
      const HA = 95;
      const wE = Math.round(PW * 0.35);
      const wD = Math.round(PW * 0.22);
      const wR = PW - wE - wD;

      // — Emitente
      box(ML, y, wE, HA);
      doc.font("Helvetica").fontSize(6).fillColor(LB)
        .text("IDENTIFICAÇÃO DO EMITENTE", ML + 2, y + 2, { width: wE - 4 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BK)
        .text(dados.nomeEmitente.toUpperCase(), ML + 4, y + 14, { width: wE - 8 });
      doc.font("Helvetica").fontSize(7).fillColor(BK)
        .text(dados.enderecoEmitente, ML + 4, y + 42, { width: wE - 8 })
        .text(`CNPJ: ${formatDoc(dados.cnpjEmitente)}`, ML + 4, y + 64)
        .text(`IE: ${dados.ieEmitente}`, ML + 4, y + 74);

      // — Bloco DANFE central
      const xD = ML + wE;
      box(xD, y, wD, HA);
      doc.font("Helvetica-Bold").fontSize(16).fillColor(BK)
        .text("DANFE", xD, y + 6, { width: wD, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(6).fillColor(BK)
        .text("Documento Auxiliar da", xD, y + 26, { width: wD, align: "center", lineBreak: false })
        .text("Nota Fiscal Eletrônica", xD, y + 33, { width: wD, align: "center", lineBreak: false });
      // entrada/saída
      doc.font("Helvetica").fontSize(6.5).fillColor(BK)
        .text("0 - ENTRADA", xD + 6, y + 50)
        .text("1 - SAÍDA", xD + 6, y + 60);
      doc.rect(xD + wD - 16, y + 55, 10, 10).lineWidth(0.5).stroke(BK);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BK)
        .text("1", xD + wD - 13, y + 56, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
        .text(`Nº. ${nNFfmt}`, xD, y + 76, { width: wD, align: "center", lineBreak: false })
        .text(`Série ${String(dados.serie).padStart(3, "0")}`, xD, y + 86, { width: wD, align: "center", lineBreak: false });

      // — Bloco direito: chave + barcode + protocolo
      const xR = xD + wD;
      box(xR, y, wR, HA);
      lbl("CHAVE DE ACESSO", xR, y, wR);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text(formatChave(dados.chaveAcesso), xR + 2, y + 13, { width: wR - 4, align: "center", characterSpacing: 0.5, lineBreak: false });
      // barcode
      if (barcodePng) {
        doc.image(barcodePng, xR + 4, y + 24, { width: wR - 8, height: 22 });
      }
      doc.font("Helvetica").fontSize(5.5).fillColor(LB)
        .text("Consulta de autenticidade no portal nacional da NF-e", xR + 2, y + 49, { width: wR - 4, align: "center", lineBreak: false })
        .text("www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora", xR + 2, y + 56, { width: wR - 4, align: "center", lineBreak: false });
      lbl("PROTOCOLO DE AUTORIZAÇÃO DE USO", xR, y + 62, wR);
      if (dados.protocolo) {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(BK)
          .text(`${dados.protocolo} - ${dtEmi} ${hrEmi}`, xR + 2, y + 74, { width: wR - 4, lineBreak: false });
      } else {
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#CC0000")
          .text("NÃO AUTORIZADA - SEM VALOR FISCAL", xR + 2, y + 74, { width: wR - 4, lineBreak: false });
      }

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO B — NATUREZA / IE / CNPJ
      // ══════════════════════════════════════════════════════════════════════
      y += HA;
      const HB = 20;
      const wNat = Math.round(PW * 0.55);
      const wProt = PW - wNat;
      cell("NATUREZA DA OPERAÇÃO", "SAÍDA DE VEÍCULO", ML, y, wNat, HB);
      cell("PROTOCOLO DE AUTORIZAÇÃO DE USO", dados.protocolo ?? "PENDENTE", ML + wNat, y, wProt, HB);
      y += HB;

      const wIE = Math.round(PW * 0.35);
      const wIEST = Math.round(PW * 0.25);
      const wCNPJ = PW - wIE - wIEST;
      cell("INSCRIÇÃO ESTADUAL", dados.ieEmitente, ML, y, wIE, HB);
      cell("INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.", "", ML + wIE, y, wIEST, HB);
      cell("CNPJ/CPF", formatDoc(dados.cnpjEmitente), ML + wIE + wIEST, y, wCNPJ, HB);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO C — DESTINATÁRIO / REMETENTE
      // ══════════════════════════════════════════════════════════════════════
      y += HB;
      box(ML, y, PW, 11);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text("DESTINATÁRIO / REMETENTE", ML + 2, y + 2, { lineBreak: false });
      y += 11;

      const HC = 19;
      const wNome = Math.round(PW * 0.55);
      const wCpf  = Math.round(PW * 0.28);
      const wDtEmi = PW - wNome - wCpf;
      cell("NOME / RAZÃO SOCIAL", dados.nomeDestinatario.toUpperCase(), ML, y, wNome, HC);
      cell("CNPJ / CPF", formatDoc(dados.cpfCnpjDestinatario), ML + wNome, y, wCpf, HC);
      cell("DATA DA EMISSÃO", dtEmi, ML + wNome + wCpf, y, wDtEmi, HC);
      y += HC;

      const wEnd = Math.round(PW * 0.45);
      const wBai = Math.round(PW * 0.22);
      const wCep = Math.round(PW * 0.14);
      const wDtSai = PW - wEnd - wBai - wCep;
      cell("ENDEREÇO", dados.enderecoDestinatario || "—", ML, y, wEnd, HC);
      cell("BAIRRO / DISTRITO", "—", ML + wEnd, y, wBai, HC);
      cell("CEP", "—", ML + wEnd + wBai, y, wCep, HC);
      cell("DATA DA SAÍDA/ENTRADA", dtEmi, ML + wEnd + wBai + wCep, y, wDtSai, HC);
      y += HC;

      const wMun = Math.round(PW * 0.4);
      const wUF  = Math.round(PW * 0.06);
      const wFone = Math.round(PW * 0.2);
      const wIEDest = Math.round(PW * 0.2);
      const wHrSai = PW - wMun - wUF - wFone - wIEDest;
      cell("MUNICÍPIO", "—", ML, y, wMun, HC);
      cell("UF", "—", ML + wMun, y, wUF, HC);
      cell("FONE / FAX", "—", ML + wMun + wUF, y, wFone, HC);
      cell("INSCRIÇÃO ESTADUAL", "—", ML + wMun + wUF + wFone, y, wIEDest, HC);
      cell("HORA DA SAÍDA/ENTRADA", hrEmi, ML + wMun + wUF + wFone + wIEDest, y, wHrSai, HC);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO D — FATURA / DUPLICATA
      // ══════════════════════════════════════════════════════════════════════
      y += HC;
      const HD = 22;
      box(ML, y, PW, 11);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text("FATURA / DUPLICATA", ML + 2, y + 2, { lineBreak: false });
      y += 11;
      box(ML, y, Math.round(PW * 0.25), HD - 11);
      doc.font("Helvetica").fontSize(6.5).fillColor(BK)
        .text(`Pgto. Outros`, ML + 4, y + 3)
        .text(`Valor  R$ ${fmt(dados.valorTotal)}`, ML + 4, y + 11);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO E — CÁLCULO DO IMPOSTO (2 linhas, 9+8 colunas como padrão)
      // ══════════════════════════════════════════════════════════════════════
      y += HD - 11;
      box(ML, y, PW, 11);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text("CÁLCULO DO IMPOSTO", ML + 2, y + 2, { lineBreak: false });
      y += 11;

      const HE = 19;
      // Linha 1: 9 colunas
      const e1 = [
        { l: "BASE DE CÁLC. DO ICMS",    v: "0,00" },
        { l: "VALOR DO ICMS",            v: "0,00" },
        { l: "BASE DE CÁLC. ICMS S.T.",  v: "0,00" },
        { l: "VALOR DO ICMS SUBST.",     v: "0,00" },
        { l: "V. IMP. IMPORTAÇÃO",       v: "0,00" },
        { l: "V. ICMS UF REMET.",        v: "0,00" },
        { l: "VALOR DO FCP",             v: "0,00" },
        { l: "VALOR DO PIS",             v: "0,00" },
        { l: "V. TOTAL PRODUTOS",        v: fmt(dados.valorTotal) }
      ];
      const ew1 = Math.floor(PW / e1.length);
      let xc = ML;
      e1.forEach((c, i) => {
        const w = i === e1.length - 1 ? PW - (ew1 * (e1.length - 1)) : ew1;
        cell(c.l, c.v, xc, y, w, HE, 7, { align: "right" });
        xc += w;
      });
      y += HE;

      // Linha 2: 8 colunas
      const e2 = [
        { l: "VALOR DO FRETE",     v: "0,00" },
        { l: "VALOR DO SEGURO",    v: "0,00" },
        { l: "DESCONTO",           v: "0,00" },
        { l: "OUTRAS DESPESAS",    v: "0,00" },
        { l: "VALOR TOTAL IPI",    v: "0,00" },
        { l: "V. ICMS UF DEST.",   v: "0,00" },
        { l: "VALOR DA COFINS",    v: "0,00" },
        { l: "V. TOTAL DA NOTA",   v: fmt(dados.valorTotal) }
      ];
      const ew2 = Math.floor(PW / e2.length);
      xc = ML;
      e2.forEach((c, i) => {
        const w = i === e2.length - 1 ? PW - (ew2 * (e2.length - 1)) : ew2;
        cell(c.l, c.v, xc, y, w, HE, 7, { align: "right" });
        xc += w;
      });

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO F — TRANSPORTADOR / VOLUMES
      // ══════════════════════════════════════════════════════════════════════
      y += HE;
      box(ML, y, PW, 11);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text("TRANSPORTADOR / VOLUMES TRANSPORTADOS", ML + 2, y + 2, { lineBreak: false });
      y += 11;

      const HF = 19;
      const wTR = Math.round(PW * 0.38), wTF = Math.round(PW * 0.16),
            wTA = Math.round(PW * 0.14), wTP = Math.round(PW * 0.14),
            wTU = Math.round(PW * 0.06), wTC = PW - wTR - wTF - wTA - wTP - wTU;
      cell("NOME / RAZÃO SOCIAL", "", ML, y, wTR, HF);
      cell("FRETE POR CONTA", "9 - Sem Ocorrência de Transporte", ML + wTR, y, wTF, HF, 6);
      cell("CÓDIGO ANTT", "", ML + wTR + wTF, y, wTA, HF);
      cell("PLACA DO VEÍCULO", dados.placa, ML + wTR + wTF + wTA, y, wTP, HF);
      cell("UF", "", ML + wTR + wTF + wTA + wTP, y, wTU, HF);
      cell("CNPJ / CPF", "", ML + wTR + wTF + wTA + wTP + wTU, y, wTC, HF);
      y += HF;

      const wTEnd = Math.round(PW * 0.45), wTMun = Math.round(PW * 0.3),
            wTUF2 = Math.round(PW * 0.06), wTIE = PW - wTEnd - wTMun - wTUF2;
      cell("ENDEREÇO", "", ML, y, wTEnd, HF);
      cell("MUNICÍPIO", "", ML + wTEnd, y, wTMun, HF);
      cell("UF", "", ML + wTEnd + wTMun, y, wTUF2, HF);
      cell("INSCRIÇÃO ESTADUAL", "", ML + wTEnd + wTMun + wTUF2, y, wTIE, HF);
      y += HF;

      const wTQ = Math.round(PW * 0.12), wTEs = Math.round(PW * 0.18),
            wTM = Math.round(PW * 0.18), wTN = Math.round(PW * 0.18),
            wTPB = Math.round(PW * 0.17), wTPL = PW - wTQ - wTEs - wTM - wTN - wTPB;
      cell("QUANTIDADE", "", ML, y, wTQ, HF);
      cell("ESPÉCIE", "", ML + wTQ, y, wTEs, HF);
      cell("MARCA", "", ML + wTQ + wTEs, y, wTM, HF);
      cell("NUMERAÇÃO", "", ML + wTQ + wTEs + wTM, y, wTN, HF);
      cell("PESO BRUTO", "", ML + wTQ + wTEs + wTM + wTN, y, wTPB, HF);
      cell("PESO LÍQUIDO", "", ML + wTQ + wTEs + wTM + wTN + wTPB, y, wTPL, HF);

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO G — DADOS DOS PRODUTOS / SERVIÇOS
      // ══════════════════════════════════════════════════════════════════════
      y += HF;
      box(ML, y, PW, 11);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text("DADOS DOS PRODUTOS / SERVIÇOS", ML + 2, y + 2, { lineBreak: false });
      y += 11;

      const tCols = [
        { l: "CÓD.PROD.", w: 42 },
        { l: "DESCRIÇÃO DO PRODUTO / SERVIÇO", w: 140 },
        { l: "NCM/SH", w: 38 },
        { l: "CST /\nCSOSN", w: 26 },
        { l: "CFOP", w: 26 },
        { l: "UN", w: 18 },
        { l: "QUANT.", w: 30 },
        { l: "V.UNIT.", w: 42 },
        { l: "V.DESC.", w: 34 },
        { l: "VALOR\nTOTAL", w: 42 },
        { l: "B.CÁLC\nICMS", w: 34 },
        { l: "V.ICMS", w: 30 },
        { l: "V.IPI", w: 26 },
        { l: "ALÍQ.\nICMS", w: 24 },
        { l: "ALÍQ.\nIPI", w: 0 }  // última, será ajustada
      ];
      const twFixed = tCols.slice(0, -1).reduce((s, c) => s + c.w, 0);
      tCols[tCols.length - 1].w = PW - twFixed;

      const HT = 16;
      xc = ML;
      tCols.forEach(col => {
        box(xc, y, col.w, HT);
        doc.font("Helvetica").fontSize(5).fillColor(LB)
          .text(col.l, xc + 1, y + 2, { width: col.w - 2, lineBreak: true, height: HT - 2 });
        xc += col.w;
      });
      y += HT;

      const HR = 24;
      const rowVals = [
        dados.placa,
        dados.descricaoProduto.slice(0, 50),
        "87032310",
        "0102",
        "5114",
        "UN",
        "1,00",
        fmt(dados.valorTotal),
        "0,00",
        fmt(dados.valorTotal),
        "0,00",
        "0,00",
        "0,00",
        "0,00",
        "0,00"
      ];
      xc = ML;
      tCols.forEach((col, i) => {
        box(xc, y, col.w, HR);
        doc.font("Helvetica").fontSize(6.5).fillColor(BK)
          .text(rowVals[i], xc + 2, y + 6, { width: col.w - 4, lineBreak: false });
        xc += col.w;
      });
      y += HR;

      // ══════════════════════════════════════════════════════════════════════
      // BLOCO H — DADOS ADICIONAIS
      // ══════════════════════════════════════════════════════════════════════
      y += 2;
      box(ML, y, PW, 11);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BK)
        .text("DADOS ADICIONAIS", ML + 2, y + 2, { lineBreak: false });
      y += 11;

      const HH = 60;
      const wInf = Math.round(PW * 0.65);
      const wFis = PW - wInf;
      box(ML, y, wInf, HH);
      box(ML + wInf, y, wFis, HH);
      lbl("INFORMAÇÕES COMPLEMENTARES", ML, y, wInf);
      lbl("RESERVADO AO FISCO", ML + wInf, y, wFis);

      const infParts = [
        `Nota Fiscal emitida por VitrineAuto v1.0`,
        dados.protocolo
          ? `Autorizada pelo SEFAZ - Protocolo: ${dados.protocolo}`
          : `Ambiente de HOMOLOGAÇÃO - Sem valor fiscal.`,
        dados.renavam ? `RENAVAM: ${dados.renavam}` : null,
        dados.chassi  ? `CHASSI: ${dados.chassi}` : null
      ].filter(Boolean).join(" / ");

      doc.font("Helvetica").fontSize(6.5).fillColor(BK)
        .text(infParts, ML + 2, y + 11, { width: wInf - 6, lineBreak: true });

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
