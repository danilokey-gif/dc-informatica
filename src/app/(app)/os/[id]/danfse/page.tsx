import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarQrCodeDataUrl } from "@/lib/qrcode-util"
import PrintButton from "../imprimir/PrintButton"

export const dynamic = 'force-dynamic'

function Field({ label, value, flex = 1 }: { label: string; value?: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex, padding: '0.07rem 0.4rem', minWidth: 0 }}>
      <div style={{ fontWeight: 'bold' }}>{label}</div>
      <div>{value || '-'}</div>
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
      {children}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '0.1rem 0.4rem', fontWeight: 'bold' }}>
      {title}
      {subtitle && <div style={{ fontWeight: 'normal' }}>{subtitle}</div>}
    </div>
  )
}

function NfseLogo({ height = 30 }: { height?: number }) {
  return (
    <svg viewBox="0 0 300 100" style={{ height, width: 'auto', flexShrink: 0 }}>
      <text x="0" y="72" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="80" fill="#4f9c5c">N</text>
      <path d="M30 18 L46 18 L46 34 L30 34 Z" fill="#f4c430" />
      <path d="M30 18 A16 16 0 0 1 46 34 L30 34 Z" fill="#2d4373" />
      <text x="62" y="72" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="80" fill="#5aab66">F</text>
      <text x="122" y="72" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="80" fill="#7ec488">S</text>
      <text x="184" y="80" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="58" fill="#2d4373">e</text>
      <text x="0" y="94" fontFamily="Arial, sans-serif" fontSize="15" fill="#6b7280">Nota Fiscal de Serviço eletrônica</text>
    </svg>
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
  const numeroNfse = emissao.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || emissao.numeroDps
  const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`
  const codigoServicoFormatado = `${nfseConfig.codigoServico?.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')}${nfseConfig.descricaoCodServico ? ` - ${nfseConfig.descricaoCodServico}` : ''}`

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '0.4rem', maxWidth: '780px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '0.58rem', lineHeight: 1.15, border: '1px solid #000' }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { height: auto !important; }
        }
      `}</style>

      {emissao.ambiente !== 'producao' && (
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.25rem', border: '1px solid #991b1b', fontSize: '0.6rem' }}>
          NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #000', padding: '0.3rem 0.4rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '28%' }}>
          <NfseLogo height={32} />
        </div>
        <div style={{ textAlign: 'center', width: '44%' }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.72rem' }}>DANFSe v1.0</div>
          <div style={{ fontSize: '0.56rem' }}>Documento Auxiliar da NFS-e</div>
        </div>
        <div style={{ textAlign: 'right', width: '28%', fontSize: '0.5rem' }}>
          <div style={{ fontWeight: 'bold' }}>MUNICÍPIO DE {(nfseConfig.nomeMunicipio || '').toUpperCase()}</div>
        </div>
      </div>

      {/* Chave de acesso + QR */}
      <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
        <div style={{ flex: 1, padding: '0.12rem 0.4rem' }}>
          <div style={{ fontWeight: 'bold' }}>Chave de Acesso da NFS-e</div>
          <div style={{ fontFamily: 'monospace' }}>{emissao.chaveAcesso}</div>
        </div>
        <div style={{ width: '78px', flexShrink: 0, padding: '0.15rem', textAlign: 'center', boxSizing: 'border-box', borderLeft: '1px solid #000' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeDataUrl} alt="QR Code" style={{ width: '56px', height: '56px', maxWidth: '100%' }} />
        </div>
      </div>
      <FieldRow>
        <Field label="Número da NFS-e" value={numeroNfse} />
        <Field label="Competência da NFS-e" value={emissao.createdAt.toLocaleDateString('pt-BR')} />
        <Field label="Data e Hora da emissão da NFS-e" value={emissao.createdAt.toLocaleString('pt-BR')} />
      </FieldRow>
      <FieldRow>
        <Field label="Número da DPS" value={emissao.numeroDps} />
        <Field label="Série da DPS" value={emissao.serieDps} />
        <Field label="Data e Hora da emissão da DPS" value={emissao.createdAt.toLocaleString('pt-BR')} />
      </FieldRow>

      {/* Emitente */}
      <SectionHeader title="EMITENTE DA NFS-e" subtitle="Prestador do Serviço" />
      <FieldRow>
        <Field label="CNPJ / CPF / NIF" value={empresa.document} />
        <Field label="Inscrição Municipal" value={null} />
        <Field label="Telefone" value={empresa.phone} />
      </FieldRow>
      <FieldRow>
        <Field label="Nome / Nome Empresarial" value={empresa.name} flex={2} />
        <Field label="E-mail" value={empresa.email} flex={2} />
      </FieldRow>
      <FieldRow>
        <Field label="Endereço" value={enderecoPrestador} flex={2} />
        <Field label="Município" value={municipioLabel} />
        <Field label="CEP" value={empresa.enderCep} />
      </FieldRow>
      <FieldRow>
        <Field label="Simples Nacional na Data de Competência" value={simplesLabel} flex={2} />
        <Field label="Regime de Apuração Tributária pelo SN" value={ehMei ? null : (nfseConfig.regimeTributario === 'SIMPLES' ? 'Regime de apuração dos tributos federais e SN' : null)} flex={2} />
      </FieldRow>

      {/* Tomador */}
      <SectionHeader title="TOMADOR DO SERVIÇO" />
      <FieldRow>
        <Field label="CNPJ / CPF / NIF" value={os.customer.document} />
        <Field label="Inscrição Municipal" value={null} />
        <Field label="Telefone" value={os.customer.phone} />
      </FieldRow>
      <FieldRow>
        <Field label="Nome / Nome Empresarial" value={os.customer.name} flex={2} />
        <Field label="E-mail" value={os.customer.email} flex={2} />
      </FieldRow>
      <FieldRow>
        <Field label="Endereço" value={os.customer.address} flex={2} />
        <Field label="Município" value={municipioLabel} />
        <Field label="CEP" value={null} />
      </FieldRow>

      <div style={{ borderBottom: '1px solid #000', padding: '0.08rem 0.4rem', fontWeight: 'bold' }}>
        INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e
      </div>

      {/* Serviço */}
      <SectionHeader title="SERVIÇO PRESTADO" />
      <FieldRow>
        <Field label="Código de Tributação Nacional" value={codigoServicoFormatado} flex={2} />
        <Field label="Local da Prestação" value={municipioLabel} />
        <Field label="País da Prestação" value="Brasil" />
      </FieldRow>
      <FieldRow>
        <Field label="Descrição do Serviço" value={`${os.device} — ${os.issue}`} flex={4} />
      </FieldRow>

      {/* Tributação Municipal */}
      <SectionHeader title="TRIBUTAÇÃO MUNICIPAL" />
      <FieldRow>
        <Field label="Tributação do ISSQN" value="Operação Tributável" />
        <Field label="Município de Incidência do ISSQN" value={municipioLabel} />
        <Field label="Regime Especial de Tributação" value="Nenhum" />
        <Field label="Suspensão da Exigibilidade do ISSQN" value="Não" />
      </FieldRow>
      <FieldRow>
        <Field label="Valor do Serviço" value={valorFormatado} />
        <Field label="BC ISSQN" value={ehMei ? null : valorFormatado} />
        <Field label="Alíquota Aplicada" value={ehMei ? null : `${nfseConfig.aliquotaIss}%`} />
        <Field label="Retenção do ISSQN" value="Não Retido" />
      </FieldRow>

      {/* Tributação Federal */}
      <SectionHeader title="TRIBUTAÇÃO FEDERAL" />
      <FieldRow>
        <Field label="IRRF" value={null} />
        <Field label="Contribuição Previdenciária - Retida" value={null} />
        <Field label="Contribuições Sociais - Retidas" value={null} />
        <Field label="PIS/COFINS - Débito Apuração Própria" value={null} />
      </FieldRow>

      {/* Valor total */}
      <SectionHeader title="VALOR TOTAL DA NFS-E" />
      <FieldRow>
        <Field label="Valor do Serviço" value={valorFormatado} />
        <Field label="Descontos" value={null} />
        <Field label="ISSQN Retido" value={null} />
        <Field label="Valor Líquido da NFS-e" value={valorFormatado} />
      </FieldRow>

      <div className="no-print" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
