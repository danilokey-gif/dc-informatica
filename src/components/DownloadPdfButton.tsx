'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

export default function DownloadPdfButton({ filename }: { filename: string }) {
  const [loading, setLoading] = useState(false)

  const downloadPdf = async () => {
    setLoading(true)
    try {
      // Importa dinamicamente para não quebrar SSR no Next.js
      const html2pdf = (await import('html2pdf.js')).default

      const element = document.querySelector('.print-area') as HTMLElement
      if (!element) return

      const opt: any = {
        margin: 10,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      await html2pdf().set(opt).from(element).save()
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Houve um erro ao gerar o PDF. Tente usar o botão Imprimir.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={downloadPdf} disabled={loading} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#e0e7ff', color: '#4338ca', borderColor: '#c7d2fe' }}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
      {loading ? 'Gerando...' : 'Baixar PDF'}
    </button>
  )
}
