import crypto from "crypto";

/**
 * Gera o cNF (8 dígitos aleatórios) para compor a chave de acesso
 */
export function gerarCNF(): string {
  const n = crypto.randomInt(1, 99999999);
  return String(n).padStart(8, "0");
}

/**
 * Calcula o dígito verificador (cDV) da chave de acesso usando Módulo 11
 */
export function calcularCDV(chave43: string): number {
  let peso = 2;
  let soma = 0;

  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Monta a chave de acesso de 44 dígitos conforme padrão SEFAZ
 * cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */
export function gerarChaveAcesso(params: {
  cUF: number;
  dhEmi: Date;
  cnpj: string;
  mod?: number;
  serie: number;
  nNF: number;
  tpEmis?: number;
  cNF?: string;
}): string {
  const { cUF, dhEmi, cnpj, mod = 55, serie, nNF, tpEmis = 1 } = params;

  const aamm =
    String(dhEmi.getFullYear()).slice(2) +
    String(dhEmi.getMonth() + 1).padStart(2, "0");

  const cnpjLimpo = cnpj.replace(/\D/g, "").padStart(14, "0");
  const cNF = params.cNF ?? gerarCNF();

  const chave43 =
    String(cUF).padStart(2, "0") +
    aamm +
    cnpjLimpo +
    String(mod).padStart(2, "0") +
    String(serie).padStart(3, "0") +
    String(nNF).padStart(9, "0") +
    String(tpEmis) +
    cNF;

  const cDV = calcularCDV(chave43);

  return chave43 + String(cDV);
}
