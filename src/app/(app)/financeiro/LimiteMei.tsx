import type { ResumoMei, SituacaoMei } from "@/lib/limite-mei"

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const AVISO: Record<SituacaoMei, { cor: string; titulo: string }> = {
  TRANQUILO: { cor: 'var(--accent-green)', titulo: 'Dentro do limite, com folga' },
  ATENCAO: { cor: 'var(--accent-orange)', titulo: 'Atenção: já passou de 70% do limite' },
  PERTO: { cor: 'var(--accent-orange)', titulo: 'Perto do limite: no ritmo atual o ano fecha acima' },
  ACIMA: { cor: 'var(--accent-red)', titulo: 'Acima do limite do MEI' },
  ESTOUROU: { cor: 'var(--accent-red)', titulo: 'Mais de 20% acima do limite do MEI' },
}

/** Quanto do limite anual do MEI já foi usado, quanto ainda cabe e os números da declaração anual. */
export default function LimiteMei({ r }: { r: ResumoMei }) {
  const aviso = AVISO[r.situacao]
  // A barra vai até o teto de 20% de tolerância; o risco marca o limite.
  const escala = r.teto
  const largura = (v: number) => `${Math.min(100, Math.max(0, (v / escala) * 100))}%`
  const anoCorrente = r.projecao !== null
  const comAReceber = r.base + r.aReceberNoAno

  const Linha = ({ rotulo, valor, detalhe, cor, forte }: { rotulo: string; valor: string; detalhe?: string; cor?: string; forte?: boolean }) => (
    <tr>
      <td style={{ padding: '0.2rem 0' }}>{forte ? <strong>{rotulo}</strong> : rotulo}{detalhe && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{detalhe}</div>}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: forte ? 700 : 600, color: cor, verticalAlign: 'top', padding: '0.2rem 0' }}>{valor}</td>
    </tr>
  )

  return (
    <div className="card" style={{ marginBottom: '1.25rem', borderLeft: `4px solid ${aviso.cor}` }}>
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Limite do MEI em {r.ano}</h3>
        <strong style={{ color: aviso.cor, fontSize: '0.9rem' }}>{aviso.titulo}</strong>
      </div>

      <div className="flex justify-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div><span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{moeda(r.base)}</span> <span className="text-muted">de {moeda(r.limite)}</span></div>
        <strong style={{ fontSize: '1.1rem', color: aviso.cor }}>{r.percentual.toFixed(1).replace('.', ',')}%</strong>
      </div>
      <div className="text-muted" style={{ fontSize: '0.78rem' }}>
        {r.porNotas > r.faturado
          ? `Contando as notas emitidas no ano + serviços sem nota. Pelo dinheiro que já entrou: ${moeda(r.faturado)}.`
          : 'Contando o dinheiro recebido no ano (com nota + sem nota).'}
      </div>

      <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--surface-hover)', margin: '0.5rem 0 0.25rem', overflow: 'hidden' }}>
        {anoCorrente && r.aReceberNoAno > 0 && <div style={{ position: 'absolute', inset: 0, width: largura(comAReceber), background: aviso.cor, opacity: 0.3 }} title="Com o que ainda tem a receber no ano" />}
        <div style={{ position: 'absolute', inset: 0, width: largura(r.base), background: aviso.cor }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: largura(r.limite), width: 2, background: 'var(--text-main, currentColor)' }} title={`Limite: ${moeda(r.limite)}`} />
      </div>
      <div className="text-muted" style={{ position: 'relative', height: '1rem', fontSize: '0.7rem' }}>
        <span style={{ position: 'absolute', left: largura(r.limite), transform: 'translateX(-100%)', paddingRight: 4 }}>limite {moeda(r.limite)}</span>
        <span style={{ position: 'absolute', right: 0 }}>+20% {moeda(r.teto)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.5rem 2rem', marginTop: '0.75rem' }}>
        <table style={{ width: '100%', fontSize: '0.9rem' }}>
          <tbody>
            <Linha forte rotulo={r.restante >= 0 ? 'Ainda pode faturar' : 'Passou do limite em'} valor={moeda(Math.abs(r.restante))} cor={r.restante >= 0 ? undefined : 'var(--accent-red)'}
              detalhe={r.podeFaturarPorMes !== null && r.restante > 0 ? `Cerca de ${moeda(r.podeFaturarPorMes)} por mês até dezembro` : undefined} />
            {anoCorrente && <Linha rotulo="A receber até dezembro" valor={moeda(r.aReceberNoAno)}
              detalhe={r.aReceberNoAno > 0 ? `Se tudo entrar: ${moeda(comAReceber)} (${comAReceber > r.limite ? `${moeda(comAReceber - r.limite)} acima do limite` : `sobram ${moeda(r.limite - comAReceber)}`})` : undefined} />}
            {anoCorrente && r.mediaMensal !== null && <Linha rotulo="Média por mês no ano" valor={moeda(r.mediaMensal)} detalhe={`O limite dá ${moeda(r.limite / 12)} por mês`} />}
            {anoCorrente && r.projecao !== null && <Linha rotulo="Previsão para o fim do ano" valor={moeda(r.projecao)} cor={r.projecao > r.limite ? 'var(--accent-red)' : undefined} detalhe="No ritmo do ano até hoje" />}
          </tbody>
        </table>
        <table style={{ width: '100%', fontSize: '0.9rem' }}>
          <tbody>
            <Linha forte rotulo="Para a declaração anual (DASN-SIMEI)" valor="" />
            <Linha rotulo="Comércio (venda de produtos)" valor={moeda(r.comercio)} />
            <Linha rotulo="Prestação de serviços" valor={moeda(r.servicos)} />
            <Linha rotulo="Total recebido no ano" valor={moeda(r.faturado)} detalhe="Com nota + sem nota, pela data em que o dinheiro entrou" />
            <Linha rotulo="Pela data das notas" valor={moeda(r.porNotas)} detalhe="Notas emitidas no ano + serviços sem nota recebidos" />
          </tbody>
        </table>
      </div>

      <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.75rem', marginBottom: 0 }}>
        O aviso usa o maior dos dois totais. Reembolsos, rendimento de investimentos e aportes do sócio não entram.
        Até {moeda(r.teto)} (20% acima) o MEI paga imposto sobre o excedente e sai do MEI em janeiro; acima disso o desenquadramento vale desde janeiro deste ano.
        Confirme com o contador qual total declarar.
      </p>
    </div>
  )
}
