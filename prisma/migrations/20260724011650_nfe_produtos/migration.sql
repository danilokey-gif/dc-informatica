-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "inscricaoEstadual" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cfop" TEXT,
ADD COLUMN     "ncm" TEXT;

-- CreateTable
CREATE TABLE "NfeConfig" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "crt" TEXT NOT NULL DEFAULT '1',
    "codigoMunicipio" TEXT,
    "cfopPadrao" TEXT NOT NULL DEFAULT '5102',
    "certificado" TEXT,
    "certificadoSenha" TEXT,
    "certificadoNome" TEXT,
    "serie" TEXT NOT NULL DEFAULT '2',
    "proximoNumero" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeEmissao" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSANDO',
    "chaveAcesso" TEXT,
    "xmlNfe" TEXT,
    "xmlProtocolo" TEXT,
    "motivoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeEmissao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NfeEmissao" ADD CONSTRAINT "NfeEmissao_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
