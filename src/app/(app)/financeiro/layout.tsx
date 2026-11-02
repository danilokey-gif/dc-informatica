import { Suspense } from "react"
import AbasFinanceiro from "./AbasFinanceiro"

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Financeiro</h2>
      </div>
      <Suspense fallback={null}><AbasFinanceiro /></Suspense>
      {children}
    </div>
  )
}
