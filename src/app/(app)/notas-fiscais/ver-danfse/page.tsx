import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { gerarQrCodeDataUrl } from "@/lib/qrcode-util"
import { parseNfseXml } from "@/lib/nfse/parse-nfse-xml"
import PrintButton from "../../os/[id]/imprimir/PrintButton"

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

function formatarData(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

function formatarMoeda(valor: number | null): string {
  if (valor === null) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function VerDanfsePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  try {
    const { id } = await searchParams
    if (!id) notFound()

    const emissao = await prisma.nfseEmissao.findUnique({ where: { id } })
    if (!emissao) notFound()

    if (!emissao.xmlNfse) {
      return (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
          <p>Esta nota não tem XML disponível para gerar o DANFSe.</p>
        </div>
      )
    }

    const n = parseNfseXml(emissao.xmlNfse)
    const qrCodeDataUrl = await gerarQrCodeDataUrl(n.chaveAcesso || emissao.chaveAcesso || '')

    const codigoServicoFormatado = n.cTribNac
      ? `${n.cTribNac.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')}${n.xTribNac ? ` - ${n.xTribNac}` : ''}`
      : '-'

    const ehMei = n.opSimpNac === '2'
    const simplesLabel = ehMei
      ? 'Optante - Microempreendedor Individual (MEI)'
      : n.opSimpNac === '3'
        ? 'Optante - Simples Nacional (ME/EPP)'
        : 'Não Optante'

    const enderecoPrestador = `${n.emitLogradouro || ''}${n.emitNumero ? `, ${n.emitNumero}` : ''}${n.emitBairro ? `, ${n.emitBairro}` : ''}`
    const enderecoTomador = `${n.tomaLogradouro || ''}${n.tomaNumero ? `, ${n.tomaNumero}` : ''}${n.tomaBairro ? `, ${n.tomaBairro}` : ''}`
    const retencaoLabel = n.tpRetISSQN === '2' ? 'Retido' : 'Não Retido'
    const tribLabel = n.tribISSQN === '1' ? 'Operação Tributável' : (n.tribISSQN || '-')

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

        <div style={{ border: '1px solid #000', display: 'flex', flexDirection: 'column' }}>

          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '52px' }}>
            <div style={{ width: '30%', padding: '4px 8px', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-nfse.png" alt="NFS-e Nacional" style={{ height: '36px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 'bold' }}>NFS-e</div>
                <div style={{ fontSize: '0.44rem', color: '#4b5563' }}>Nota Fiscal de Serviço eletrônica</div>
              </div>
            </div>

            <div style={{ width: '40%', padding: '4px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '0.5px' }}>DANFSe</div>
              <div style={{ fontSize: '0.52rem', color: '#4b5563', marginTop: '1px' }}>Documento Auxiliar da NFS-e</div>
            </div>

            <div style={{ width: '30%', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-marilia.jpg" alt={n.municipioLabel} style={{ height: '36px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.44rem', fontWeight: 'bold', color: '#4b5563' }}>MUNICÍPIO DE</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 'bold', color: '#000' }}>{n.municipioLabel.toUpperCase()}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid #000', minHeight: '65px' }}>
            <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.44rem', fontWeight: 'bold', color: '#4b5563' }}>CHAVE DE ACESSO DA NFS-e</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.66rem', fontWeight: 'bold', marginTop: '2px', letterSpacing: '0.5px' }}>
                  {n.chaveAcesso.match(/.{1,4}/g)?.join(' ') || n.chaveAcesso}
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
            <Field label="Número da NFS-e" value={n.numeroNfse} />
            <Field label="Competência da NFS-e" value={formatarData(n.dCompet)} />
            <Field label="Data e Hora da emissão da NFS-e" value={formatarDataHora(n.dhProc)} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Número da DPS" value={n.numeroDps} />
            <Field label="Série da DPS" value={n.serieDps} />
            <Field label="Data e Hora da emissão da DPS" value={formatarDataHora(n.dhEmiDps)} borderRight={false} />
          </FieldRow>

          <SectionHeader title="EMITENTE DA NFS-e" subtitle="Prestador do Serviço" />
          <FieldRow>
            <Field label="CNPJ / CPF / NIF" value={n.emitCnpj} />
            <Field label="Inscrição Municipal" value="-" />
            <Field label="Telefone" value={n.emitFone} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Nome / Nome Empresarial" value={n.emitNome} flex={2} />
            <Field label="E-mail" value={n.emitEmail} flex={2} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value={enderecoPrestador} flex={2} />
            <Field label="Município" value={n.municipioLabel} />
            <Field label="CEP" value={n.emitCep} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Simples Nacional na Data de Competência" value={simplesLabel} flex={2} />
            <Field label="Regime de Apuração Tributária pelo SN" value={ehMei ? '-' : (n.opSimpNac === '3' ? 'Regime de apuração dos tributos federais e SN' : '-')} flex={2} borderRight={false} />
          </FieldRow>

          <SectionHeader title="TOMADOR DO SERVIÇO" />
          <FieldRow>
            <Field label="CNPJ / CPF / NIF" value={n.tomaDocumento} />
            <Field label="Inscrição Municipal" value="-" />
            <Field label="Telefone" value="-" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Nome / Nome Empresarial" value={n.tomaNome} flex={2} />
            <Field label="E-mail" value="-" flex={2} borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Endereço" value={enderecoTomador} flex={2} />
            <Field label="Município" value={n.municipioLabel} />
            <Field label="CEP" value={n.tomaCep} borderRight={false} />
          </FieldRow>

          <SectionHeader title="INTERMEDIÁRIO DO SERVIÇO" />
          <FieldRow>
            <Field label="Identificação do Intermediário" value="Intermediário do serviço não identificado na NFS-e" borderRight={false} />
          </FieldRow>

          <SectionHeader title="SERVIÇO PRESTADO" />
          <FieldRow>
            <Field label="Código de Tributação Nacional" value={codigoServicoFormatado} flex={2} />
            <Field label="Local da Prestação" value={n.municipioLabel} />
            <Field label="País da Prestação" value="Brasil" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Descrição do Serviço" value={
              <div style={{ minHeight: '90px', fontSize: '0.62rem', whiteSpace: 'pre-wrap', lineHeight: 1.25 }}>
                {n.xDescServ}
              </div>
            } borderRight={false} />
          </FieldRow>

          <SectionHeader title="TRIBUTAÇÃO MUNICIPAL" />
          <FieldRow>
            <Field label="Tributação do ISSQN" value={tribLabel} />
            <Field label="Município de Incidência do ISSQN" value={n.municipioLabel} />
            <Field label="Regime Especial de Tributação" value="Nenhum" />
            <Field label="Suspensão da Exigibilidade do ISSQN" value="Não" borderRight={false} />
          </FieldRow>
          <FieldRow>
            <Field label="Valor do Serviço" value={formatarMoeda(n.vServ)} />
            <Field label="BC ISSQN" value={ehMei ? '-' : formatarMoeda(n.vServ)} />
            <Field label="Alíquota Aplicada" value={ehMei ? 'Não se aplica (MEI)' : '-'} />
            <Field label="Retenção do ISSQN" value={retencaoLabel} borderRight={false} />
          </FieldRow>

          <SectionHeader title="TRIBUTAÇÃO FEDERAL" />
          <FieldRow>
            <Field label="IRRF" value="-" />
            <Field label="Contribuição Previdenciária - Retida" value="-" />
            <Field label="Contribuições Sociais - Retidas" value="-" />
            <Field label="PIS/COFINS - Débito Apuração Própria" value="-" borderRight={false} />
          </FieldRow>

          <SectionHeader title="VALOR TOTAL DA NFS-E" />
          <FieldRow borderBottom={false}>
            <Field label="Valor do Serviço" value={formatarMoeda(n.vServ)} />
            <Field label="Descontos" value="-" />
            <Field label="ISSQN Retido" value="-" />
            <Field label="Valor Líquido da NFS-e" value={formatarMoeda(n.vLiq)} borderRight={false} />
          </FieldRow>

        </div>

        <div className="no-print" style={{ marginTop: '1.2rem', textAlign: 'center' }}>
          <PrintButton />
        </div>
      </div>
    )
  } catch (error) {
    console.error("Erro ao gerar o DANFSe a partir do XML:", error)
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', padding: '1.5rem', border: '1px solid #fee2e2', backgroundColor: '#fff5f5', borderRadius: '8px', color: '#991b1b', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Erro ao Gerar o DANFSe</h2>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>Não foi possível interpretar o XML desta nota.</p>
        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
          Detalhes: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    )
  }
}
