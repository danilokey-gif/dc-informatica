import { prisma } from "@/lib/prisma"
import { updateCustomer } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"

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
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Editar Cliente</h2>
        <Link href="/clientes" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={updateAction}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome Completo *</label>
            <input type="text" id="name" name="name" className="input-field" required defaultValue={cliente.name} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="document">CPF/CNPJ</label>
            <input type="text" id="document" name="document" className="input-field" defaultValue={cliente.document || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Telefone / WhatsApp</label>
            <input type="text" id="phone" name="phone" className="input-field" defaultValue={cliente.phone || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail</label>
            <input type="email" id="email" name="email" className="input-field" defaultValue={cliente.email || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="address">Endereço Completo</label>
            <input type="text" id="address" name="address" className="input-field" defaultValue={cliente.address || ''} />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Atualizar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
