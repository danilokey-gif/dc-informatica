export interface NfseXmlParseado {
  chaveAcesso: string
  numeroNfse: string
  dhProc: string | null
  numeroDps: string
  serieDps: string
  dhEmiDps: string | null
  dCompet: string | null
  emitCnpj: string | null
  emitNome: string | null
  emitFone: string | null
  emitEmail: string | null
  emitLogradouro: string | null
  emitNumero: string | null
  emitBairro: string | null
  emitCep: string | null
  emitUf: string | null
  municipioLabel: string
  opSimpNac: string | null
  tomaDocumento: string | null
  tomaNome: string | null
  tomaLogradouro: string | null
  tomaNumero: string | null
  tomaBairro: string | null
  tomaCep: string | null
  cTribNac: string | null
  xTribNac: string | null
  xDescServ: string | null
  tribISSQN: string | null
  tpRetISSQN: string | null
  vServ: number | null
  vLiq: number | null
}

function tag(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] || null
}

function bloco(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`))?.[1] || null
}

/** Extrai os campos necessários pro DANFSe direto do XML real da NFS-e (o que o governo devolve). */
export function parseNfseXml(xml: string): NfseXmlParseado {
  const chaveAcesso = xml.match(/Id="NFS(\d{50})"/)?.[1] || xml.match(/<chNFSe>(\d{50})<\/chNFSe>/)?.[1] || ''
  const numeroNfse = tag(xml, 'nNFSe') || ''
  const dhProc = tag(xml, 'dhProc')

  const dps = bloco(xml, 'infDPS') || ''
  const numeroDps = tag(dps, 'nDPS') || ''
  const serieDps = tag(dps, 'serie') || ''
  const dhEmiDps = tag(dps, 'dhEmi')
  const dCompet = tag(dps, 'dCompet')

  const emit = bloco(xml, 'emit') || ''
  const emitEnder = bloco(emit, 'enderNac') || ''
  const emitCnpj = tag(emit, 'CNPJ')
  const emitNome = tag(emit, 'xNome')
  const emitFone = tag(emit, 'fone')
  const emitEmail = tag(emit, 'email')
  const emitLogradouro = tag(emitEnder, 'xLgr')
  const emitNumero = tag(emitEnder, 'nro')
  const emitBairro = tag(emitEnder, 'xBairro')
  const emitCep = tag(emitEnder, 'CEP')
  const emitUf = tag(emitEnder, 'UF')

  const xLocIncid = tag(xml, 'xLocIncid') || tag(xml, 'xLocEmi')
  const municipioLabel = xLocIncid ? `${xLocIncid} - ${emitUf || 'SP'}` : '-'

  const prest = bloco(dps, 'prest') || ''
  const regTrib = bloco(prest, 'regTrib') || ''
  const opSimpNac = tag(regTrib, 'opSimpNac')

  const toma = bloco(dps, 'toma') || ''
  const tomaDocumento = tag(toma, 'CNPJ') || tag(toma, 'CPF')
  const tomaNome = tag(toma, 'xNome')
  const tomaLogradouro = tag(toma, 'xLgr')
  const tomaNumero = tag(toma, 'nro')
  const tomaBairro = tag(toma, 'xBairro')
  const tomaEnderNac = bloco(toma, 'endNac') || ''
  const tomaCep = tag(tomaEnderNac, 'CEP')

  const serv = bloco(dps, 'serv') || ''
  const cServ = bloco(serv, 'cServ') || ''
  const cTribNac = tag(cServ, 'cTribNac')
  const xTribNac = tag(xml, 'xTribNac')
  const xDescServ = tag(cServ, 'xDescServ')

  const trib = bloco(dps, 'trib') || ''
  const tribMun = bloco(trib, 'tribMun') || ''
  const tribISSQN = tag(tribMun, 'tribISSQN')
  const tpRetISSQN = tag(tribMun, 'tpRetISSQN')

  const vServStr = tag(dps, 'vServ')
  const vLiqStr = tag(xml, 'vLiq')

  return {
    chaveAcesso,
    numeroNfse,
    dhProc,
    numeroDps,
    serieDps,
    dhEmiDps,
    dCompet,
    emitCnpj,
    emitNome,
    emitFone,
    emitEmail,
    emitLogradouro,
    emitNumero,
    emitBairro,
    emitCep,
    emitUf,
    municipioLabel,
    opSimpNac,
    tomaDocumento,
    tomaNome,
    tomaLogradouro,
    tomaNumero,
    tomaBairro,
    tomaCep,
    cTribNac,
    xTribNac,
    xDescServ,
    tribISSQN,
    tpRetISSQN,
    vServ: vServStr ? parseFloat(vServStr) : null,
    vLiq: vLiqStr ? parseFloat(vLiqStr) : null,
  }
}
