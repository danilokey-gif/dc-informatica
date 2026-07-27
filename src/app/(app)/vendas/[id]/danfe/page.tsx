import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarCode128DataUrl } from "@/lib/barcode"
import PrintButton from "../../../os/[id]/imprimir/PrintButton"

export const dynamic = 'force-dynamic'

function Field({ label, value, flex = 1, borderRight = true }: { label: string; value?: React.ReactNode; flex?: number; borderRight?: boolean }) {
  return (
    <div style={{
      flex,
      padding: '4px 6px',
      minWidth: 0,
      borderRight: borderRight ? '1px solid #000' : 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div style={{ fontSize: '0.44rem', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '0.58rem', fontWeight: 'normal', color: '#000', wordBreak: 'break-all' }}>{value || '-'}</div>
    </div>
  )
}

function FieldRow({ children, borderBottom = true }: { children: React.ReactNode; borderBottom?: boolean }) {
  return (
    <div style={{ display: 'flex', borderBottom: borderBottom ? '1px solid #000' : 'none', minHeight: '28px' }}>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      backgroundColor: '#f3f4f6',
      borderBottom: '1px solid #000',
      padding: '4px 6px',
      fontWeight: 'bold',
      fontSize: '0.50rem',
      textTransform: 'uppercase',
      color: '#1f2937'
    }}>
      {title}
    </div>
  )
}

export default async function DanfePage({ params }: { params: Promise<{ id: string }> }) {
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
  
  const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`
  const enderecoCliente = venda.customer 
    ? `${venda.customer.enderLogradouro || ''}${venda.customer.enderNumero ? `, ${venda.customer.enderNumero}` : ''}` 
    : '-'

  return (
    <div className="danfe-container" style={{ backgroundColor: 'white', color: 'black', padding: '0.2rem', maxWidth: '780px', margin: '0 auto', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 4mm 5mm; }
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
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.2rem', border: '1px solid #991b1b', fontSize: '0.58rem', marginBottom: '0.3rem' }}>
          NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      {/* Container Principal com bordas externas */}
      <div style={{ border: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
        
        {/* Cabeçalho Oficial */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '52px' }}>
          {/* Col 1: Emitente */}
          <div style={{ width: '38%', padding: '4px 8px', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {empresa.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logo} alt="Logo" style={{ height: '36px', width: '36px', objectFit: 'contain', flexShrink: 0 }} />
            )}
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 'bold' }}>{empresa.name}</div>
              <div style={{ fontSize: '0.42rem', color: '#4b5563', marginTop: '1px' }}>
                CNPJ: {empresa.document}<br />
                IE: {empresa.inscricaoEstadual}<br />
                {enderecoPrestador}
              </div>
            </div>
          </div>
          
          {/* Col 2: DANFE */}
          <div style={{ width: '27%', padding: '4px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '0.5px' }}>DANFE</div>
            <div style={{ fontSize: '0.46rem', color: '#4b5563', marginTop: '1px' }}>
              Documento Auxiliar da<br />Nota Fiscal Eletrônica
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '0.44rem', border: '1px solid #000', padding: '1px 3px', margin: '2px 0', borderRadius: '2px' }}>
              <span>0 - Entrada</span>
              <strong>1</strong>
              <span>1 - Saída</span>
            </div>
            <div style={{ fontSize: '0.52rem', fontWeight: 'bold' }}>Nº {emissao.numero} — Série {emissao.serie}</div>
          </div>
          
          {/* Col 3: Controle do Fisco */}
          <div style={{ width: '35%', padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={barcodeDataUrl} alt="Código de Barras" style={{ height: '24px', width: '90%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.42rem', fontWeight: 'bold', color: '#4b5563' }}>CHAVE DE ACESSO</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.58rem', fontWeight: 'bold' }}>{chaveFormatada}</div>
              <div style={{ fontSize: '0.42rem', color: '#6b7280' }}>Consulte a autenticidade em www.nfe.fazenda.gov.br</div>
            </div>
          </div>
        </div>

        {/* Natureza da Operação */}
        <SectionHeader title="Natureza da Operação" />
        <FieldRow>
          <Field label="Natureza da Operação" value="Venda de mercadoria" flex={2} />
          <Field label="Protocolo de Autorização de Uso" value="Homologado pelo emissor nacional" flex={2} borderRight={false} />
        </FieldRow>

        {/* Destinatário */}
        <SectionHeader title="Destinatário / Remetente" />
        <FieldRow>
          <Field label="Nome / Razão Social" value={venda.customer?.name || 'Consumidor não identificado'} flex={2} />
          <Field label="CNPJ / CPF" value={venda.customer?.document || '-'} />
          <Field label="Data da Emissão" value={new Date(venda.createdAt).toLocaleDateString('pt-BR')} borderRight={false} />
        </FieldRow>
        <FieldRow>
          <Field label="Endereço" value={enderecoCliente} flex={2} />
          <Field label="Bairro / Distrito" value={venda.customer?.enderBairro || '-'} />
          <Field label="CEP" value={venda.customer?.enderCep || '-'} borderRight={false} />
        </FieldRow>
        <FieldRow>
          <Field label="Município" value={venda.customer?.enderMunicipio || '-'} flex={2} />
          <Field label="UF" value={venda.customer?.enderUf || '-'} />
          <Field label="Inscrição Estadual" value="-" borderRight={false} />
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
          <Field label="Outras Despesas" value="R$ 0,00" />
          <Field label="Valor do IPI" value="R$ 0,00" />
          <Field label="Valor Total da Nota" value={totalFormatado} borderRight={false} />
        </FieldRow>

        {/* Transportador / Volumes */}
        <SectionHeader title="Transportador / Volumes Transportados" />
        <FieldRow>
          <Field label="Razão Social" value="Sem frete" flex={2} />
          <Field label="Frete por Conta" value="9 - Sem frete" />
          <Field label="Placa do Veículo" value="-" />
          <Field label="UF" value="-" />
          <Field label="CNPJ / CPF" value="-" borderRight={false} />
        </FieldRow>

        {/* Dados dos Produtos */}
        <div style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000', borderTop: '1px solid #000', padding: '4px 6px', fontWeight: 'bold', fontSize: '0.50rem', textTransform: 'uppercase', color: '#1f2937' }}>
          Dados dos Produtos / Serviços
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.55rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '10%' }}>CÓDIGO</th>
                <th style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '45%' }}>DESCRIÇÃO DO PRODUTO</th>
                <th style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '9%' }}>NCM</th>
                <th style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '8%' }}>CFOP</th>
                <th style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '6%' }}>QTD.</th>
                <th style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '11%' }}>V. UNIT.</th>
                <th style={{ borderBottom: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', color: '#4b5563', width: '11%' }}>V. TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {venda.items.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{item.product.sku || '-'}</td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{item.product.name}</td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{item.product.ncm || '-'}</td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{item.product.cfop || '-'}</td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{item.quantity}</td>
                  <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td style={{ borderBottom: '1px solid #000', padding: '3px 4px', color: '#000' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dados Adicionais */}
        <SectionHeader title="Dados Adicionais" />
        <FieldRow borderBottom={false}>
          <Field label="Informações Complementares" value={`Nota emitida em ambiente de homologação. Produtos fornecidos por ${empresa.name}.`} borderRight={false} />
        </FieldRow>

      </div>

      <div className="no-print" style={{ marginTop: '1.2rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
