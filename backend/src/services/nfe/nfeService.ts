import crypto from "crypto";
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

async function soapPost(url: string, soapAction: string, envelope: string): Promise<string> {
  const response = await axios.post(url, envelope, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction
    },
    timeout: 30000,
    maxBodyLength: Infinity
  });
  return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
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
  idLote?: string
): Promise<RetornoSEFAZ> {
  const url = getUrl(ambiente, "NFeAutorizacao4");
  const lote = idLote ?? String(Date.now());

  const nfeDadosMsg = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${lote}</idLote><indSinc>1</indSinc>${xmlAssinado}</enviNFe>`;

  const body = `<nfeAutorizacaoLote4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><nfeDadosMsg>${nfeDadosMsg}</nfeDadosMsg></nfeAutorizacaoLote4>`;

  const envelope = buildSoapEnvelope("http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote", body);

  const responseXml = await soapPost(
    url,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
    envelope
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

export async function consultarNFe(chave: string, ambiente: number): Promise<StatusNFe> {
  const url = getUrl(ambiente, "NFeConsultaProtocolo4");

  const body = `<nfeConsultaNF4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><nfeDadosMsg><consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe></nfeDadosMsg></nfeConsultaNF4>`;

  const envelope = buildSoapEnvelope("", body);
  const responseXml = await soapPost(url, "", envelope);

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

  const body = `<nfeRecepcaoEvento4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg>${eventoXml}</nfeDadosMsg></nfeRecepcaoEvento4>`;
  const envelope = buildSoapEnvelope("", body);
  const responseXml = await soapPost(url, "", envelope);

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
      const doc = new PDFDocument({
        size: "A4",
        margin: 20,
        info: { Title: `DANFE NF-e ${dados.nNF}` }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W = doc.page.width;
      const gray = "#333333";
      const light = "#666666";

      // ── Cabeçalho ──────────────────────────────────────────────────────────
      doc.rect(20, 20, W - 40, 80).stroke();

      doc.fontSize(16).fillColor(gray).text("DANFE", 30, 30);
      doc.fontSize(9).fillColor(light)
        .text("Documento Auxiliar da Nota Fiscal Eletrônica", 30, 50);
      doc.fontSize(8)
        .text("Entrada: [ ]  Saída: [x]", 30, 65);

      // Caixa NF-e número e série
      doc.rect(W - 200, 20, 180, 80).stroke();
      doc.fontSize(8).fillColor(gray)
        .text("NF-e", W - 190, 30)
        .text(`Nº ${String(dados.nNF).padStart(9, "0")}`, W - 190, 42)
        .text(`Série ${dados.serie}`, W - 190, 54);

      if (dados.protocolo) {
        doc.fontSize(7).fillColor(light)
          .text(`Protocolo: ${dados.protocolo}`, W - 190, 66)
          .text(`Data: ${dados.dhEmi.toLocaleDateString("pt-BR")}`, W - 190, 78);
      }

      // ── Emitente ───────────────────────────────────────────────────────────
      let y = 115;
      doc.rect(20, y, W - 40, 1).fill(gray);
      y += 8;

      doc.fontSize(9).fillColor(gray).text("EMITENTE", 30, y, { underline: true });
      y += 15;
      doc.fontSize(8).fillColor(gray)
        .text(dados.nomeEmitente, 30, y)
        .text(`CNPJ: ${formatDoc(dados.cnpjEmitente)}   IE: ${dados.ieEmitente}`, 30, y + 12)
        .text(dados.enderecoEmitente, 30, y + 24);

      // ── Destinatário ───────────────────────────────────────────────────────
      y += 55;
      doc.rect(20, y, W - 40, 1).fill(gray);
      y += 8;

      doc.fontSize(9).fillColor(gray).text("DESTINATÁRIO / REMETENTE", 30, y, { underline: true });
      y += 15;
      doc.fontSize(8).fillColor(gray)
        .text(dados.nomeDestinatario, 30, y)
        .text(`CPF/CNPJ: ${formatDoc(dados.cpfCnpjDestinatario)}`, 30, y + 12)
        .text(dados.enderecoDestinatario, 30, y + 24);

      // ── Produto / Serviço ─────────────────────────────────────────────────
      y += 55;
      doc.rect(20, y, W - 40, 1).fill(gray);
      y += 8;

      doc.fontSize(9).fillColor(gray).text("DADOS DOS PRODUTOS / SERVIÇOS", 30, y, { underline: true });
      y += 15;

      // Cabeçalho da tabela
      doc.fontSize(7).fillColor(light);
      const cols = [30, 200, 310, 380, 450, 510];
      const headers = ["CÓDIGO", "DESCRIÇÃO", "NCM", "CFOP", "QTD", "VALOR"];
      headers.forEach((h, i) => doc.text(h, cols[i], y));
      y += 12;
      doc.rect(20, y, W - 40, 0.5).fill(light);
      y += 4;

      // Linha do produto
      doc.fontSize(7).fillColor(gray);
      const vals = [
        dados.placa,
        dados.descricaoProduto.slice(0, 60),
        "87032310",
        "5114",
        "1",
        `R$ ${dados.valorTotal.toFixed(2)}`
      ];
      vals.forEach((v, i) => doc.text(v, cols[i], y));
      y += 20;

      // Informações extras
      if (dados.renavam || dados.chassi) {
        doc.fontSize(7).fillColor(light);
        if (dados.renavam) doc.text(`RENAVAM: ${dados.renavam}`, 30, y);
        if (dados.chassi) doc.text(`CHASSI: ${dados.chassi}`, 200, y);
        y += 15;
      }

      // ── Totais ────────────────────────────────────────────────────────────
      y += 10;
      doc.rect(20, y, W - 40, 1).fill(gray);
      y += 8;

      doc.fontSize(9).fillColor(gray).text("TOTAIS", 30, y, { underline: true });
      y += 15;
      doc.fontSize(10).fillColor(gray)
        .text(`VALOR TOTAL DA NOTA FISCAL: R$ ${dados.valorTotal.toFixed(2).replace(".", ",")}`, 30, y);

      // ── Chave de Acesso ───────────────────────────────────────────────────
      y += 40;
      doc.rect(20, y, W - 40, 1).fill(gray);
      y += 8;

      doc.fontSize(7).fillColor(light)
        .text("CHAVE DE ACESSO", 30, y)
        .text(formatChave(dados.chaveAcesso), 30, y + 12);

      // ── Rodapé ────────────────────────────────────────────────────────────
      doc.fontSize(6).fillColor(light)
        .text(
          "Este documento é uma representação gráfica da NF-e. Consulte a autenticidade em www.nfe.fazenda.gov.br",
          30,
          doc.page.height - 40,
          { align: "center", width: W - 60 }
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

export async function consultarStatusServico(ambiente: number, cUF: number): Promise<{ cStat: string; xMotivo: string }> {
  const url = getUrl(ambiente, "NFeStatusServico4");

  const body = `<nfeStatusServicoNF4 xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><nfeDadosMsg><consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></nfeStatusServicoNF4>`;

  const envelope = buildSoapEnvelope("", body);
  const responseXml = await soapPost(url, "", envelope);

  const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);

  return {
    cStat: cStatMatch?.[1] ?? "999",
    xMotivo: xMotivoMatch?.[1] ?? "Indisponível"
  };
}
