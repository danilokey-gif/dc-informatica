import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export const dynamic = 'force-dynamic'

/**
 * Rota mantida por compatibilidade (os botões da tela da Venda apontam para cá).
 *
 * A renderização do DANFE é única e vive em /notas-fiscais/ver-danfe, que monta o documento a
 * partir do XML real da nota. A versão que existia aqui remontava o documento a partir dos dados
 * da venda no banco e imprimia um "Protocolo de Autorização de Uso" fixo no código — ou seja, um
 * número inventado, igual em todas as notas. Lendo do XML, o protocolo sai correto (tag nProt).
 */
export default async function DanfePorVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const emissao = await prisma.nfeEmissao.findFirst({
    where: { saleId: id, status: 'AUTORIZADA' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!emissao) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta venda ainda não tem uma NF-e autorizada.</p>
        <Link href={`/vendas/${id}/imprimir`} className="text-primary">Voltar para a Venda</Link>
      </div>
    )
  }

  redirect(`/notas-fiscais/ver-danfe?id=${emissao.id}`)
}
