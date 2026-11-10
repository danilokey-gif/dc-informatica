import { prisma } from "@/lib/prisma"
import { updateCustomer, deleteCustomer } from "../actions"
import BotaoExcluir from "@/components/BotaoExcluir"
import Link from "next/link"
import { notFound } from "next/navigation"
import CustomerForm from "@/components/CustomerForm"
import HistoricoCliente from "./HistoricoCliente"
import NotasCliente from "./NotasCliente"

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const cliente = await prisma.customer.findUnique({
    where: { id }
  })

  if (!cliente) {
    notFound()
  }

  const updateAction = updateCustomer.bind(null, id)

  return (
    <div className="animate-fade-in" style={{ maxWidth: '980px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>{cliente.name}</h2>
          <div className="flex gap-4" style={{ fontSize: '0.85rem', flexWrap: 'wrap' }}>
            {cliente.document && <span className="text-muted">{cliente.document}</span>}
            <a href="#notas" className="text-primary">Notas fiscais</a>
            <a href="#historico" className="text-primary">Histórico</a>
            <a href="#cadastro" className="text-primary">Dados cadastrais</a>
          </div>
        </div>
        <div className="flex gap-4" style={{ alignItems: 'center' }}>
          <BotaoExcluir action={deleteCustomer.bind(null, cliente.id)} confirmar={`Excluir o cliente "${cliente.name}"?`} depois="/clientes" estilo="botao" />
          <Link href="/clientes" className="text-muted">Voltar</Link>
        </div>
      </div>

      <div id="cadastro" className="card" style={{ scrollMarginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Dados cadastrais</h3>
        <CustomerForm 
          action={updateAction} 
          submitLabel="Atualizar Cliente"
          clienteId={cliente.id}
          defaultValues={{
            name: cliente.name,
            document: cliente.document,
            phone: cliente.phone,
            email: cliente.email,
            address: cliente.address,
            enderLogradouro: cliente.enderLogradouro,
            enderNumero: cliente.enderNumero,
            enderBairro: cliente.enderBairro,
            enderCep: cliente.enderCep,
            enderMunicipio: cliente.enderMunicipio,
            enderUf: cliente.enderUf,
            enderCodMunicipio: cliente.enderCodMunicipio,
          }}
        />
      </div>

      <div id="notas" style={{ scrollMarginTop: '1rem' }}><NotasCliente clienteId={cliente.id} documento={cliente.document} telefone={cliente.phone} /></div>
      <div id="historico" style={{ scrollMarginTop: '1rem' }}><HistoricoCliente clienteId={cliente.id} /></div>
    </div>
  )
}
