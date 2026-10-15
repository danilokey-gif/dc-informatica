'use client'

import { useRef, useState } from 'react'
import { consultarCnpj, validarCnpj } from '@/lib/cnpj'

const telefone = (d: string) => (d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') : d.length === 10 ? d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3') : d)

/**
 * Campo CNPJ/CPF do cadastro de fornecedor. Com um CNPJ válido, consulta a Receita Federal e
 * preenche nome, telefone, e-mail e endereço que estiverem vazios (campos pelo id).
 */
export default function CampoCnpjFornecedor({ defaultValue }: { defaultValue?: string | null }) {
  const [situacao, setSituacao] = useState<{ cor: string; texto: string } | null>(null)
  const ultimo = useRef('')

  async function aoMudar(e: React.ChangeEvent<HTMLInputElement>) {
    const cnpj = e.target.value.replace(/\D/g, '')
    if (cnpj.length !== 14) { ultimo.current = ''; setSituacao(null); return }
    if (!validarCnpj(cnpj)) { setSituacao({ cor: 'var(--accent-red)', texto: 'CNPJ inválido. Verifique os dígitos.' }); return }
    if (ultimo.current === cnpj) return
    ultimo.current = cnpj
    setSituacao({ cor: 'var(--text-muted)', texto: 'Consultando CNPJ na Receita Federal…' })
    const d = await consultarCnpj(cnpj)
    if ('erro' in d) { setSituacao({ cor: 'var(--accent-red)', texto: d.erro }); return }
    const preencher = (id: string, valor: string) => {
      const campo = document.getElementById(id) as HTMLInputElement | null
      if (campo && !campo.value.trim() && valor) campo.value = valor
    }
    preencher('name', d.razaoSocial)
    preencher('phone', telefone(d.telefone))
    preencher('email', d.email)
    const cep = d.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')
    preencher('address', [[d.logradouro, d.numero].filter(Boolean).join(', '), d.complemento, d.bairro].filter(Boolean).join(' - ') + ` - ${d.municipio}/${d.uf}${cep ? ` - CEP ${cep}` : ''}`)
    setSituacao(d.situacao && d.situacao !== 'ATIVA'
      ? { cor: 'var(--accent-orange)', texto: `Atenção: CNPJ com situação ${d.situacao} na Receita Federal.` }
      : { cor: 'var(--accent-green)', texto: `Dados da Receita Federal preenchidos${d.nomeFantasia ? ` (${d.nomeFantasia})` : ''}. Confira antes de salvar.` })
  }

  return (
    <>
      <input type="text" id="document" name="document" className="input-field" defaultValue={defaultValue || ''} onChange={aoMudar} placeholder="Digite o CNPJ para preencher os dados" />
      {situacao && <p style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: situacao.cor }}>{situacao.texto}</p>}
    </>
  )
}
