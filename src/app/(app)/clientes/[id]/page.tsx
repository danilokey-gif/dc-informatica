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

          <h3 style={{ marginTop: '1.5rem', fontSize: '0.95rem' }}>Endereço estruturado (necessário para emitir NF-e de produto)</h3>
          <div className="input-group">
            <label className="input-label" htmlFor="enderLogradouro">Logradouro</label>
            <input type="text" id="enderLogradouro" name="enderLogradouro" className="input-field" placeholder="Rua/Av." defaultValue={cliente.enderLogradouro || ''} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="enderNumero">Número</label>
            <input type="text" id="enderNumero" name="enderNumero" className="input-field" defaultValue={cliente.enderNumero || ''} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="enderBairro">Bairro</label>
            <input type="text" id="enderBairro" name="enderBairro" className="input-field" defaultValue={cliente.enderBairro || ''} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="enderCep">CEP</label>
            <input type="text" id="enderCep" name="enderCep" className="input-field" defaultValue={cliente.enderCep || ''} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="enderMunicipio">Município</label>
            <input type="text" id="enderMunicipio" name="enderMunicipio" className="input-field" defaultValue={cliente.enderMunicipio || ''} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="enderUf">UF</label>
            <input type="text" id="enderUf" name="enderUf" className="input-field" maxLength={2} placeholder="SP" defaultValue={cliente.enderUf || ''} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="enderCodMunicipio">Código IBGE do Município</label>
            <input type="text" id="enderCodMunicipio" name="enderCodMunicipio" className="input-field" placeholder="Ex: 3529005 (Marília-SP)" defaultValue={cliente.enderCodMunicipio || ''} />
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
