import Link from "next/link"
import ImportarXmlForm from "./ImportarXmlForm"

export const dynamic = 'force-dynamic'

export default function ImportarXmlPage() {
  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Importar XML de NF-e</h2>
        <Link href="/notas-fiscais" className="text-muted">Voltar</Link>
      </div>

      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary)' }}>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          Traga para o sistema as NF-e emitidas <strong>fora dele</strong> (por exemplo, no emissor do Sebrae). A Sefaz não
          devolve ao emitente as notas que ele mesmo emitiu, então o XML é o único caminho para elas entrarem aqui.
        </p>
        <ul className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
          <li>Pode selecionar vários arquivos de uma vez, ou um <strong>.zip</strong> com todos dentro.</li>
          <li>Use o XML da nota <strong>autorizada</strong>, que traz o protocolo da Sefaz.</li>
          <li>Notas de <strong>venda</strong> (emitidas pela Dc Informática) entram em Notas Fiscais, com DANFE, relatórios e download por período.</li>
          <li>Notas de <strong>compra</strong> (emitidas por fornecedores para a Dc Informática) entram em <Link href="/notas-fiscais/fornecedores" className="text-primary">Notas de Compra</Link>.</li>
          <li>XML de <strong>cancelamento</strong> marca como cancelada uma nota que já está no sistema.</li>
          <li>Importar de novo o mesmo arquivo não duplica nada.</li>
          <li>A importação <strong>não lança nada no Financeiro</strong>, porque a venda pode já ter sido registrada lá.</li>
        </ul>
        <ImportarXmlForm />
      </div>
    </div>
  )
}
