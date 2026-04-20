export interface DadosNFe {
  // Emitente (vem do LojaFiscal)
  cnpjEmitente: string;
  nomeEmitente: string;
  nomeFantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cMun: string;
  xMun: string;
  uf: string;
  cep: string;
  fone: string;
  ie: string;
  crt: number;
  cUF: number;

  // Destinatário
  cpfCnpjDestinatario: string;
  nomeDestinatario: string;
  logradouroDestinatario: string;
  numeroDestinatario: string;
  bairroDestinatario: string;
  cMunDestinatario: string;
  xMunDestinatario: string;
  ufDestinatario: string;
  cepDestinatario: string;
  emailDestinatario?: string;
  indIEDest?: string; // "9" = não contribuinte

  // Veículo / Produto
  placa: string;
  descricao: string;
  renavam?: string;
  chassi?: string;
  valorVenda: number;

  // Controle
  nNF: number;
  serie: number;
  chaveAcesso: string;
  ambiente: number; // 1=produção, 2=homologação
  dhEmi: Date;

  // Pagamento
  tipoPagamento?: string; // "99" = outros, "01" = dinheiro, etc.
}

/**
 * Gera o XML da NF-e sem assinatura digital (apenas o bloco <NFe>)
 */
export function gerarXmlNFe(dados: DadosNFe): string {
  return buildNFeXml(dados);
}

/**
 * Constrói o XML da NF-e de forma imperativa para melhor controle
 */
