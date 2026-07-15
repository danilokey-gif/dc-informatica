-- CreateTable
CREATE TABLE "NfseConfig" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "codigoMunicipio" TEXT,
    "codigoServico" TEXT,
    "cnae" TEXT,
    "aliquotaIss" DOUBLE PRECISION,
    "certificado" TEXT,
    "certificadoSenha" TEXT,
    "certificadoNome" TEXT,
    "serieDps" TEXT NOT NULL DEFAULT '1',
    "proximoNumeroDps" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfseEmissao" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "numeroDps" INTEGER NOT NULL,
    "serieDps" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSANDO',
    "chaveAcesso" TEXT,
    "xmlDps" TEXT,
    "xmlNfse" TEXT,
    "motivoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfseEmissao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NfseEmissao" ADD CONSTRAINT "NfseEmissao_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
