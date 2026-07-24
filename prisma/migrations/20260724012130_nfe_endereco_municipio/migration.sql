-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "enderBairro" TEXT,
ADD COLUMN     "enderCep" TEXT,
ADD COLUMN     "enderLogradouro" TEXT,
ADD COLUMN     "enderNumero" TEXT;

-- AlterTable
ALTER TABLE "NfeConfig" ADD COLUMN     "nomeMunicipio" TEXT,
ADD COLUMN     "uf" TEXT NOT NULL DEFAULT 'SP';
