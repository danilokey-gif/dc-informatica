import { prisma } from "@/lib/prisma"
import { updateOS } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function EditarOSPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const os = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { customer: true }
  })

  if (!os) {
    notFound()
  }

  const [clientes, tecnicos] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
  ])
  const updateAction = updateOS.bind(null, id)

  // WhatsApp e Email Sharing info
  const textMsg = `Olá ${os.customer.name}! O status do seu aparelho (${os.device}) na Dc Informática mudou. Verifique conosco.\n\nNúmero da OS: ${os.id.slice(-6).toUpperCase()}`
  const wppUrl = os.customer.phone ? `https://wa.me/55${os.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(textMsg)}` : '#'

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Detalhes da Ordem de Serviço #{os.id.slice(-6).toUpperCase()}</h2>
        <div className="flex gap-4">
          <Link href={`/os/${os.id}/imprimir`} target="_blank" className="btn btn-outline" style={{ borderColor: '#6b7280', color: '#374151' }}>
            🖨️ Imprimir
          </Link>
          {os.customer.phone && (
            <a href={wppUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}>
              💬 Enviar WhatsApp
            </a>
          )}
          <Link href="/os" className="text-muted" style={{ display: 'flex', alignItems: 'center' }}>Voltar</Link>
        </div>
      </div>

      <div className="card">
        <form action={updateAction}>
          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente *</label>
            <select id="customerId" name="customerId" className="input-field" required defaultValue={os.customerId}>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>{cliente.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="device">Aparelho / Marca / Modelo *</label>
            <input type="text" id="device" name="device" className="input-field" required defaultValue={os.device} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="issue">Defeito Relatado pelo Cliente *</label>
            <textarea id="issue" name="issue" className="input-field" rows={3} required defaultValue={os.issue}></textarea>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="technicalReport">Laudo Técnico (Orçamento/Solução)</label>
            <textarea id="technicalReport" name="technicalReport" className="input-field" rows={4} defaultValue={os.technicalReport || ''}></textarea>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="technicianId">Técnico Responsável</label>
            <select id="technicianId" name="technicianId" className="input-field" defaultValue={os.technicianId || ''}>
              <option value="">Não atribuído</option>
              {tecnicos.map(tecnico => (
                <option key={tecnico.id} value={tecnico.id}>{tecnico.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="price">Valor (R$)</label>
              <input type="number" step="0.01" id="price" name="price" className="input-field" defaultValue={os.price || ''} />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="status">Status Atual</label>
              <select id="status" name="status" className="input-field" defaultValue={os.status}>
                <option value="BUDGET">Orçamento Pendente</option>
                <option value="APPROVED">Orçamento Aprovado</option>
                <option value="IN_PROGRESS">Em Andamento</option>
                <option value="COMPLETED">Concluído (Pronto para Entrega)</option>
                <option value="DELIVERED">Entregue / Finalizado</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Atualizar Ordem de Serviço
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
