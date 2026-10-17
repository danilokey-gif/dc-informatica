'use client'

/**
 * Imprime o PDF que já está aberto no visualizador da página (iframe), sem abrir outra janela
 * nem outro programa. Se o navegador não deixar imprimir pelo iframe, abre o PDF na mesma janela.
 */
export default function BotaoImprimirPdf({ iframeId, url }: { iframeId: string; url: string }) {
  function imprimir() {
    const quadro = document.getElementById(iframeId) as HTMLIFrameElement | null
    try {
      quadro?.contentWindow?.focus()
      quadro?.contentWindow?.print()
    } catch {
      window.location.href = url
    }
  }
  return <button type="button" className="btn btn-outline" onClick={imprimir}>🖨️ Imprimir</button>
}
