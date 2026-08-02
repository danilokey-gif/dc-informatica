import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarQrCodeDataUrl } from "@/lib/qrcode-util"
import PrintButton from "../imprimir/PrintButton"

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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
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
      {subtitle && <span style={{ fontWeight: 'normal', fontSize: '0.44rem', marginLeft: '4px', color: '#4b5563' }}>— {subtitle}</span>}
    </div>
  )
}

export default async function DanfsePage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = params

    const [os, empresa, nfseConfig] = await Promise.all([
      prisma.serviceOrder.findUnique({
        where: { id },
        include: { customer: true, nfseEmissoes: { where: { status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } } }
      }),
      getCompanySettings(),
      getNfseConfig(),
    ])

    if (!os) notFound()

    const emissao = os.nfseEmissoes[0]
    if (!emissao || !emissao.chaveAcesso) {
      return (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
          <p>Esta Ordem de Serviço ainda não tem uma NFS-e autorizada.</p>
        </div>
      )
    }

    const qrCodeDataUrl = await gerarQrCodeDataUrl(emissao.chaveAcesso)
    const valorServico = os.price || 0
    const valorFormatado = valorServico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const ehMei = nfseConfig.regimeTributario === 'MEI'
    const simplesLabel = ehMei
      ? 'Optante - Microempreendedor Individual (MEI)'
      : nfseConfig.regimeTributario === 'SIMPLES'
        ? 'Optante - Simples Nacional (ME/EPP)'
        : 'Não Optante'
    const municipioLabel = nfseConfig.nomeMunicipio ? `${nfseConfig.nomeMunicipio} - SP` : '-'
    const numeroNfse = emissao.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || emissao.numeroDps
    const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`
    const codigoServicoFormatado = `${nfseConfig.codigoServico?.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')}${nfseConfig.descricaoCodServico ? ` - ${nfseConfig.descricaoCodServico}` : ''}`

    return (
      <div className="danfse-container" style={{ backgroundColor: 'white', color: 'black', padding: '0.2rem', maxWidth: '780px', margin: '0 auto', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
        <style>{`
          @media print {
            @page { size: A4; margin: 4mm 5mm; }
            html, body { height: auto !important; margin: 0 !important; padding: 0 !important; background: white; }
            .danfse-container {
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
            NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
          </div>
        )}

        {/* Container Principal com bordas externas */}
        <div style={{ border: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
          
          {/* Cabeçalho Oficial */}
          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '52px' }}>
            {/* Col 1: NFSe Logo */}
            <div style={{ width: '30%', padding: '4px 8px', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-nfse.png" alt="NFS-e Nacional" style={{ height: '36px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 'bold' }}>NFS-e</div>
                <div style={{ fontSize: '0.44rem', color: '#4b5563' }}>Nota Fiscal de Serviço eletrônica</div>
              </div>
            </div>
            
            {/* Col 2: DANFSe */}
            <div style={{ width: '40%', padding: '4px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '0.5px' }}>DANFSe</div>
              <div style={{ fontSize: '0.52rem', color: '#4b5563', marginTop: '1px' }}>Documento Auxiliar da NFS-e</div>
            </div>
            
            {/* Col 3: Prefeitura de Marília Logo */}
            <div style={{ width: '30%', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-marilia.jpg" alt="Marília" style={{ height: '36px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.44rem', fontWeight: 'bold', color: '#4b5563' }}>MUNICÍPIO DE</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 'bold', color: '#000' }}>MARÍLIA - SP</div>
              </div>
            </div>
          </div>

          {/* Chave de acesso + QR */}
          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '65px' }}>
            <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.44rem', fontWeight: 'bold', color: '#4b5563' }}>CHAVE DE ACESSO DA NFS-e</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.66rem', fontWeight: 'bold', marginTop: '2px', letterSpacing: '0.5px' }}>
                  {emissao.chaveAcesso.match(/.{1,4}/g)?.join(' ') || emissao.chaveAcesso}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.44rem', fontWeight: 'bold', color: '#4b5563' }}>CONSULTA DE AUTENTICIDADE</div>
                <div style={{ fontSize: '0.46rem', color: '#6b7280' }}>Consulte a autenticidade deste documento em www.nfse.gov.br/consultapublica</div>
              </div>
            </div>
            <div style={{ width: '75px', flexShrink: 0, padding: '2px', borderLeft: '1px solid #000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="QR Code" style={{ width: '56px', height: '56px' }} />
            </div>
          </div>

          <FieldRow>
            <Field label="Número da NFS-e" value={numeroNfse} />
            <Field label="Competência da NFS-e" value={emissao.createdAt.toLocaleDateString('pt-BR')} />
            <Field label="Data e Hora da emissão da NFS-e" value={emissao.createdAt.toLocaleString('pt-BR')} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Número da DPS" value={emissao.numeroDps} />
            <Field label="Série da DPS" value={emissao.serieDps} />
            <Field label="Data e Hora da emissão da DPS" value={emissao.createdAt.toLocaleString('pt-BR')} borderRight={false} />
          </FieldRow>

          {/* Emitente */}
          <SectionHeader title="EMITENTE DA NFS-e" subtitle="Prestador do Serviço" />
          <FieldRow>
            <Field label="CNPJ / CPF / NIF" value={empresa.document} />
            <Field label="Inscrição Municipal" value="-" />
            <Field label="Telefone" value={empresa.phone} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Nome / Nome Empresarial" value={empresa.name} flex={2} />
            <Field label="E-mail" value={empresa.email} flex={2} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value={enderecoPrestador} flex={2} />
            <Field label="Município" value={municipioLabel} />
            <Field label="CEP" value={empresa.enderCep} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Simples Nacional na Data de Competência" value={simplesLabel} flex={2} />
            <Field label="Regime de Apuração Tributária pelo SN" value={ehMei ? '-' : (nfseConfig.regimeTributario === 'SIMPLES' ? 'Regime de apuração dos tributos federais e SN' : '-')} flex={2} borderRight={false} />
          </FieldRow>

          {/* Tomador */}
          <SectionHeader title="TOMADOR DO SERVIÇO" />
          <FieldRow>
            <Field label="CNPJ / CPF / NIF" value={os.customer.document} />
            <Field label="Inscrição Municipal" value="-" />
            <Field label="Telefone" value={os.customer.phone} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Nome / Nome Empresarial" value={os.customer.name} flex={2} />
            <Field label="E-mail" value={os.customer.email} flex={2} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value={os.customer.address} flex={2} />
            <Field label="Município" value={municipioLabel} />
            <Field label="CEP" value="-" borderRight={false} />
          </FieldRow>

          {/* Intermediário */}
          <SectionHeader title="INTERMEDIÁRIO DO SERVIÇO" />
          <FieldRow>
            <Field label="Identificação do Intermediário" value="Intermediário do serviço não identificado na NFS-e" borderRight={false} />
          </FieldRow>

          {/* Serviço */}
          <SectionHeader title="SERVIÇO PRESTADO" />
          <FieldRow>
            <Field label="Código de Tributação Nacional" value={codigoServicoFormatado} flex={2} />
            <Field label="Local da Prestação" value={municipioLabel} />
            <Field label="País da Prestação" value="Brasil" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Descrição do Serviço" value={
              <div style={{ minHeight: '90px', fontSize: '0.62rem', whiteSpace: 'pre-wrap', lineHeight: 1.25 }}>
                {[os.device, os.issue].filter(Boolean).join(' — ')}
              </div>
            } borderRight={false} />
          </FieldRow>

          {/* Tributação Municipal */}
          <SectionHeader title="TRIBUTAÇÃO MUNICIPAL" />
          <FieldRow>
            <Field label="Tributação do ISSQN" value="Operação Tributável" />
            <Field label="Município de Incidência do ISSQN" value={municipioLabel} />
            <Field label="Regime Especial de Tributação" value="Nenhum" />
            <Field label="Suspensão da Exigibilidade do ISSQN" value="Não" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Valor do Serviço" value={valorFormatado} />
            <Field label="BC ISSQN" value={ehMei ? '-' : valorFormatado} />
            <Field label="Alíquota Aplicada" value={ehMei ? 'Não se aplica (MEI)' : `${nfseConfig.aliquotaIss}%`} />
            <Field label="Retenção do ISSQN" value="Não Retido" borderRight={false} />
          </FieldRow>

          {/* Tributação Federal */}
          <SectionHeader title="TRIBUTAÇÃO FEDERAL" />
          <FieldRow>
            <Field label="IRRF" value="-" />
            <Field label="Contribuição Previdenciária - Retida" value="-" />
            <Field label="Contribuições Sociais - Retidas" value="-" />
            <Field label="PIS/COFINS - Débito Apuração Própria" value="-" borderRight={false} />
          </FieldRow>

          {/* Valor total */}
          <SectionHeader title="VALOR TOTAL DA NFS-E" />
          <FieldRow borderBottom={false}>
            <Field label="Valor do Serviço" value={valorFormatado} />
            <Field label="Descontos" value="-" />
            <Field label="ISSQN Retido" value="-" />
            <Field label="Valor Líquido da NFS-e" value={valorFormatado} borderRight={false} />
          </FieldRow>

        </div>

        <div className="no-print" style={{ marginTop: '1.2rem', textAlign: 'center' }}>
          <PrintButton />
        </div>
      </div>
    )
  } catch (error: any) {
    console.error("Erro ao carregar o DANFSe:", error)
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', padding: '1.5rem', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', borderRadius: '8px', color: '#991b1b', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Erro ao Carregar o DANFSe</h2>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>Não foi possível renderizar a nota fiscal de serviço. Por favor, verifique se a ordem de serviço foi emitida com sucesso ou tente novamente mais tarde.</p>
        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
          Detalhes: {error?.message || String(error)}
        </div>
      </div>
    )
  }
}
