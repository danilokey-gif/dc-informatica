import { prisma } from "@/lib/prisma"
import { updateSupplier } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const fornecedor = await prisma.supplier.findUnique({
    where: { id }
  })

  if (!fornecedor) {
    notFound()
  }

  const updateAction = updateSupplier.bind(null, id)

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Editar Fornecedor</h2>
        <Link href="/fornecedores" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={updateAction}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome / Razão Social *</label>
            <input type="text" id="name" name="name" className="input-field" required defaultValue={fornecedor.name} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="document">CNPJ/CPF</label>
            <input type="text" id="document" name="document" className="input-field" defaultValue={fornecedor.document || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Telefone</label>
            <input type="text" id="phone" name="phone" className="input-field" defaultValue={fornecedor.phone || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail</label>
            <input type="email" id="email" name="email" className="input-field" defaultValue={fornecedor.email || ''} />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="address">Endereço</label>
            <input type="text" id="address" name="address" className="input-field" defaultValue={fornecedor.address || ''} />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Atualizar Fornecedor
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
