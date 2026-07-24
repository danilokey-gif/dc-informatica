import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarQrCodeDataUrl } from "@/lib/qrcode-util"
import PrintButton from "../imprimir/PrintButton"

export const dynamic = 'force-dynamic'

const border = '1px solid #333'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#e8e8e8', border, borderTop: 'none', padding: '0.1rem 0.4rem', fontSize: '0.6rem', fontWeight: 'bold', lineHeight: 1.3 }}>
      {children}
    </div>
  )
}

function Campo({ label, value, flex = 1 }: { label: string; value: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex, border, borderTop: 'none', borderRight: 'none', padding: '0.15rem 0.35rem', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '0.52rem', fontWeight: 'bold', lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: '0.62rem', lineHeight: 1.25 }}>{value || '-'}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', borderRight: border }}>{children}</div>
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

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '0.6rem', maxWidth: '850px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '0.62rem', lineHeight: 1.25 }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          html, body { height: auto !important; }
        }
      `}</style>

      {emissao.ambiente !== 'producao' && (
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.3rem', marginBottom: '0.4rem', border: '1px solid #991b1b', fontSize: '0.6rem' }}>
          NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', border, padding: '0.3rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '28%' }}>
          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo} alt={empresa.name} style={{ height: '26px', width: '26px', objectFit: 'contain', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '0.58rem', fontWeight: 'bold', lineHeight: 1.2 }}>NFSe<br /><span style={{ fontWeight: 'normal', fontSize: '0.48rem' }}>Nota Fiscal de Serviço eletrônica</span></span>
        </div>
        <div style={{ textAlign: 'center', width: '44%' }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.72rem' }}>DANFSe v1.0</div>
          <div style={{ fontSize: '0.6rem' }}>Documento Auxiliar da NFS-e</div>
        </div>
        <div style={{ textAlign: 'right', width: '28%', fontSize: '0.56rem' }}>
          <div style={{ fontWeight: 'bold' }}>MUNICÍPIO DE {(nfseConfig.nomeMunicipio || '').toUpperCase()}</div>
        </div>
      </div>

      {/* Chave de acesso */}
      <div style={{ border, borderTop: 'none', padding: '0.2rem 0.4rem' }}>
        <div style={{ fontSize: '0.52rem', fontWeight: 'bold' }}>Chave de Acesso da NFS-e</div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.62rem' }}>{emissao.chaveAcesso}</div>
      </div>

      {/* Identificação + QR */}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <Row>
            <Campo label="Número da NFS-e" value={numeroNfse} />
            <Campo label="Competência da NFS-e" value={emissao.createdAt.toLocaleDateString('pt-BR')} />
            <Campo label="Data e Hora da emissão da NFS-e" value={emissao.createdAt.toLocaleString('pt-BR')} />
          </Row>
          <Row>
            <Campo label="Número da DPS" value={emissao.numeroDps} />
            <Campo label="Série da DPS" value={emissao.serieDps} />
            <Campo label="Data e Hora da emissão da DPS" value={emissao.createdAt.toLocaleString('pt-BR')} />
          </Row>
        </div>
        <div style={{ width: '92px', flexShrink: 0, border, borderLeft: 'none', borderTop: 'none', padding: '0.2rem', textAlign: 'center', boxSizing: 'border-box' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeDataUrl} alt="QR Code" style={{ width: '68px', height: '68px', maxWidth: '100%' }} />
          <p style={{ fontSize: '0.42rem', margin: '0.15rem 0 0 0', lineHeight: 1.15 }}>Autenticidade verificável pela leitura deste QR ou pela chave no portal nacional da NFS-e</p>
        </div>
      </div>

      {/* Emitente */}
      <SectionTitle>EMITENTE DA NFS-e — Prestador do Serviço</SectionTitle>
      <Row>
        <Campo label="CNPJ / CPF / NIF" value={empresa.document} />
        <Campo label="Inscrição Municipal" value={null} />
        <Campo label="Telefone" value={empresa.phone} />
      </Row>
      <Row>
        <Campo label="Nome / Nome Empresarial" value={empresa.name} flex={2} />
        <Campo label="E-mail" value={empresa.email} />
      </Row>
      <Row>
        <Campo label="Endereço" value={`${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`} flex={2} />
        <Campo label="Município" value={municipioLabel} />
        <Campo label="CEP" value={empresa.enderCep} />
      </Row>
      <Row>
        <Campo label="Simples Nacional na Data de Competência" value={simplesLabel} flex={2} />
        <Campo label="Regime de Apuração Tributária pelo SN" value={ehMei ? null : (nfseConfig.regimeTributario === 'SIMPLES' ? 'Regime de apuração dos tributos federais e SN' : null)} />
      </Row>

      {/* Tomador */}
      <SectionTitle>TOMADOR DO SERVIÇO</SectionTitle>
      <Row>
        <Campo label="CNPJ / CPF / NIF" value={os.customer.document} />
        <Campo label="Inscrição Municipal" value={null} />
        <Campo label="Telefone" value={os.customer.phone} />
      </Row>
      <Row>
        <Campo label="Nome / Nome Empresarial" value={os.customer.name} flex={2} />
        <Campo label="E-mail" value={os.customer.email} />
      </Row>
      <Row>
        <Campo label="Endereço" value={os.customer.address} flex={2} />
        <Campo label="Município" value={municipioLabel} />
        <Campo label="CEP" value={null} />
      </Row>

      <SectionTitle>INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e</SectionTitle>

      {/* Serviço */}
      <SectionTitle>SERVIÇO PRESTADO</SectionTitle>
      <Row>
        <Campo label="Código de Tributação Nacional" value={`${nfseConfig.codigoServico?.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')}${nfseConfig.descricaoCodServico ? ` - ${nfseConfig.descricaoCodServico}` : ''}`} flex={2} />
        <Campo label="Local da Prestação" value={municipioLabel} />
        <Campo label="País da Prestação" value="Brasil" />
      </Row>
      <Row>
        <Campo label="Descrição do Serviço" value={`${os.device} — ${os.issue}`} flex={4} />
      </Row>

      {/* Tributação Municipal */}
      <SectionTitle>TRIBUTAÇÃO MUNICIPAL</SectionTitle>
      <Row>
        <Campo label="Tributação do ISSQN" value="Operação Tributável" />
        <Campo label="Município de Incidência do ISSQN" value={municipioLabel} />
        <Campo label="Regime Especial de Tributação" value="Nenhum" />
        <Campo label="Suspensão da Exigibilidade do ISSQN" value="Não" />
      </Row>
      <Row>
        <Campo label="Valor do Serviço" value={valorFormatado} />
        <Campo label="BC ISSQN" value={ehMei ? null : valorFormatado} />
        <Campo label="Alíquota Aplicada" value={ehMei ? null : `${nfseConfig.aliquotaIss}%`} />
        <Campo label="Retenção do ISSQN" value="Não Retido" />
      </Row>

      {/* Tributação Federal */}
      <SectionTitle>TRIBUTAÇÃO FEDERAL</SectionTitle>
      <Row>
        <Campo label="IRRF" value={null} />
        <Campo label="Contribuição Previdenciária - Retida" value={null} />
        <Campo label="Contribuições Sociais - Retidas" value={null} />
        <Campo label="PIS/COFINS - Débito Apuração Própria" value={null} />
      </Row>

      {/* Valor total */}
      <SectionTitle>VALOR TOTAL DA NFS-E</SectionTitle>
      <Row>
        <Campo label="Valor do Serviço" value={valorFormatado} />
        <Campo label="Descontos" value={null} />
        <Campo label="ISSQN Retido" value={null} />
        <Campo label="Valor Líquido da NFS-e" value={valorFormatado} />
      </Row>

      <div className="no-print" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
