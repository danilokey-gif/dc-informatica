import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { emitirNfseDaOs } from "@/lib/nfse/emitir-os"
import { enviarEmail } from "@/lib/email"
import { gerarPixCopiaECola, gerarPixQrCodeDataUrl } from "@/lib/pix"
import { formatarErro } from "@/lib/formatar-erro"

export interface ResultadoCobranca {
  cobrancaId: string
  cliente: string
  status: 'emitida' | 'ja-processada' | 'aguardando-dia' | 'inativa' | 'erro'
  detalhe: string
}

/** Data de hoje no fuso de Brasília (o servidor da Vercel roda em UTC). */
export function hojeEmBrasilia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(agora)
  const parte = (tipo: string) => partes.find(p => p.type === tipo)!.value
  return {
    dia: Number(parte('day')),
    competencia: `${parte('year')}-${parte('month')}`,
    rotulo: `${parte('month')}/${parte('year')}`,
  }
}

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function avisarDono(assunto: string, mensagem: string) {
  try {
    const empresa = await getCompanySettings()
    const para = empresa.email || process.env.GMAIL_USER
    if (para) await enviarEmail({ to: para, subject: assunto, html: `<p>${escaparHtml(mensagem)}</p>` })
  } catch (error) {
    console.error('[Cobrança mensal] Não consegui avisar o dono por e-mail:', error)
  }
}

/**
 * Processa a cobrança do mês: cria a OS da competência, emite a NFS-e, lança a receita pendente e
 * manda a nota (com PIX) por e-mail. `manual` = disparada pelo botão "Emitir agora": ignora o dia
 * do mês e se a cobrança está ligada, mas nunca emite duas vezes a mesma competência.
 */
export async function processarCobranca(cobrancaId: string, opcoes: { manual?: boolean } = {}): Promise<ResultadoCobranca> {
  const cobranca = await prisma.cobrancaMensal.findUnique({ where: { id: cobrancaId }, include: { customer: true } })
  if (!cobranca) return { cobrancaId, cliente: '-', status: 'erro', detalhe: 'Cobrança não encontrada.' }

  const cliente = cobranca.customer.name
  const hoje = hojeEmBrasilia()

  if (!opcoes.manual && !cobranca.ativa) return { cobrancaId, cliente, status: 'inativa', detalhe: 'Cobrança desligada.' }
  if (!opcoes.manual && hoje.dia < cobranca.diaDoMes) {
    return { cobrancaId, cliente, status: 'aguardando-dia', detalhe: `A nota de ${hoje.rotulo} sai no dia ${cobranca.diaDoMes}.` }
  }

  // Trava: marca a competência ANTES de emitir. Se duas execuções correrem juntas, só uma passa.
  const trava = await prisma.cobrancaMensal.updateMany({
    where: { id: cobranca.id, OR: [{ ultimaCompetencia: null }, { ultimaCompetencia: { not: hoje.competencia } }] },
    data: { ultimaCompetencia: hoje.competencia, ultimoResultado: `Emitindo a nota de ${hoje.rotulo}…`, ultimoProcessamento: new Date() },
  })
  if (trava.count === 0) {
    return { cobrancaId, cliente, status: 'ja-processada', detalhe: `A nota de ${hoje.rotulo} já foi processada.` }
  }

  const descricaoComCompetencia = `${cobranca.descricao} — competência ${hoje.rotulo}`
  let osId: string | null = null
  try {
    const os = await prisma.serviceOrder.create({
      data: {
        customerId: cobranca.customerId,
        device: '',
        issue: descricaoComCompetencia,
        price: cobranca.valor,
        status: 'COMPLETED',
      },
    })
    osId = os.id

    const emissao = await emitirNfseDaOs(os.id, { codigoServico: cobranca.codigoServico })

    if (!emissao.ok) {
      // Não tenta de novo sozinha: sem certeza de que a prefeitura não emitiu, repetir pode gerar
      // nota em dobro. O dono é avisado e decide (botão "Tentar emitir novamente" na OS).
      const detalhe = `Erro ao emitir a nota de ${hoje.rotulo}: ${emissao.erro}`
      await prisma.cobrancaMensal.update({ where: { id: cobranca.id }, data: { ultimoResultado: detalhe, ultimaOsId: os.id } })
      await avisarDono(
        `Falha na nota mensal de ${cliente}`,
        `${detalhe}. A nota NÃO será tentada de novo automaticamente. Abra a OS da competência no sistema ` +
        `(Ordens de Serviço) e use "Tentar emitir novamente" depois de conferir o problema.`,
      )
      return { cobrancaId, cliente, status: 'erro', detalhe }
    }

    const vencimento = new Date(Date.now() + cobranca.diasParaVencimento * 24 * 60 * 60 * 1000)
    await prisma.financeTransaction.create({
      data: {
        type: 'RECEITA',
        description: `${cobranca.descricao} — ${cliente} — ${hoje.rotulo}`,
        amount: cobranca.valor,
        dueDate: vencimento,
        status: 'PENDENTE',
        customerId: cobranca.customerId,
        serviceOrderId: os.id,
        notes: `NFS-e nº ${emissao.numeroNfse}${emissao.chaveAcesso ? ` — chave ${emissao.chaveAcesso}` : ''}`,
      },
    })

    const situacaoEmail = await enviarNotaPorEmail({
      cobranca,
      cliente,
      clienteEmail: cobranca.customer.email,
      descricaoComCompetencia,
      vencimento,
      emissaoId: emissao.emissaoId,
      numeroNfse: emissao.numeroNfse,
      pdf: emissao.pdf,
    })

    const detalhe = `NFS-e nº ${emissao.numeroNfse} de ${hoje.rotulo} emitida em ${dataBR(new Date())}. ${situacaoEmail}`
    await prisma.cobrancaMensal.update({ where: { id: cobranca.id }, data: { ultimoResultado: detalhe, ultimaOsId: os.id } })
    return { cobrancaId, cliente, status: 'emitida', detalhe }
  } catch (error) {
    const detalhe = `Erro inesperado na nota de ${hoje.rotulo}: ${formatarErro(error)}`
    await prisma.cobrancaMensal.update({ where: { id: cobranca.id }, data: { ultimoResultado: detalhe, ...(osId ? { ultimaOsId: osId } : {}) } })
    await avisarDono(`Falha na nota mensal de ${cliente}`, `${detalhe}. Confira no sistema antes de tentar de novo.`)
    return { cobrancaId, cliente, status: 'erro', detalhe }
  }
}

