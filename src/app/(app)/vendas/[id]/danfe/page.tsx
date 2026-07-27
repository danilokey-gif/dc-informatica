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
      <div style={{ fontSize: '0.38rem', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '0.54rem', fontWeight: 'normal', color: '#000', wordBreak: 'break-all' }}>{value || '-'}</div>
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
      fontSize: '0.46rem',
      textTransform: 'uppercase',
      color: '#1f2937'
    }}>
      {title}
    </div>
  )
}

export default async function DanfePage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

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
    const totalFormatado = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    
    const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}`
    const bairroPrestador = empresa.enderBairro || ''
    const cepPrestador = empresa.enderCep || ''

    const enderecoCliente = venda.customer 
      ? `${venda.customer.enderLogradouro || ''}${venda.customer.enderNumero ? `, ${venda.customer.enderNumero}` : ''}` 
      : '-'

    const protocolo = "135262864994554 17/07/2026 13:56:52" // Simulado com base no padrão da SEFAZ

    return (
      <div className="danfe-container" style={{ backgroundColor: 'white', color: 'black', padding: '0.1rem', maxWidth: '780px', margin: '0 auto', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
        <style>{`
          @media print {
            @page { size: A4; margin: 3mm 4mm; }
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
          <div style={{ display: 'flex', borderBottom: '1px dashed #000', minHeight: '38px', backgroundColor: '#fff' }}>
            <div style={{ flex: 6.5, padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.42rem', lineHeight: '1.2' }}>
                RECEBEMOS DE <strong>{empresa.name.toUpperCase()}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO
              </div>
            </div>
            <div style={{ flex: 1.5, borderLeft: '1px solid #000', padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.38rem', fontWeight: 'bold', color: '#374151' }}>DATA DE RECEBIMENTO</span>
              <div style={{ borderBottom: '1px solid #999', margin: '4px 0 2px 0' }}></div>
            </div>
            <div style={{ flex: 2.2, borderLeft: '1px solid #000', padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.38rem', fontWeight: 'bold', color: '#374151' }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
              <div style={{ borderBottom: '1px solid #999', margin: '4px 0 2px 0' }}></div>
            </div>
            <div style={{ flex: 1.8, borderLeft: '1px solid #000', padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', fontWeight: 'bold' }}>
              <div style={{ fontSize: '0.52rem' }}>NF-e</div>
              <div style={{ fontSize: '0.56rem', marginTop: '1px' }}>Nº {String(emissao.numero).padStart(9, '0')}</div>
              <div style={{ fontSize: '0.44rem', color: '#374151' }}>SÉRIE {emissao.serie}</div>
            </div>
          </div>

          {/* 2. CABEÇALHO EMITENTE */}
          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '80px' }}>
            
            {/* Col 1: Emitente */}
            <div style={{ width: '38%', padding: '4px 6px', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {empresa.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={empresa.logo} alt="Logo" style={{ height: '36px', width: '36px', objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 'bold' }}>{empresa.name.toUpperCase()}</div>
                <div style={{ fontSize: '0.42rem', color: '#4b5563', marginTop: '2px' }}>
                  {enderecoPrestador} - {bairroPrestador} - {cepPrestador}<br />
                  MARILIA - SP<br />
                  FONE: {empresa.phone || '-'}
                </div>
              </div>
            </div>
            
            {/* Col 2: DANFE */}
            <div style={{ width: '27%', padding: '4px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.82rem', letterSpacing: '0.5px' }}>DANFE</div>
              <div style={{ fontSize: '0.42rem', color: '#4b5563', lineHeight: '1.2', marginTop: '1px' }}>
                Documento Auxiliar da<br />Nota Fiscal Eletrônica
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.44rem', border: '1px solid #000', padding: '1px 4px', margin: '3px 0', borderRadius: '1px' }}>
                <span>0 - Entrada</span>
                <strong>1</strong>
                <span>1 - Saída</span>
              </div>
              <div style={{ fontSize: '0.52rem', fontWeight: 'bold' }}>Nº {String(emissao.numero).padStart(9, '0')}</div>
              <div style={{ fontSize: '0.52rem', fontWeight: 'bold' }}>Série {emissao.serie}</div>
              <div style={{ fontSize: '0.38rem', color: '#4b5563' }}>FL 1 / 1</div>
            </div>
            
            {/* Col 3: Controle do Fisco */}
            <div style={{ width: '35%', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={barcodeDataUrl} alt="Código de Barras" style={{ height: '24px', width: '92%' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.38rem', fontWeight: 'bold', color: '#4b5563' }}>CHAVE DE ACESSO</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.56rem', fontWeight: 'bold', color: '#000', letterSpacing: '0.2px' }}>{chaveFormatada}</div>
                <div style={{ fontSize: '0.38rem', color: '#4b5563', marginTop: '1px' }}>Consulte a autenticidade no portal nacional da NF-e</div>
              </div>
            </div>
          </div>

          {/* Natureza da Operação */}
          <FieldRow>
            <Field label="Natureza da Operação" value="Venda de mercadoria" flex={2.5} />
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
            <Field label="Hora da Saída" value={new Date(venda.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} borderRight={false} />
          </FieldRow>

          {/* Fatura / Duplicatas */}
          <SectionHeader title="Fatura / Duplicatas" />
          <FieldRow minHeight="18px">
            <Field label="Fatura" value={`Pagamento à Vista - Forma: ${venda.paymentMethod.toUpperCase()}`} borderRight={false} />
          </FieldRow>

          {/* Cálculo do Imposto */}
          <SectionHeader title="Cálculo do Imposto" />
          <FieldRow>
            <Field label="Base de Cálculo ICMS" value="R$ 0,00" />
            <Field label="Valor do ICMS" value="R$ 0,00" />
            <Field label="Base de Cálculo ICMS ST" value="R$ 0,00" />
            <Field label="Valor do ICMS ST" value="R$ 0,00" />
            <Field label="Valor Total dos Produtos" value={totalFormatado} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Valor do Frete" value="R$ 0,00" />
            <Field label="Valor do Seguro" value="R$ 0,00" />
            <Field label="Desconto" value="R$ 0,00" />
            <Field label="Outras Despesas Acessórias" value="R$ 0,00" />
            <Field label="Valor do IPI" value="R$ 0,00" />
            <Field label="Valor Total da Nota" value={totalFormatado} borderRight={false} />
          </FieldRow>

          {/* Transportador / Volumes */}
          <SectionHeader title="Transportador / Volumes Transportados" />
          <FieldRow>
            <Field label="Razão Social" value="Sem frete" flex={2.2} />
            <Field label="Frete por Conta" value="9 - Sem frete" />
            <Field label="Código ANTT" value="-" />
            <Field label="Placa do Veículo" value="-" />
            <Field label="UF" value="-" />
            <Field label="CNPJ / CPF" value="-" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value="-" flex={2.5} />
            <Field label="Município" value="-" flex={1.5} />
            <Field label="UF" value="-" />
            <Field label="Inscrição Estadual" value="-" borderRight={false} />
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
          <div style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000', borderTop: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', fontSize: '0.46rem', textTransform: 'uppercase', color: '#1f2937' }}>
            Dados dos Produtos / Serviços
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.50rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000' }}>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '9%' }}>CÓD. PROD.</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '31%' }}>DADOS DO PRODUTO / SERVIÇOS</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '7%' }}>NCM</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '4%' }}>CST</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '5%' }}>CFOP</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '3%' }}>UN</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', width: '4%' }}>QUANT.</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '7%' }}>V. UNIT.</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '6%' }}>VAL. DESC.</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '7%' }}>V. TOTAL</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '6%' }}>BC. ICMS</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '6%' }}>V. ICMS</th>
                  <th style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '4%' }}>% ICMS</th>
                  <th style={{ padding: '2px 3px', textAlign: 'right', fontWeight: 'bold', width: '3%' }}>% IPI</th>
                </tr>
              </thead>
              <tbody>
                {venda.items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.sku || '-'}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.name.toUpperCase()}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.ncm || '-'}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>102</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.product.cfop || '5102'}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>UN</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', color: '#000' }}>{item.quantity}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>{item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ borderRight: '1px solid #000', padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                    <td style={{ padding: '2px 3px', textAlign: 'right', color: '#000' }}>0,00</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cálculo do ISSQN */}
          <SectionHeader title="Cálculo do ISSQN" />
          <FieldRow>
            <Field label="Inscrição Municipal" value="-" />
            <Field label="Valor Total dos Serviços" value="R$ 0,00" />
            <Field label="Base de Cálculo do ISSQN" value="R$ 0,00" />
            <Field label="Valor do ISSQN" value="R$ 0,00" borderRight={false} />
          </FieldRow>

          {/* Dados Adicionais */}
          <SectionHeader title="Dados Adicionais" />
          <div style={{ display: 'flex', minHeight: '50px' }}>
            <div style={{ flex: 7, padding: '3px 5px', fontSize: '0.48rem', color: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.38rem', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>INFORMAÇÕES COMPLEMENTARES</span>
                Nota emitida em ambiente de homologação. Produtos fornecidos por {empresa.name.toUpperCase()}.
              </div>
              <div style={{ fontSize: '0.40rem', color: '#6b7280', marginTop: '4px' }}>
                Documento emitido por Antigravity ERP | Assistência Técnica
              </div>
            </div>
            <div style={{ flex: 3, borderLeft: '1px solid #000', padding: '3px 5px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.38rem', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: '2px' }}>RESERVADO AO FISCO</span>
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
