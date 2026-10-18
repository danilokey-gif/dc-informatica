import { prisma } from "@/lib/prisma"
import { updateOS, deleteOS } from "../actions"
import BotaoExcluir from "@/components/BotaoExcluir"
import Link from "next/link"
import { notFound } from "next/navigation"
import SearchableSelect from "@/components/SearchableSelect"
import OSEditForm from "./OSEditForm"
import FotosOS from "./FotosOS"

export default async function EditarOSPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const os = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { customer: true, anexos: { where: { excluidoEm: null }, orderBy: { createdAt: 'asc' } } }
  })

  if (!os) {
    notFound()
  }

  const [clientes, tecnicos, empresa] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.companySettings.findUnique({ where: { id: 'main' }, select: { gdriveRefreshToken: true, gdriveClientId: true } }),
  ])
  const updateAction = updateOS.bind(null, id)

  // WhatsApp e Email Sharing info
  const textMsg = `Olá ${os.customer.name}! O status do seu atendimento${os.device ? ` (${os.device})` : ''} na Dc Informática mudou. Verifique conosco.\n\nNúmero da OS: ${os.id.slice(-6).toUpperCase()}`
  const wppUrl = os.customer.phone ? `https://wa.me/55${os.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(textMsg)}` : '#'

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Detalhes da Ordem de Serviço #{os.id.slice(-6).toUpperCase()}</h2>
        <div className="flex gap-4">
          <a href="#fotos" className="btn btn-outline">📷 Fotos{os.anexos.length > 0 ? ` (${os.anexos.length})` : ''}</a>
          <Link href={`/os/${os.id}/imprimir`} className="btn btn-outline" style={{ borderColor: '#6b7280', color: '#374151' }}>
            🖨️ Imprimir
          </Link>
          {os.customer.phone && (
            <a href={wppUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}>
              💬 Enviar WhatsApp
            </a>
          )}
          <BotaoExcluir action={deleteOS.bind(null, os.id)} confirmar={`Excluir a OS ${os.id.slice(-6).toUpperCase()} de ${os.customer.name}?`} depois="/os" estilo="botao" />
          <Link href="/os" className="text-muted" style={{ display: 'flex', alignItems: 'center' }}>Voltar</Link>
        </div>
      </div>

      <div className="card">
        <OSEditForm
          updateAction={updateAction}
          os={{ id: os.id, device: os.device, issue: os.issue, technicalReport: os.technicalReport, price: os.price, status: os.status, technicianId: os.technicianId, customerId: os.customerId }}
          clientes={clientes.map(c => ({ value: c.id, label: c.name, busca: c.document }))}
          tecnicos={tecnicos.map(t => ({ value: t.id, label: t.name }))}
        />
      </div>

      <FotosOS serviceOrderId={os.id} anexos={os.anexos} driveConectado={!!(empresa?.gdriveRefreshToken && empresa.gdriveClientId)} />
    </div>
  )
}
