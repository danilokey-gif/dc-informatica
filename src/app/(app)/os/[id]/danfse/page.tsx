import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarQrCodeDataUrl } from "@/lib/qrcode-util"
import PrintButton from "../imprimir/PrintButton"

export const dynamic = 'force-dynamic'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#e8e8e8', border: '1px solid #333', borderTop: 'none', padding: '0.1rem 0.4rem', fontSize: '0.62rem', fontWeight: 'bold', marginTop: '0.1rem' }}>
      {children}
    </div>
  )
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.06rem 0.4rem', borderBottom: '1px solid #ddd', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}>
      <span style={{ fontWeight: 'bold', minWidth: '185px', flexShrink: 0 }}>{label}:</span>
      <span>{value || '-'}</span>
    </div>
  )
}

export default async function DanfsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
  // O governo atribui um número de NFS-e próprio (nNFSe), diferente do número da DPS que enviamos.
  const numeroNfse = emissao.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || emissao.numeroDps
  const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`
  const codigoServicoFormatado = `${nfseConfig.codigoServico?.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')}${nfseConfig.descricaoCodServico ? ` - ${nfseConfig.descricaoCodServico}` : ''}`

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '0.6rem', maxWidth: '780px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '0.58rem', lineHeight: 1.15 }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { height: auto !important; }
        }
      `}</style>

      {emissao.ambiente !== 'producao' && (
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.25rem', marginBottom: '0.35rem', border: '1px solid #991b1b', fontSize: '0.6rem' }}>
          NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #333', padding: '0.3rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '28%' }}>
          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo} alt={empresa.name} style={{ height: '24px', width: '24px', objectFit: 'contain', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '0.56rem', fontWeight: 'bold', lineHeight: 1.15 }}>NFSe<br /><span style={{ fontWeight: 'normal', fontSize: '0.46rem' }}>Nota Fiscal de Serviço eletrônica</span></span>
        </div>
        <div style={{ textAlign: 'center', width: '44%' }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.72rem' }}>DANFSe v1.0</div>
          <div style={{ fontSize: '0.56rem' }}>Documento Auxiliar da NFS-e</div>
        </div>
        <div style={{ textAlign: 'right', width: '28%', fontSize: '0.5rem' }}>
          <div style={{ fontWeight: 'bold' }}>MUNICÍPIO DE {(nfseConfig.nomeMunicipio || '').toUpperCase()}</div>
        </div>
      </div>

      {/* Identificação + QR */}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <Campo label="Chave de Acesso da NFS-e" value={<span style={{ fontFamily: 'monospace' }}>{emissao.chaveAcesso}</span>} />
          <Campo label="Número da NFS-e" value={numeroNfse} />
          <Campo label="Competência da NFS-e" value={emissao.createdAt.toLocaleDateString('pt-BR')} />
          <Campo label="Data e Hora da emissão da NFS-e" value={emissao.createdAt.toLocaleString('pt-BR')} />
          <Campo label="Número da DPS" value={emissao.numeroDps} />
          <Campo label="Série da DPS" value={emissao.serieDps} />
          <Campo label="Data e Hora da emissão da DPS" value={emissao.createdAt.toLocaleString('pt-BR')} />
        </div>
        <div style={{ width: '85px', flexShrink: 0, border: '1px solid #333', borderLeft: 'none', padding: '0.15rem', textAlign: 'center', boxSizing: 'border-box' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeDataUrl} alt="QR Code" style={{ width: '60px', height: '60px', maxWidth: '100%' }} />
          <p style={{ fontSize: '0.36rem', margin: '0.1rem 0 0 0', lineHeight: 1.1 }}>Autenticidade verificável pela leitura deste QR ou pela chave no portal nacional da NFS-e</p>
        </div>
      </div>

      {/* Emitente */}
      <SectionTitle>EMITENTE DA NFS-e — Prestador do Serviço</SectionTitle>
      <Campo label="CNPJ / CPF / NIF" value={empresa.document} />
      <Campo label="Inscrição Municipal" value={null} />
      <Campo label="Telefone" value={empresa.phone} />
      <Campo label="Nome / Nome Empresarial" value={empresa.name} />
      <Campo label="E-mail" value={empresa.email} />
      <Campo label="Endereço" value={enderecoPrestador} />
      <Campo label="Município" value={municipioLabel} />
      <Campo label="CEP" value={empresa.enderCep} />
      <Campo label="Simples Nacional na Data de Competência" value={simplesLabel} />
      <Campo label="Regime de Apuração Tributária pelo SN" value={ehMei ? null : (nfseConfig.regimeTributario === 'SIMPLES' ? 'Regime de apuração dos tributos federais e SN' : null)} />

      {/* Tomador */}
      <SectionTitle>TOMADOR DO SERVIÇO</SectionTitle>
      <Campo label="CNPJ / CPF / NIF" value={os.customer.document} />
      <Campo label="Inscrição Municipal" value={null} />
      <Campo label="Telefone" value={os.customer.phone} />
      <Campo label="Nome / Nome Empresarial" value={os.customer.name} />
      <Campo label="E-mail" value={os.customer.email} />
      <Campo label="Endereço" value={os.customer.address} />
      <Campo label="Município" value={municipioLabel} />
      <Campo label="CEP" value={null} />

      <SectionTitle>INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e</SectionTitle>

      {/* Serviço */}
      <SectionTitle>SERVIÇO PRESTADO</SectionTitle>
      <Campo label="Código de Tributação Nacional" value={codigoServicoFormatado} />
      <Campo label="Local da Prestação" value={municipioLabel} />
      <Campo label="País da Prestação" value="Brasil" />
      <Campo label="Descrição do Serviço" value={`${os.device} — ${os.issue}`} />

      {/* Tributação Municipal */}
      <SectionTitle>TRIBUTAÇÃO MUNICIPAL</SectionTitle>
      <Campo label="Tributação do ISSQN" value="Operação Tributável" />
      <Campo label="Município de Incidência do ISSQN" value={municipioLabel} />
      <Campo label="Regime Especial de Tributação" value="Nenhum" />
      <Campo label="Suspensão da Exigibilidade do ISSQN" value="Não" />
      <Campo label="Valor do Serviço" value={valorFormatado} />
      <Campo label="BC ISSQN" value={ehMei ? null : valorFormatado} />
      <Campo label="Alíquota Aplicada" value={ehMei ? null : `${nfseConfig.aliquotaIss}%`} />
      <Campo label="Retenção do ISSQN" value="Não Retido" />

      {/* Tributação Federal */}
      <SectionTitle>TRIBUTAÇÃO FEDERAL</SectionTitle>
      <Campo label="IRRF" value={null} />
      <Campo label="Contribuição Previdenciária - Retida" value={null} />
      <Campo label="Contribuições Sociais - Retidas" value={null} />
      <Campo label="PIS/COFINS - Débito Apuração Própria" value={null} />

      {/* Valor total */}
      <SectionTitle>VALOR TOTAL DA NFS-E</SectionTitle>
      <Campo label="Valor do Serviço" value={valorFormatado} />
      <Campo label="Descontos" value={null} />
      <Campo label="ISSQN Retido" value={null} />
      <Campo label="Valor Líquido da NFS-e" value={valorFormatado} />

      <div className="no-print" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
