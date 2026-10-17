export const metadata = { title: 'Política de Privacidade - Dc Informática' }

/** Página pública exigida pelo Google para a autorização de acesso ao Google Drive (OAuth). */
export default function Privacidade() {
  const p = { margin: '0 0 0.9rem', lineHeight: 1.6 }
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem', background: '#fff', color: '#111827', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '1.6rem' }}>Política de Privacidade e Termos de Uso</h1>
      <p style={p}><strong>Dc Informática</strong> — CNPJ 11.671.379/0001-88 — Marília/SP. Contato: danilo.key@gmail.com.</p>
      <p style={p}>Este é o sistema de gestão interno da Dc Informática (ordens de serviço, vendas e notas fiscais). O acesso é restrito aos usuários da empresa.</p>
      <h2 style={{ fontSize: '1.15rem' }}>Google Drive</h2>
      <p style={p}>
        Quando a conta Google da empresa é conectada, o sistema usa a permissão <em>drive.file</em>, que dá acesso apenas aos arquivos e pastas criados pelo
        próprio sistema. Ele grava ali as fotos e vídeos dos equipamentos em manutenção e cópias das notas fiscais emitidas. O sistema não lê, não altera e não
        compartilha nenhum outro arquivo do Drive, e os dados não são vendidos nem repassados a terceiros.
      </p>
      <p style={p}>A autorização pode ser desfeita a qualquer momento em Configurações do sistema ou em myaccount.google.com/permissions.</p>
      <h2 style={{ fontSize: '1.15rem' }}>Dados de clientes</h2>
      <p style={p}>Os dados de clientes (nome, CPF/CNPJ, endereço e contato) são usados só para atendimento e emissão de notas fiscais, conforme a LGPD (Lei 13.709/2018).</p>
    </main>
  )
}
