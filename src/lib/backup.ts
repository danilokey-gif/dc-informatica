import { gzipSync } from 'zlib'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { tokenDoUsuario, pastaPorCaminho, enviarArquivoPequeno, listarArquivos, moverParaLixeira } from './google-drive-usuario'

/**
 * Backup do banco de dados inteiro: todas as tabelas em um JSON compactado (.json.gz), guardado na
 * pasta "Backups" do Google Drive do usuário. A lista de tabelas vem do próprio esquema do Prisma,
 * então tabela nova entra no backup sem ninguém precisar lembrar de incluir.
 *
 * Senhas de usuário (hash), certificado digital e credenciais do Google vão como estão no banco:
 * já criptografados com o AUTH_SECRET, que NÃO vai no backup. Para restaurar em outro servidor é
 * preciso o backup + o mesmo AUTH_SECRET (senão basta enviar o certificado e conectar o Drive de novo).
 */
export const PASTA_BACKUP = 'Backups'
export const VERSAO_BACKUP = 1
/** Guarda um por dia nos últimos 30 dias e o do dia 1º de cada mês por 1 ano. */
const DIAS_DIARIOS = 30
const DIAS_MENSAIS = 366

/** Campos que ficam de fora: chave da conta de serviço antiga (sem uso). */
const CAMPOS_FORA: Record<string, string[]> = { CompanySettings: ['gdrivePrivateKey'] }

const delegado = (modelo: string) => modelo.charAt(0).toLowerCase() + modelo.slice(1)
/** Data de hoje em Brasília (AAAA-MM-DD). */
const hojeBr = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

export interface BackupGerado {
  nome: string
  conteudo: Buffer
  registros: number
  tabelas: Record<string, number>
}

export async function gerarBackup(): Promise<BackupGerado> {
  const tabelas: Record<string, unknown[]> = {}
  const contagem: Record<string, number> = {}
  let registros = 0
  // Uma tabela por vez: o banco (Neon) tem poucas conexões simultâneas.
  for (const m of Prisma.dmmf.datamodel.models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linhas: Record<string, unknown>[] = await (prisma as any)[delegado(m.name)].findMany()
    for (const campo of CAMPOS_FORA[m.name] || []) for (const l of linhas) delete l[campo]
    tabelas[m.name] = linhas
    contagem[m.name] = linhas.length
    registros += linhas.length
  }
  const json = JSON.stringify({ sistema: 'dc-informatica', versao: VERSAO_BACKUP, geradoEm: new Date().toISOString(), contagem, tabelas })
  return { nome: `backup-${hojeBr()}.json.gz`, conteudo: gzipSync(Buffer.from(json, 'utf8'), { level: 9 }), registros, tabelas: contagem }
}

/** Quais backups antigos sair da pasta: mantém os diários recentes e o do dia 1º de cada mês. */
export function backupsParaApagar<T extends { name: string }>(arquivos: T[], hoje = hojeBr()): T[] {
  const idade = (dia: string) => Math.round((Date.parse(hoje) - Date.parse(dia)) / 86_400_000)
  return arquivos.filter(a => {
    const dia = a.name.match(/^backup-(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]
    if (!dia) return false // arquivo que não é do backup automático: não mexe
    const dias = idade(dia)
    if (dias <= DIAS_DIARIOS) return false
    if (dia.endsWith('-01') && dias <= DIAS_MENSAIS) return false
    return true
  })
}

const tamanho = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Gera o backup, envia ao Drive, limpa os antigos e registra o resultado em Configurações. */
export async function fazerBackupNoDrive(origem: 'automático' | 'manual'): Promise<{ ok: boolean; mensagem: string }> {
  let resultado: { ok: boolean; mensagem: string }
  try {
    const backup = await gerarBackup()
    const token = await tokenDoUsuario()
    const pasta = await pastaPorCaminho(token, [PASTA_BACKUP])
    await enviarArquivoPequeno(token, backup.nome, 'application/gzip', backup.conteudo, pasta)

    // Confere se o arquivo chegou inteiro antes de apagar qualquer backup antigo.
    const arquivos = await listarArquivos(token, pasta)
    const enviado = arquivos.find(a => a.name === backup.nome)
    if (!enviado || Number(enviado.size) !== backup.conteudo.length) throw new Error('O Google Drive não confirmou o arquivo completo.')
    const antigos = backupsParaApagar(arquivos)
    for (const a of antigos) await moverParaLixeira(token, a.id)

    resultado = { ok: true, mensagem: `Backup ${origem} salvo no Google Drive: ${backup.nome} (${tamanho(backup.conteudo.length)}, ${backup.registros.toLocaleString('pt-BR')} registros). ${arquivos.length - antigos.length} backup(s) guardado(s).` }
  } catch (e) {
    resultado = { ok: false, mensagem: `Backup ${origem} falhou: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) }
  }
  await prisma.companySettings.update({
    where: { id: 'main' },
    data: { backupUltimoEm: new Date(), backupUltimoResultado: resultado.mensagem, backupUltimoOk: resultado.ok },
  }).catch(() => {})
  return resultado
}
