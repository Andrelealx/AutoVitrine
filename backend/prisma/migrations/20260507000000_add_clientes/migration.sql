-- CreateTable
CREATE TABLE "Cliente" (
    "id"         TEXT NOT NULL,
    "storeId"    TEXT NOT NULL,
    "nome"       TEXT NOT NULL,
    "cpfCnpj"    TEXT NOT NULL,
    "telefone"   TEXT,
    "email"      TEXT,
    "logradouro" TEXT NOT NULL DEFAULT '',
    "numero"     TEXT NOT NULL DEFAULT '',
    "bairro"     TEXT NOT NULL DEFAULT '',
    "cep"        TEXT NOT NULL DEFAULT '',
    "cMun"       TEXT NOT NULL DEFAULT '',
    "xMun"       TEXT NOT NULL DEFAULT '',
    "uf"         TEXT NOT NULL DEFAULT '',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cliente_storeId_nome_idx" ON "Cliente"("storeId", "nome");

-- CreateIndex
CREATE INDEX "Cliente_storeId_cpfCnpj_idx" ON "Cliente"("storeId", "cpfCnpj");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
