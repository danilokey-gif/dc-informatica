import { createSupplier } from "../actions"
import Link from "next/link"

export default function NovoFornecedorPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2>Novo Fornecedor</h2>
        <Link href="/fornecedores" className="text-muted">Voltar</Link>
      </div>

      <div className="card">
        <form action={createSupplier}>
          <div className="input-group">
            <label className="input-label" htmlFor="name">Nome / Razão Social *</label>
            <input type="text" id="name" name="name" className="input-field" required />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="document">CNPJ/CPF</label>
            <input type="text" id="document" name="document" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Telefone</label>
            <input type="text" id="phone" name="phone" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">E-mail</label>
            <input type="email" id="email" name="email" className="input-field" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="address">Endereço</label>
            <input type="text" id="address" name="address" className="input-field" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Salvar Fornecedor
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
