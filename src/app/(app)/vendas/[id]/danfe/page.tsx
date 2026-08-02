import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarCode128DataUrl } from "@/lib/barcode"
import PrintButton from "../../../os/[id]/imprimir/PrintButton"

export const dynamic = 'force-dynamic'

function Field({ label, value, flex = 1, borderRight = true, align = 'left' }: { label: string; value?: React.ReactNode; flex?: number; borderRight?: boolean; align?: 'left' | 'center' | 'right' }) {
  return (
    <div style={{
      flex,
      padding: '2px 4px',
      minWidth: 0,
      borderRight: borderRight ? '1px solid #000' : 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      textAlign: align
    }}>
      <div style={{ fontSize: '0.36rem', fontWeight: 'bold', color: '#1f2937', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '0.54rem', fontWeight: 'bold', color: '#000', wordBreak: 'break-all' }}>{value || '0,00'}</div>
    </div>
  )
}

function FieldRow({ children, borderBottom = true, minHeight = '24px' }: { children: React.ReactNode; borderBottom?: boolean; minHeight?: string }) {
  return (
    <div style={{ display: 'flex', borderBottom: borderBottom ? '1px solid #000' : 'none', minHeight }}>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      backgroundColor: '#f3f4f6',
      borderBottom: '1px solid #000',
      padding: '2px 4px',
      fontWeight: 'bold',
      fontSize: '0.44rem',
      textTransform: 'uppercase',
      color: '#1f2937'
    }}>
      {title}
    </div>
  )
}

