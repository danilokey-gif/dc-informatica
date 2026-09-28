import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  try {
    const { invoiceNumber } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: { customer: true, serviceOrder: true, items: { include: { product: true } } }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'NFe não encontrada' }, { status: 404 })
    }

    // Gerar HTML para o PDF
    const html = gerarHTMLNFe(invoice)

    // Retornar como resposta com header para download
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="NFe-${invoiceNumber}.html"`
      }
    })
  } catch (error) {
    console.error('Erro ao gerar download da NFe:', error)
    return NextResponse.json({ error: 'Erro ao gerar download' }, { status: 500 })
  }
}

function gerarHTMLNFe(invoice: any) {
  const dataEmissao = new Date(invoice.createdAt).toLocaleDateString('pt-BR')
  const dataValidade = new Date(new Date(invoice.createdAt).getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')

  const itensHTML = invoice.items
    .map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product.name}</td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">R$ ${item.unitPrice.toFixed(2).replace('.', ',')}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">R$ ${item.total.toFixed(2).replace('.', ',')}</td>
      </tr>
    `)
    .join('')

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NFe ${invoice.invoiceNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f9fafb;
        }
        .container {
          background-color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #dc2626;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .company-info h1 {
          color: #dc2626;
          margin: 0;
          font-size: 28px;
        }
        .company-info p {
          margin: 4px 0;
          color: #4b5563;
          font-size: 13px;
        }
        .nfe-info {
          text-align: right;
        }
        .nfe-info h2 {
          margin: 0;
          font-size: 24px;
          color: #111827;
        }
        .nfe-info p {
          margin: 4px 0;
          font-size: 13px;
        }
        .section {
          margin-bottom: 25px;
          border: 1px solid #e5e7eb;
          padding: 15px;
          border-radius: 4px;
        }
        .section h3 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #374151;
          font-size: 14px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .section-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          font-size: 13px;
        }
        .section-grid div {
          margin-bottom: 10px;
        }
        .section-grid strong {
          display: block;
          margin-bottom: 3px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        table thead tr {
          border-bottom: 1px solid #e5e7eb;
        }
        table th {
          padding: 10px;
          text-align: left;
          font-weight: bold;
          color: #374151;
        }
        table th:nth-child(2),
        table th:nth-child(3),
        table th:nth-child(4) {
          text-align: right;
        }
        .totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-box {
          text-align: right;
          min-width: 250px;
        }
        .totals-box p {
          margin: 8px 0;
          font-size: 13px;
          color: #4b5563;
        }
        .totals-box .total {
          font-size: 20px;
          font-weight: bold;
          color: #dc2626;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 2px solid #e5e7eb;
        }
        .footer {
          border-top: 1px solid #e5e7eb;
          padding-top: 15px;
          font-size: 12px;
          color: #4b5563;
        }
        .footer p {
          margin: 5px 0;
        }
        @media print {
          body {
            background-color: white;
          }
          .container {
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <h1>Dc Informática</h1>
            <p>CNPJ: 12.345.678/0001-90</p>
            <p>Assistência Técnica Especializada</p>
            <p>WhatsApp: (14) 99743-7540</p>
          </div>
          <div class="nfe-info">
            <h2>NOTA FISCAL ELETRÔNICA</h2>
            <p><strong>Nº ${invoice.invoiceNumber}</strong></p>
            <p>Chave NFe: ${invoice.nfeKey}</p>
            <p>Data de Emissão: ${dataEmissao}</p>
          </div>
        </div>

        <!-- Dados do Cliente -->
        <div class="section">
          <h3>DADOS DO CLIENTE</h3>
          <div class="section-grid" style="grid-template-columns: 1fr 1fr;">
            <div><strong>Razão Social:</strong> ${invoice.customer.name}</div>
            <div><strong>CNPJ/CPF:</strong> ${invoice.customer.document || 'Não informado'}</div>
            <div><strong>Telefone:</strong> ${invoice.customer.phone || 'Não informado'}</div>
            <div><strong>E-mail:</strong> ${invoice.customer.email || 'Não informado'}</div>
            <div style="grid-column: span 2;"><strong>Endereço:</strong> ${invoice.customer.address || 'Não informado'}</div>
          </div>
        </div>

        <!-- Itens da Nota Fiscal -->
        <div class="section">
          <h3>ITENS</h3>
          ${invoice.items.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th style="text-align: center;">Qtd</th>
                  <th style="text-align: right;">Valor Unit.</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itensHTML}
              </tbody>
            </table>
          ` : '<p style="color: #6b7280;">Nenhum item na nota fiscal.</p>'}
        </div>

        <!-- Totais -->
        <div class="totals">
          <div class="totals-box">
            <p>Subtotal: R$ ${invoice.totalAmount.toFixed(2).replace('.', ',')}</p>
            <p>ICMS: R$ 0,00</p>
            <div class="total">Total: R$ ${invoice.totalAmount.toFixed(2).replace('.', ',')}</div>
          </div>
        </div>

        <!-- Rodapé -->
        <div class="footer">
          <p><strong>Status:</strong> ${invoice.status === 'PENDING' ? 'Pendente' : invoice.status === 'ISSUED' ? 'Emitida' : 'Cancelada'}</p>
          <p><strong>Data de Validade:</strong> ${dataValidade}</p>
          <p style="margin-top: 20px;">Este documento é uma representação impressa da Nota Fiscal Eletrônica (NFe) emitida de acordo com a legislação vigente.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