async function enviarNotaPorEmail(params: {
  cobranca: { enviarEmail: boolean; incluirPix: boolean; valor: number }
  cliente: string
  clienteEmail: string | null
  descricaoComCompetencia: string
  vencimento: Date
  emissaoId: string
  numeroNfse: string
  pdf: Buffer | null
}): Promise<string> {
  const { cobranca, cliente, clienteEmail } = params
  if (!cobranca.enviarEmail) return 'Envio por e-mail desligado.'
  if (!clienteEmail) return 'O cliente não tem e-mail cadastrado; a nota não foi enviada.'

  try {
    const [empresa, emissao] = await Promise.all([
      getCompanySettings(),
      prisma.nfseEmissao.findUnique({ where: { id: params.emissaoId }, select: { xmlNfse: true, chaveAcesso: true } }),
    ])

    const arquivos: { filename: string; content: string | Buffer; contentType?: string; cid?: string }[] = []
    if (params.pdf) arquivos.push({ filename: `NFSe-${params.numeroNfse}.pdf`, content: params.pdf, contentType: 'application/pdf' })
    if (emissao?.xmlNfse) arquivos.push({ filename: `NFSe-${params.numeroNfse}.xml`, content: emissao.xmlNfse, contentType: 'application/xml' })

    let blocoPix = ''
    if (cobranca.incluirPix && empresa.pixKey && empresa.pixCity) {
      const copiaECola = gerarPixCopiaECola({
        pixKey: empresa.pixKey,
        merchantName: empresa.name,
        merchantCity: empresa.pixCity,
        amount: cobranca.valor,
        txid: `NFSE${params.numeroNfse}`,
      })
      const qr = await gerarPixQrCodeDataUrl(copiaECola)
      arquivos.push({
        filename: 'pix-qrcode.png',
        content: Buffer.from(qr.split(',')[1], 'base64'),
        contentType: 'image/png',
        cid: 'pix-qrcode',
      })
      blocoPix = `
        <h3 style="margin-top:1.5rem">Pagamento por PIX</h3>
        <p>Aponte a câmera do app do banco para o QR Code ou use o "PIX copia e cola":</p>
        <img src="cid:pix-qrcode" alt="QR Code PIX" style="width:220px;height:220px" />
        <p style="font-family:monospace;font-size:12px;word-break:break-all;background:#f3f4f6;padding:8px;border-radius:4px">${escaparHtml(copiaECola)}</p>`
    }

    await enviarEmail({
      to: clienteEmail,
      // Cópia oculta para a empresa: o dono vê que a nota saiu, sem depender de abrir o sistema.
      bcc: empresa.email || undefined,
      subject: `Nota Fiscal de Serviço nº ${params.numeroNfse} — ${empresa.name}`,
      html: `
        <p>Olá, ${escaparHtml(cliente)}!</p>
        <p>Segue a Nota Fiscal de Serviço nº <strong>${params.numeroNfse}</strong>, referente a ${escaparHtml(params.descricaoComCompetencia)}.</p>
        <p><strong>Valor:</strong> ${BRL(cobranca.valor)}<br/><strong>Vencimento:</strong> ${dataBR(params.vencimento)}</p>
        ${emissao?.chaveAcesso ? `<p><strong>Chave de acesso:</strong> ${emissao.chaveAcesso}</p>` : ''}
        ${blocoPix}
        <p style="margin-top:1.5rem">Qualquer dúvida, estamos à disposição.</p>
        <p>${escaparHtml(empresa.name)}${empresa.phone ? ` — ${escaparHtml(empresa.phone)}` : ''}</p>`,
      logoDataUrl: empresa.logo,
      arquivos,
    })
    return `Enviada por e-mail para ${clienteEmail}${empresa.email ? ' (com cópia para você)' : ''}.`
  } catch (error) {
    const msg = `A nota foi emitida, mas o e-mail para ${clienteEmail} falhou: ${formatarErro(error)}`
    await avisarDono(`E-mail da nota mensal de ${cliente} não foi enviado`, `${msg}. Reenvie pela OS da competência.`)
    return msg
  }
}

/** Roda todas as cobranças ligadas (chamada pela rotina diária). */
export async function processarCobrancasDoDia(): Promise<ResultadoCobranca[]> {
  const ativas = await prisma.cobrancaMensal.findMany({ where: { ativa: true }, select: { id: true } })
  const resultados: ResultadoCobranca[] = []
  // Uma de cada vez: a numeração da DPS é sequencial e não pode ser disputada.
  for (const { id } of ativas) resultados.push(await processarCobranca(id))
  return resultados
}