export default async function DanfePage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = params

    const [venda, empresa] = await Promise.all([
      prisma.sale.findUnique({
        where: { id },
        include: {
          customer: true,
          items: { include: { product: true } },
          nfeEmissoes: { where: { status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } },
        }
      }),
      getCompanySettings(),
    ])

    if (!venda) notFound()

    const emissao = venda.nfeEmissoes[0]
    if (!emissao || !emissao.chaveAcesso) {
      return (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
          <p>Esta venda ainda não tem uma NF-e autorizada.</p>
        </div>
      )
    }

    const barcodeDataUrl = await gerarCode128DataUrl(emissao.chaveAcesso)
    const chaveFormatada = emissao.chaveAcesso.match(/.{1,4}/g)?.join(' ') || emissao.chaveAcesso
    const totalFormatado = venda.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    
    const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}`
    const bairroPrestador = empresa.enderBairro || ''
    const cepPrestador = empresa.enderCep || ''

    const enderecoCliente = venda.customer 
      ? `${venda.customer.enderLogradouro || ''}${venda.customer.enderNumero ? `, ${venda.customer.enderNumero}` : ''}` 
      : '-'

    const protocolo = "135262944542482" // Protocolo simulado do print do usuário
    const nomeEmitente = empresa.name === "11.671.379DANILOCHAVES" ? "DANILO CHAVES" : empresa.name

    return (
      <div className="danfe-container" style={{ backgroundColor: 'white', color: 'black', padding: '0.1rem', width: '100%', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
        <style>{`
          @media print {
            @page { size: A4; margin: 3mm 3mm; }
            html, body { height: auto !important; margin: 0 !important; padding: 0 !important; background: white; }
            .danfe-container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box;
            }
            .no-print { display: none !important; }
          }
        `}</style>

        {emissao.ambiente !== 'producao' && (
          <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.1rem', border: '1px solid #991b1b', fontSize: '0.52rem', marginBottom: '0.2rem' }}>
            NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
          </div>
        )}

        {/* CONTAINER PRINCIPAL */}
        <div style={{ border: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
          
          {/* 1. CANHOTO (RECEBIMENTO) */}
          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '38px', backgroundColor: '#fff' }}>
            <div style={{ flex: 6.5, padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.42rem', lineHeight: '1.3', color: '#000' }}>
                RECEBEMOS DE <strong>{nomeEmitente.toUpperCase()}</strong> OS PRODUTOS E SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO
              </div>
            </div>
            <div style={{ flex: 1.5, borderLeft: '1px solid #000', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <span style={{ fontSize: '0.36rem', fontWeight: 'bold', color: '#374151' }}>DATA DE RECEBIMENTO</span>
            </div>
            <div style={{ flex: 2.2, borderLeft: '1px solid #000', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <span style={{ fontSize: '0.36rem', fontWeight: 'bold', color: '#374151' }}>IDENTIFICAÇÃO DE ASSINATURA DO RECEBEDOR</span>
            </div>
            <div style={{ flex: 1.8, borderLeft: '1px solid #000', padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', fontWeight: 'bold' }}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.5px' }}>NF-e</div>
              <div style={{ fontSize: '0.62rem', marginTop: '1px' }}>Nº {emissao.numero}</div>
              <div style={{ fontSize: '0.44rem', color: '#374151' }}>Série {emissao.serie}</div>
            </div>
          </div>

          {/* 2. CABEÇALHO EMITENTE */}
          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '82px' }}>
            
            {/* Col 1: Emitente */}
            <div style={{ width: '38%', padding: '6px 8px', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {empresa.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={empresa.logo} alt="Logo" style={{ height: '46px', width: '46px', objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 'bold' }}>{nomeEmitente.toUpperCase()}</div>
                <div style={{ fontSize: '0.46rem', color: '#000', marginTop: '1px' }}>
                  CNPJ: {empresa.document || '-'}<br />
                  {enderecoPrestador}<br />
                  {bairroPrestador} - CEP: {cepPrestador}<br />
                  MARILIA - SP - FONE: {empresa.phone || '-'}
                </div>
              </div>
            </div>
            
            {/* Col 2: DANFE */}
            <div style={{ width: '24%', padding: '4px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.78rem', letterSpacing: '0.5px' }}>DANFE</div>
              <div style={{ fontSize: '0.40rem', color: '#4b5563', lineHeight: '1.2', marginTop: '1px' }}>
                DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #000', padding: '2px 4px', margin: '3px 0', width: '88%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '0.36rem', textAlign: 'left', lineHeight: '1.2', fontWeight: 'bold' }}>
                  0 - ENTRADA<br />
                  1 - SAÍDA
                </div>
                <div style={{ border: '1px solid #000', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.42rem' }}>
                  1
                </div>
              </div>
              <div style={{ fontSize: '0.50rem', fontWeight: 'bold' }}>Nº {emissao.numero}</div>
              <div style={{ fontSize: '0.50rem', fontWeight: 'bold' }}>SÉRIE: {emissao.serie}</div>
              <div style={{ fontSize: '0.38rem', color: '#4b5563' }}>PÁGINA 1 DE 1</div>
            </div>
            
            {/* Col 3: Controle do Fisco */}
            <div style={{ width: '38%', display: 'flex', flexDirection: 'column' }}>
              
              {/* Sec 1: Barcode */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '32px', borderBottom: '1px solid #000', padding: '2px 0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={barcodeDataUrl} alt="Código de Barras" style={{ height: '22px', width: '92%' }} />
              </div>
              
              {/* Sec 2: Chave de Acesso */}
              <div style={{ padding: '2px 6px', borderBottom: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '26px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.36rem', fontWeight: 'bold', color: '#1f2937' }}>CHAVE DE ACESSO</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.50rem', fontWeight: 'bold', color: '#000', letterSpacing: '-0.2px', marginTop: '1px' }}>{chaveFormatada}</div>
              </div>
              
              {/* Sec 3: Autenticidade */}
              <div style={{ padding: '3px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, textAlign: 'center', fontSize: '0.36rem', color: '#4b5563', lineHeight: '1.2' }}>
                Consulta de autenticidade no portal nacional da NF-e<br />
                <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizada
              </div>
            </div>
          </div>

          {/* Natureza da Operação */}
          <FieldRow>
            <Field label="Natureza da Operação" value="Venda Dentro do Estado" flex={2.5} />
            <Field label="Protocolo de Autorização de Uso" value={protocolo} flex={1.5} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Inscrição Estadual" value={empresa.inscricaoEstadual || '-'} />
            <Field label="Inscrição Estadual do Subst. Trib." value="-" />
            <Field label="CNPJ" value={empresa.document} borderRight={false} />
          </FieldRow>

          {/* Destinatário */}
          <SectionHeader title="Destinatário / Remetente" />
          <FieldRow>
            <Field label="Nome / Razão Social" value={venda.customer?.name.toUpperCase() || 'CONSUMIDOR NÃO IDENTIFICADO'} flex={2.5} />
            <Field label="CNPJ / CPF" value={venda.customer?.document || '-'} />
            <Field label="Data da Emissão" value={new Date(venda.createdAt).toLocaleDateString('pt-BR')} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value={enderecoCliente.toUpperCase()} flex={2.5} />
            <Field label="Bairro / Distrito" value={venda.customer?.enderBairro?.toUpperCase() || '-'} />
            <Field label="CEP" value={venda.customer?.enderCep || '-'} />
            <Field label="Data da Entrada / Saída" value={new Date(venda.createdAt).toLocaleDateString('pt-BR')} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Município" value={venda.customer?.enderMunicipio?.toUpperCase() || '-'} flex={2.2} />
            <Field label="Fone / Fax" value={venda.customer?.phone || '-'} />
            <Field label="UF" value={venda.customer?.enderUf?.toUpperCase() || '-'} />
            <Field label="Inscrição Estadual" value="-" />
            <Field label="Hora Entr. / Saída" value={new Date(venda.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} borderRight={false} />
          </FieldRow>

          {/* Fatura */}
          <SectionHeader title="Fatura" />
          <FieldRow minHeight="18px">
            <Field label="Fatura" value={`Pagamento à Vista - Forma: ${venda.paymentMethod.toUpperCase()}`} borderRight={false} />
          </FieldRow>

          {/* Cálculo do Imposto */}
          <SectionHeader title="Cálculo do Imposto" />
          <FieldRow>
            <Field label="Base de Calc. do ICMS" value="0,00" />
            <Field label="Valor do ICMS" value="0,00" />
            <Field label="Base de Calc. do ICMS ST" value="0,00" />
            <Field label="Valor do ICMS ST" value="0,00" />
            <Field label="V. Imp. Importação" value="0,00" />
            <Field label="V. ICMS UF Remet." value="0,00" />
            <Field label="Valor do FCP" value="0,00" />
            <Field label="Valor do PIS" value="0,00" />
            <Field label="V. Total de Produtos" value={totalFormatado} borderRight={false} align="right" />
          </FieldRow>
          <FieldRow>
            <Field label="Valor do Frete" value="0,00" />
            <Field label="Valor do Seguro" value="0,00" />
            <Field label="Desconto" value="0,00" />
            <Field label="Outras Desp." value="0,00" />
            <Field label="Valor do IPI" value="0,00" />
            <Field label="V. ICMS UF Dest." value="0,00" />
            <Field label="V. Aprox. do Tributo" value="0,00" />
            <Field label="Valor da Cofins" value="0,00" />
            <Field label="Valor Total da Nota" value={totalFormatado} borderRight={false} align="right" />
          </FieldRow>

          {/* Transportador / Volumes */}
          <SectionHeader title="Transportador / Volumes Transportados" />
          <FieldRow>
            <Field label="Razão Social" value="Sem frete" flex={2.2} />
            <Field label="Frete por Conta" value="9 - Sem frete" />
            <Field label="Código ANTT" value="-" />
            <Field label="Placa" value="-" />
            <Field label="UF" value="-" />
            <Field label="CNPJ / CPF" value="-" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value="-" flex={2.5} />
            <Field label="Município" value="-" flex={1.5} />
            <Field label="UF" value="-" />
            <Field label="Insc. Estadual" value="-" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Quantidade" value="-" />
            <Field label="Espécie" value="-" />
            <Field label="Marca" value="-" />
            <Field label="Numeração" value="-" />
            <Field label="Peso Bruto" value="-" />
            <Field label="Peso Líquido" value="-" borderRight={false} />
          </FieldRow>

          {/* Dados dos Produtos / Serviços */}
          <div style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000', borderTop: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', fontSize: '0.44rem', textTransform: 'uppercase', color: '#1f2937' }}>
            Dados do Produto/Serviço
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.48rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000' }}>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '12%' }}>CÓDIGO</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '31%' }}>DESCRIÇÃO DO PRODUTO/SERVIÇO</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '8%' }}>NCM/SH</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '4%' }}>CST</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '5%' }}>CFOP</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '3%' }}>UN</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '4%' }}>QTD.</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '7%' }}>VLR. UNIT</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '7%' }}>VLR. TOTAL</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '6%' }}>BC ICMS</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '6%' }}>VLR. ICMS</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '4%' }}>VLR. IPI</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '4%' }}>ALIQ. ICMS</th>
                  <th style={{ padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '3%' }}>ALIQ. IPI</th>
                </tr>
              </thead>
              <tbody>
                {venda.items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.sku || '-'}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.name.toUpperCase()}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.ncm || '-'}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>0102</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.cfop || '5102'}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>UN</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.quantity.toFixed(3)}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>{item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                  </tr>
                ))}
                {/* Linha em branco (spacer) para preencher a página e desenhar as grades verticais */}
                {(() => {
                  const itemRowsHeight = venda.items.length * 18
                  const spacerHeight = Math.max(60, 260 - itemRowsHeight)
                  return (
                    <tr style={{ height: `${spacerHeight}px` }}>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td style={{ borderRight: '1px solid #000' }}></td>
                      <td></td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>

          {/* Cálculo do ISSQN */}
          <SectionHeader title="Cálculo do ISSQN" />
          <FieldRow>
            <Field label="Inscrição Municipal" value="-" />
            <Field label="Valor Total dos Serviços" value="0,00" />
            <Field label="Base de Cálculo do ISSQN" value="0,00" />
            <Field label="Valor do ISSQN" value="0,00" borderRight={false} />
          </FieldRow>

          {/* Dados Adicionais */}
          <SectionHeader title="Dados Adicionais" />
          <div style={{ display: 'flex', minHeight: '50px' }}>
            <div style={{ flex: 7, padding: '3px 5px', fontSize: '0.46rem', color: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.36rem', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>INFORMAÇÕES COMPLEMENTARES</span>
                DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A<br />
                CREDITO FISCAL DE ICMS, ISS E IPI
              </div>
            </div>
            <div style={{ flex: 3, borderLeft: '1px solid #000', padding: '3px 5px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.36rem', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: '2px' }}>RESERVA AO FISCO</span>
            </div>
          </div>

        </div>

        <div className="no-print" style={{ marginTop: '1.2rem', textAlign: 'center' }}>
          <PrintButton />
        </div>
      </div>
    )
  } catch (error: any) {
    console.error("Erro ao carregar o DANFE:", error)
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', padding: '1.5rem', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', borderRadius: '8px', color: '#991b1b', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Erro ao Carregar o DANFE</h2>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>Não foi possível renderizar a nota fiscal. Por favor, verifique se a venda foi emitida com sucesso ou tente novamente mais tarde.</p>
        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
          Detalhes: {error?.message || String(error)}
        </div>
      </div>
    )
  }
}
