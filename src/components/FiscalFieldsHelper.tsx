'use client'

import { useState, useEffect } from 'react'

interface FiscalFieldsHelperProps {
  defaultNcm?: string
  defaultCfop?: string
}

const COMMON_NCMS = [
  { label: 'Outras peças/acessórios (Padrão)', value: '84733099' },
  { label: 'SSD (Unidade de Estado Sólido)', value: '84717040' },
  { label: 'Pen drive / Memória USB', value: '85235190' },
  { label: 'Memória RAM', value: '84733042' },
  { label: 'Processador / Placa-Mãe', value: '84733041' },
  { label: 'Periféricos (Teclado/Mouse/Fone)', value: '84716050' },
  { label: 'Notebook / Computador', value: '84713019' },
  { label: 'Cabos / Adaptadores / Conectores', value: '85444200' },
  { label: 'Roteador / Switch / Placa de Rede', value: '85176277' },
]

const COMMON_CFOPS = [
  { label: '5102 - Venda dentro do Estado (Padrão)', value: '5102' },
  { label: '5405 - Venda interna (Subst. Tributária)', value: '5405' },
  { label: '6102 - Venda para outro Estado', value: '6102' },
]

export default function FiscalFieldsHelper({ defaultNcm = '', defaultCfop = '' }: FiscalFieldsHelperProps) {
  const [ncm, setNcm] = useState(defaultNcm)
  const [cfop, setCfop] = useState(defaultCfop)
  const [isManuallyEdited, setIsManuallyEdited] = useState(!!defaultNcm)

  // Identificação automática à medida que o usuário digita o Nome do produto
  useEffect(() => {
    const nameInput = document.getElementById('name') as HTMLInputElement
    if (!nameInput) return

    const handleInput = () => {
      if (isManuallyEdited) return
      const text = nameInput.value.toLowerCase()

      if (text.includes('pen drive') || text.includes('pendrive') || text.includes('pen-drive')) {
        setNcm('85235190')
      } else if (
        text.includes('ssd') ||
        text.includes('hd') ||
        text.includes('disco') ||
        text.includes('kingston') ||
        text.includes('sandisk') ||
        text.includes('crucial') ||
        text.includes('corsair') ||
        text.includes('western digital') ||
        text.includes('seagate')
      ) {
        setNcm('84717040')
      } else if (text.includes('memoria') || text.includes('ram') || text.includes('ddr') || text.includes('sodimm') || text.includes('dimm')) {
        setNcm('84733042')
      } else if (
        text.includes('processador') ||
        text.includes('intel') ||
        text.includes('amd') ||
        text.includes('ryzen') ||
        text.includes('core i') ||
        text.includes('placa mae') ||
        text.includes('placa-mae') ||
        text.includes('motherboard') ||
        text.includes('lga') ||
        text.includes('am4') ||
        text.includes('am5')
      ) {
        setNcm('84733041')
      } else if (
        text.includes('mouse') ||
        text.includes('teclado') ||
        text.includes('fone') ||
        text.includes('headset') ||
        text.includes('gabinete') ||
        text.includes('cooler') ||
        text.includes('periferico') ||
        text.includes('caixa de som') ||
        text.includes('microfone')
      ) {
        setNcm('84716050')
      } else if (
        text.includes('notebook') ||
        text.includes('computador') ||
        text.includes('pc') ||
        text.includes('desktop') ||
        text.includes('dell') ||
        text.includes('lenovo') ||
        text.includes('thinkpad') ||
        text.includes('acer') ||
        text.includes('macbook')
      ) {
        setNcm('84713019')
      } else if (
        text.includes('cabo') ||
        text.includes('adaptador') ||
        text.includes('conector') ||
        text.includes('hdmi') ||
        text.includes('usb') ||
        text.includes('vga') ||
        text.includes('displayport') ||
        text.includes('sata')
      ) {
        setNcm('85444200')
      } else if (
        text.includes('roteador') ||
        text.includes('switch') ||
        text.includes('wifi') ||
        text.includes('wi-fi') ||
        text.includes('access point') ||
        text.includes('rede') ||
        text.includes('ethernet') ||
        text.includes('modem')
      ) {
        setNcm('85176277')
      }
    }

    nameInput.addEventListener('input', handleInput)
    return () => nameInput.removeEventListener('input', handleInput)
  }, [isManuallyEdited])

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      
      {/* Inputs lado a lado */}
      <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        
        {/* NCM */}
        <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
          <label className="input-label" htmlFor="ncm">NCM (para NF-e) *</label>
          <input
            type="text"
            id="ncm"
            name="ncm"
            className="input-field"
            value={ncm}
            onChange={(e) => {
              setNcm(e.target.value.replace(/\D/g, '').slice(0, 8))
              setIsManuallyEdited(true)
            }}
            placeholder="8 dígitos (obrigatório)"
            required
          />
        </div>

        {/* CFOP */}
        <div className="input-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
          <label className="input-label" htmlFor="cfop">CFOP (para NF-e)</label>
          <input
            type="text"
            id="cfop"
            name="cfop"
            className="input-field"
            value={cfop}
            onChange={(e) => setCfop(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Deixe em branco para usar o padrão"
          />
        </div>

      </div>

      {/* Caixa de Sugestões / Identificação Rápida */}
      <div style={{
        padding: '0.75rem',
        backgroundColor: 'var(--surface-hover)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        
        {/* NCM Helpers */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            ⚡ Preenchimento rápido ou automático pelo nome (Clique para fixar):
          </div>
          <div style={{ display: 'flex', gap: '0.25rem 0.35rem', flexWrap: 'wrap' }}>
            {COMMON_NCMS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="btn"
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 7px',
                  height: 'auto',
                  border: '1px solid var(--border)',
                  backgroundColor: ncm === opt.value ? 'var(--primary)' : 'var(--surface)',
                  color: ncm === opt.value ? 'white' : 'var(--text-main)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setNcm(opt.value)
                  setIsManuallyEdited(true)
                }}
              >
                {opt.label.split(' (')[0]} ({opt.value})
              </button>
            ))}
          </div>
        </div>

        {/* CFOP Helpers */}
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            ⚡ Tipo de Operação (CFOP):
          </div>
          <div style={{ display: 'flex', gap: '0.25rem 0.35rem', flexWrap: 'wrap' }}>
            {COMMON_CFOPS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="btn"
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 7px',
                  height: 'auto',
                  border: '1px solid var(--border)',
                  backgroundColor: cfop === opt.value ? 'var(--primary)' : 'var(--surface)',
                  color: cfop === opt.value ? 'white' : 'var(--text-main)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => setCfop(opt.value)}
              >
                {opt.value} - {opt.label.split(' - ')[1].split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}
