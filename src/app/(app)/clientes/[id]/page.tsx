import { prisma } from "@/lib/prisma"
import { updateCustomer } from "../actions"
import Link from "next/link"
import { notFound } from "next/navigation"
import CustomerForm from "@/components/CustomerForm"

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = params
  
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
        <CustomerForm 
          action={updateAction} 
          submitLabel="Atualizar Cliente" 
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
    </div>
  )
}
