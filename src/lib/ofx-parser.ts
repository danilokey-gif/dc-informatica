/**
 * Parser simples para arquivos OFX (Open Financial Exchange).
 * Como o OFX padrão muitas vezes é SGML (sem tags de fechamento), 
 * o uso de expressões regulares garante maior compatibilidade.
 */

export interface OfxTransaction {
  id: string
  type: 'CREDIT' | 'DEBIT' | 'OTHER'
  date: Date
  amount: number
  description: string
}

export function parseOfx(ofxContent: string): OfxTransaction[] {
  const transactions: OfxTransaction[] = []
  
  // Isola os blocos <STMTTRN> (Statement Transaction)
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match
  
  while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
    const block = match[1]
    
    // Extrai Tipo
    const typeMatch = block.match(/<TRNTYPE>([^<\r\n]+)/i)
    const typeRaw = typeMatch ? typeMatch[1].trim().toUpperCase() : 'OTHER'
    const type = typeRaw === 'CREDIT' ? 'CREDIT' : (typeRaw === 'DEBIT' ? 'DEBIT' : 'OTHER')
    
    // Extrai Data (<DTPOSTED>YYYYMMDDHHMMSS)
    const dateMatch = block.match(/<DTPOSTED>([\d]{8})/i)
    let date = new Date()
    if (dateMatch) {
      const dStr = dateMatch[1]
      const year = parseInt(dStr.slice(0, 4), 10)
      const month = parseInt(dStr.slice(4, 6), 10) - 1
      const day = parseInt(dStr.slice(6, 8), 10)
      // Usando meia-noite UTC para evitar problemas de fuso
      date = new Date(Date.UTC(year, month, day, 12, 0, 0))
    }
    
    // Extrai Valor
    const amtMatch = block.match(/<TRNAMT>([^<\r\n]+)/i)
    const amount = amtMatch ? parseFloat(amtMatch[1].trim().replace(',', '.')) : 0
    
    // Extrai Descrição / Memo
    const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i)
    const nameMatch = block.match(/<NAME>([^<\r\n]+)/i)
    const description = (memoMatch ? memoMatch[1].trim() : (nameMatch ? nameMatch[1].trim() : 'Transação Bancária'))
    
    // Extrai ID da transação
    const fitIdMatch = block.match(/<FITID>([^<\r\n]+)/i)
    const id = fitIdMatch ? fitIdMatch[1].trim() : String(Date.now() + Math.random())
    
    transactions.push({
      id,
      type,
      date,
      amount,
      description,
    })
  }
  
  // Ordenar por data decrescente
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
}
