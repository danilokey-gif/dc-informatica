/**
 * Restaura um backup do sistema (arquivo backup-AAAA-MM-DD.json.gz) em um banco de dados VAZIO.
 *
 *   node scripts/restaurar-backup.cjs <arquivo.json.gz> --simular     só confere o arquivo, não toca no banco
 *   node scripts/restaurar-backup.cjs <arquivo.json.gz> --restaurar   grava no banco do DATABASE_URL
 *
 * Antes de restaurar: crie o banco novo, aponte o DATABASE_URL do .env para ele e rode
 * `npx prisma db push` para criar as tabelas. O script se recusa a gravar se qualquer tabela já
 * tiver dados, para nunca misturar nem sobrescrever o banco em uso.
 *
 * Certificado digital e conexão do Google Drive estão criptografados com o AUTH_SECRET: só voltam
 * a funcionar se o servidor usar o mesmo AUTH_SECRET. Se não, envie o certificado e conecte o
 * Drive de novo em Configurações (os demais dados não dependem disso).
 */
const fs = require('fs')
const zlib = require('zlib')

const [arquivo, modo] = process.argv.slice(2)
if (!arquivo || !['--simular', '--restaurar'].includes(modo)) {
  console.error('Uso: node scripts/restaurar-backup.cjs <arquivo.json.gz> --simular | --restaurar')
  process.exit(1)
}

require('dotenv').config()
const { PrismaClient, Prisma } = require('@prisma/client')

const delegado = m => m.charAt(0).toLowerCase() + m.slice(1)

/** Tabelas na ordem em que podem ser gravadas: quem é referenciado vem antes de quem referencia. */
function ordemDeGravacao(modelos) {
  const dependeDe = new Map(modelos.map(m => [m.name, new Set(
    m.fields.filter(f => f.kind === 'object' && f.relationFromFields && f.relationFromFields.length > 0 && f.type !== m.name).map(f => f.type),
  )]))
  const ordem = []
  const visitando = new Set()
  const visitar = nome => {
    if (ordem.includes(nome)) return
    if (visitando.has(nome)) throw new Error(`Referência circular entre tabelas envolvendo ${nome}.`)
    visitando.add(nome)
    for (const d of dependeDe.get(nome) || []) visitar(d)
    visitando.delete(nome)
    ordem.push(nome)
  }
  for (const m of modelos) visitar(m.name)
  return ordem
}

;(async () => {
  const backup = JSON.parse(zlib.gunzipSync(fs.readFileSync(arquivo)).toString('utf8'))
  if (backup.sistema !== 'dc-informatica' || !backup.tabelas) throw new Error('Este arquivo não é um backup do sistema.')
  if (backup.versao !== 1) throw new Error(`Versão de backup desconhecida: ${backup.versao}.`)

  const modelos = Prisma.dmmf.datamodel.models
  const porNome = new Map(modelos.map(m => [m.name, m]))
  const ordem = ordemDeGravacao(modelos)

  console.log(`Backup gerado em ${new Date(backup.geradoEm).toLocaleString('pt-BR')}`)
  const semTabela = Object.keys(backup.tabelas).filter(t => !porNome.has(t))
  if (semTabela.length) console.log(`Aviso: tabelas do backup que não existem mais no sistema (serão ignoradas): ${semTabela.join(', ')}`)

  // Prepara as linhas: datas voltam a ser datas; campos que saíram do sistema são descartados.
  const preparado = {}
  for (const nome of ordem) {
    const m = porNome.get(nome)
    const escalares = m.fields.filter(f => f.kind !== 'object')
    const datas = new Set(escalares.filter(f => f.type === 'DateTime').map(f => f.name))
    const validos = new Set(escalares.map(f => f.name))
    preparado[nome] = (backup.tabelas[nome] || []).map(l => {
      const o = {}
      for (const [k, v] of Object.entries(l)) {
        if (!validos.has(k)) continue
        o[k] = datas.has(k) && v !== null ? new Date(v) : v
      }
      return o
    })
    console.log(`  ${nome.padEnd(22)} ${String(preparado[nome].length).padStart(6)} registro(s)`)
  }
  const total = Object.values(preparado).reduce((s, l) => s + l.length, 0)
  console.log(`Total: ${total} registros em ${ordem.length} tabelas.`)

  if (modo === '--simular') { console.log('Simulação: arquivo íntegro, nada foi gravado.'); return }

  const prisma = new PrismaClient()
  try {
    for (const nome of ordem) {
      const n = await prisma[delegado(nome)].count()
      if (n > 0) throw new Error(`A tabela ${nome} já tem ${n} registro(s). A restauração só roda em banco vazio; nada foi gravado.`)
    }
    for (const nome of ordem) {
      const linhas = preparado[nome]
      for (let i = 0; i < linhas.length; i += 200) await prisma[delegado(nome)].createMany({ data: linhas.slice(i, i + 200) })
      console.log(`  gravado: ${nome}`)
    }
    console.log('Restauração concluída.')
  } finally {
    await prisma.$disconnect()
  }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1) })
