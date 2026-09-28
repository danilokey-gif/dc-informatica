import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export const dynamic = 'force-dynamic'

/**
 * Rota mantida por compatibilidade (os botões da tela da OS apontam para cá).
 *
 * A renderização do DANFSe é única e vive em /notas-fiscais/ver-danfse, que monta o documento
 * a partir do XML real da nota. Antes existiam duas telas: esta, que remontava o documento a
 * partir dos dados da OS no banco, e a nova, que lê o XML — o que abria espaço para divergência
 * entre o que o sistema mostra e o que o governo realmente autorizou.
 */
export default async function DanfsePorOsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const emissao = await prisma.nfseEmissao.findFirst({
    where: { serviceOrderId: id, status: 'AUTORIZADA' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!emissao) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta Ordem de Serviço ainda não tem uma NFS-e autorizada.</p>
        <Link href={`/os/${id}/imprimir`} className="text-primary">Voltar para a Ordem de Serviço</Link>
      </div>
    )
  }

  redirect(`/notas-fiscais/ver-danfse?id=${emissao.id}`)
}
