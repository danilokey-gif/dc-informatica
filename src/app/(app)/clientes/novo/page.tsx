import { createCustomer } from "../actions"
import Link from "next/link"
import CustomerForm from "@/components/CustomerForm"

export default function NovoClientePage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Novo Cliente</h2>
        <Link href="/clientes" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <CustomerForm action={createCustomer} submitLabel="Salvar Cliente" />
      </div>
    </div>
  )
}
