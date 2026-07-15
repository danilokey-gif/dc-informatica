import { createCustomer } from "../actions"
import Link from "next/link"

export default function NovoClientePage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Novo Cliente</h2>
        <Link href="/clientes" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createCustomer}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome Completo *</label>
            <input type="text" id="name" name="name" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="document">CPF/CNPJ</label>
            <input type="text" id="document" name="document" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Telefone / WhatsApp</label>
            <input type="text" id="phone" name="phone" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail</label>
            <input type="email" id="email" name="email" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="address">Endereço Completo</label>
            <input type="text" id="address" name="address" className="input-field" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
