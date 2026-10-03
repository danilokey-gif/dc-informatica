import { prisma } from "@/lib/prisma"

/**
 * Código de serviço (cTribNac) com que a nota foi emitida, lido do próprio XML da DPS, e sua
 * descrição. Nem toda NFS-e usa o código da configuração geral: a cobrança mensal tem o seu.
 * Sem isso, o PDF de uma nota de aluguel de sistema sairia com o código de manutenção.
 */
export async function codigoServicoDaNota(
  xmlDps: string | null,
  config: { codigoServico: string | null; descricaoCodServico: string | null },
): Promise<{ codigoServico: string | null; descricaoCodServico: string | null }> {
  const codigo = xmlDps?.match(/<cTribNac>(\d+)<\/cTribNac>/)?.[1] || config.codigoServico
  if (!codigo || codigo === config.codigoServico) {
    return { codigoServico: codigo, descricaoCodServico: config.descricaoCodServico }
  }
  const cobranca = await prisma.cobrancaMensal.findFirst({
    where: { codigoServico: codigo, descricaoCodServico: { not: null } },
    select: { descricaoCodServico: true },
  })
  return { codigoServico: codigo, descricaoCodServico: cobranca?.descricaoCodServico ?? null }
}
