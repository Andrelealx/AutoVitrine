-- Migration: add_nfe_module
-- Adds LojaFiscal, NotaFiscal tables and fiscal fields to Vehicle

-- Campos fiscais no veículo
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "plate"   TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "renavam" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "chassis" TEXT;

-- Configuração fiscal por loja
CREATE TABLE IF NOT EXISTS "LojaFiscal" (
    "id"               TEXT NOT NULL,
    "lojaId"           TEXT NOT NULL,
    "cnpj"             TEXT NOT NULL,
    "ie"               TEXT NOT NULL,
    "crt"              INTEGER NOT NULL DEFAULT 1,
    "certificadoPfx"   BYTEA,
    "certificadoSenha" TEXT,
    "ambiente"         INTEGER NOT NULL DEFAULT 2,
    "serie"            INTEGER NOT NULL DEFAULT 1,
    "ultimaNNF"        INTEGER NOT NULL DEFAULT 0,
    "logradouro"       TEXT NOT NULL DEFAULT '',
    "numero"           TEXT NOT NULL DEFAULT '',
    "bairro"           TEXT NOT NULL DEFAULT '',
    "cMun"             TEXT NOT NULL DEFAULT '',
    "xMun"             TEXT NOT NULL DEFAULT '',
    "uf"               TEXT NOT NULL DEFAULT '',
    "cep"              TEXT NOT NULL DEFAULT '',
    "fone"             TEXT NOT NULL DEFAULT '',
    "cUF"              INTEGER NOT NULL DEFAULT 33,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LojaFiscal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LojaFiscal_lojaId_key" ON "LojaFiscal"("lojaId");

ALTER TABLE "LojaFiscal"
    ADD CONSTRAINT "LojaFiscal_lojaId_fkey"
    FOREIGN KEY ("lojaId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notas Fiscais Eletrônicas
CREATE TABLE IF NOT EXISTS "NotaFiscal" (
    "id"                   TEXT NOT NULL,
    "lojaId"               TEXT NOT NULL,
    "veiculoId"            TEXT,
    "chaveAcesso"          TEXT NOT NULL,
    "nNF"                  INTEGER NOT NULL,
    "serie"                INTEGER NOT NULL,
    "dhEmi"                TIMESTAMP(3) NOT NULL,
    "nomeDestinatario"     TEXT NOT NULL,
    "cpfCnpjDestinatario"  TEXT NOT NULL,
    "emailDestinatario"    TEXT,
    "valorTotal"           DOUBLE PRECISION NOT NULL,
    "renavam"              TEXT,
    "chassi"               TEXT,
    "xmlEnviado"           TEXT NOT NULL,
    "xmlAutorizado"        TEXT,
    "protocolo"            TEXT,
    "status"               TEXT NOT NULL DEFAULT 'pendente',
    "motivoErro"           TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotaFiscal_chaveAcesso_key" ON "NotaFiscal"("chaveAcesso");
CREATE INDEX IF NOT EXISTS "NotaFiscal_lojaId_createdAt_idx" ON "NotaFiscal"("lojaId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotaFiscal_lojaId_status_idx"    ON "NotaFiscal"("lojaId", "status");

ALTER TABLE "NotaFiscal"
    ADD CONSTRAINT "NotaFiscal_lojaId_fkey"
    FOREIGN KEY ("lojaId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotaFiscal"
    ADD CONSTRAINT "NotaFiscal_veiculoId_fkey"
    FOREIGN KEY ("veiculoId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