function buildNFeXml(dados: DadosNFe): string {
  const {
    cUF, dhEmi, nNF, serie, chaveAcesso, ambiente,
    cnpjEmitente, nomeEmitente, nomeFantasia, ie, crt,
    logradouro, numero, bairro, cMun, xMun, uf, cep, fone,
    cpfCnpjDestinatario, nomeDestinatario,
    logradouroDestinatario, numeroDestinatario, bairroDestinatario,
    cMunDestinatario, xMunDestinatario, ufDestinatario, cepDestinatario,
    emailDestinatario, placa, descricao, renavam, chassi, valorVenda,
    tipoPagamento = "99"
  } = dados;

  const dhEmiFormatted = formatarDhEmi(dhEmi, uf);
  const valorStr = valorVenda.toFixed(2);
  const valorUnStr = valorVenda.toFixed(4);

  const docDestinatario = cpfCnpjDestinatario.replace(/\D/g, "");
  const tipoDocDest = docDestinatario.length === 11 ? "CPF" : "CNPJ";

  const cMunF = String(cMun).padStart(7, "0");
  const cMunDestF = String(cMunDestinatario).padStart(7, "0");
  const cepF = cep.replace(/\D/g, "").padStart(8, "0");
  const cepDestF = cepDestinatario.replace(/\D/g, "").padStart(8, "0");
  const cnpjF = cnpjEmitente.replace(/\D/g, "").padStart(14, "0");

  const ibptFederal = (valorVenda * 0.1969).toFixed(2);
  const ibptEstadual = (valorVenda * 0.12).toFixed(2);
  const infCplParts = [
    `Conf. Lei 12.741/2012 Tributacao aprox. R$${ibptFederal} (19.69%) Federal e R$${ibptEstadual} (12.00%) Estadual - Fonte IBPT`,
    `Nao recolhimento do diferencial por forca da ADI 5464`
  ];
  if (renavam) infCplParts.push(`RENAVAM: ${renavam}`);
  if (chassi) infCplParts.push(`CHASSI: ${chassi}`);
  const infCpl = infCplParts.join(" / ");

  const cNF = chaveAcesso.slice(35, 43);
  const cDV = chaveAcesso.slice(43);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="NFe${chaveAcesso}" versao="4.00">
<ide>
<cUF>${cUF}</cUF>
<cNF>${cNF}</cNF>
<natOp>SAIDA DE VEICULO</natOp>
<mod>55</mod>
<serie>${serie}</serie>
<nNF>${nNF}</nNF>
<dhEmi>${dhEmiFormatted}</dhEmi>
<tpNF>1</tpNF>
<idDest>1</idDest>
<cMunFG>${cMunF}</cMunFG>
<tpImp>1</tpImp>
<tpEmis>1</tpEmis>
<cDV>${cDV}</cDV>
<tpAmb>${ambiente}</tpAmb>
<finNFe>1</finNFe>
<indFinal>1</indFinal>
<indPres>1</indPres>
<procEmi>0</procEmi>
<verProc>VitrineAuto 1.0</verProc>
</ide>
<emit>
<CNPJ>${cnpjF}</CNPJ>
<xNome>${esc(nomeEmitente.toUpperCase().slice(0, 60))}</xNome>
<xFant>${esc(nomeFantasia.toUpperCase().slice(0, 60))}</xFant>
<enderEmit>
<xLgr>${esc(logradouro.slice(0, 60))}</xLgr>
<nro>${esc(numero.slice(0, 60))}</nro>
<xBairro>${esc(bairro.slice(0, 60))}</xBairro>
<cMun>${cMunF}</cMun>
<xMun>${esc(xMun.slice(0, 60))}</xMun>
<UF>${uf.toUpperCase()}</UF>
<CEP>${cepF}</CEP>
<cPais>1058</cPais>
<xPais>Brasil</xPais>
<fone>${fone.replace(/\D/g, "").slice(0, 14)}</fone>
</enderEmit>
<IE>${ie.replace(/\D/g, "")}</IE>
<CRT>${crt}</CRT>
</emit>
<dest>
<${tipoDocDest}>${docDestinatario}</${tipoDocDest}>
<xNome>${esc(nomeDestinatario.toUpperCase().slice(0, 60))}</xNome>
<enderDest>
<xLgr>${esc(logradouroDestinatario.slice(0, 60))}</xLgr>
<nro>${esc(numeroDestinatario.slice(0, 60))}</nro>
<xBairro>${esc(bairroDestinatario.slice(0, 60))}</xBairro>
<cMun>${cMunDestF}</cMun>
<xMun>${esc(xMunDestinatario.slice(0, 60))}</xMun>
<UF>${ufDestinatario.toUpperCase()}</UF>
<CEP>${cepDestF}</CEP>
<cPais>1058</cPais>
<xPais>Brasil</xPais>
</enderDest>
<indIEDest>${dados.indIEDest ?? "9"}</indIEDest>${emailDestinatario ? `\n<email>${emailDestinatario.slice(0, 60)}</email>` : ""}
</dest>
<det nItem="1">
<prod>
<cProd>${esc(placa.toUpperCase())}</cProd>
<cEAN>SEM GTIN</cEAN>
<xProd>${esc(descricao.slice(0, 120))}</xProd>
<NCM>87032310</NCM>
<CEST>0100100</CEST>
<CFOP>5114</CFOP>
<uCom>UN</uCom>
<qCom>1.0000</qCom>
<vUnCom>${valorUnStr}</vUnCom>
<vProd>${valorStr}</vProd>
<cEANTrib>SEM GTIN</cEANTrib>
<uTrib>UN</uTrib>
<qTrib>1.0000</qTrib>
<vUnTrib>${valorUnStr}</vUnTrib>
<indTot>1</indTot>
</prod>
<imposto>
<ICMS>
<ICMSSN102>
<orig>0</orig>
<CSOSN>102</CSOSN>
</ICMSSN102>
</ICMS>
<IPI>
<cEnq>999</cEnq>
<IPINT>
<CST>53</CST>
</IPINT>
</IPI>
<PIS>
<PISNT>
<CST>07</CST>
</PISNT>
</PIS>
<COFINS>
<COFINSNT>
<CST>07</CST>
</COFINSNT>
</COFINS>
</imposto>
</det>
<total>
<ICMSTot>
<vBC>0.00</vBC>
<vICMS>0.00</vICMS>
<vICMSDeson>0.00</vICMSDeson>
<vFCP>0.00</vFCP>
<vBCST>0.00</vBCST>
<vST>0.00</vST>
<vFCPST>0.00</vFCPST>
<vFCPSTRet>0.00</vFCPSTRet>
<vProd>${valorStr}</vProd>
<vFrete>0.00</vFrete>
<vSeg>0.00</vSeg>
<vDesc>0.00</vDesc>
<vII>0.00</vII>
<vIPI>0.00</vIPI>
<vIPIDevol>0.00</vIPIDevol>
<vPIS>0.00</vPIS>
<vCOFINS>0.00</vCOFINS>
<vOutro>0.00</vOutro>
<vNF>${valorStr}</vNF>
</ICMSTot>
</total>
<transp>
<modFrete>9</modFrete>
</transp>
<pag>
<detPag>
<tPag>${tipoPagamento}</tPag>
<vPag>${valorStr}</vPag>
</detPag>
</pag>
<infAdic>
<infCpl>${esc(infCpl)}</infCpl>
</infAdic>
</infNFe>
</NFe>`;

  return xml;
}

function formatarDhEmi(data: Date, uf: string): string {
  // Determinar offset baseado na UF
  const offsetMap: Record<string, string> = {
    AC: "-05:00",
    AM: "-04:00",
    RR: "-04:00",
    RO: "-04:00",
    PA: "-03:00",
    AP: "-03:00",
    MA: "-03:00",
    PI: "-03:00",
    CE: "-03:00",
    RN: "-03:00",
    PB: "-03:00",
    PE: "-03:00",
    AL: "-03:00",
    SE: "-03:00",
    BA: "-03:00",
    MG: "-03:00",
    ES: "-03:00",
    RJ: "-03:00",
    SP: "-03:00",
    PR: "-03:00",
    SC: "-03:00",
    RS: "-03:00",
    MS: "-04:00",
    MT: "-04:00",
    GO: "-03:00",
    DF: "-03:00",
    TO: "-03:00"
  };

  const offset = offsetMap[uf.toUpperCase()] ?? "-03:00";

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${data.getFullYear()}-` +
    `${pad(data.getMonth() + 1)}-` +
    `${pad(data.getDate())}T` +
    `${pad(data.getHours())}:` +
    `${pad(data.getMinutes())}:` +
    `${pad(data.getSeconds())}` +
    offset
  );
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
