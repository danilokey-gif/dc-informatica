import { prisma } from '../src/lib/prisma'
import { montarXmlDps } from '../src/lib/nfse/dps'
import fs from 'fs'

async function main() {
  const nfseConfig = await prisma.nfseConfig.findUniqueOrThrow({ where: { id: 'main' } })
  const empresa = await prisma.companySettings.findUniqueOrThrow({ where: { id: 'main' } })

  const { xml } = montarXmlDps({
    ambiente: 'homologacao',
    codigoMunicipio: nfseConfig.codigoMunicipio!,
    serie: nfseConfig.serieDps,
    numero: 999,
    dataCompetencia: new Date(),
    prestador: { documento: empresa.document!, razaoSocial: empresa.name },
    tomador: { documento: '26408013848', nome: 'Cliente Teste' },
    servico: { codigoTributacaoNacional: nfseConfig.codigoServico!, descricao: 'Teste de validação', valor: 100 },
    aliquotaIss: nfseConfig.aliquotaIss!,
    regimeTributario: nfseConfig.regimeTributario as 'MEI',
  })
  fs.writeFileSync('scripts/dps_teste.xml', xml)
  console.log('gerado (sem assinatura)')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
