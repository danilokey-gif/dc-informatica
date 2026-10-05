'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { parseStringPromise } from 'xml2js'

export async function processXmlUpload(formData: FormData) {
  const file = formData.get('xmlFile') as File | null
  if (!file) return { error: 'Nenhum arquivo enviado.' }

  const text = await file.text()
  
  try {
    const result = await parseStringPromise(text)
    
    // NFe from Sefaz
    const nfe = result.nfeProc?.NFe?.[0]?.infNFe?.[0] || result.NFe?.infNFe?.[0]
    if (!nfe) return { error: 'XML inválido ou não é uma NF-e reconhecida.' }
    
    const dets = nfe.det || []
    
    for (const det of dets) {
      const prod = det.prod[0]
      // XML de fornecedor às vezes vem com espaços sobrando, que depois derrubam a NF-e (rejeição 225).
      const name = String(prod.xProd[0]).replace(/\s+/g, ' ').trim()
      const sku = String(prod.cProd[0]).trim()
      const quantity = parseFloat(prod.qCom[0])
      const costPrice = parseFloat(prod.vUnCom[0])
      
      // Try finding existing by name or sku
      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: sku },
            { name: name }
          ]
        }
      })
      
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            stockQty: { increment: quantity },
            costPrice: costPrice > 0 ? costPrice : undefined
          }
        })
      } else {
        await prisma.product.create({
          data: {
            name: name,
            sku: sku,
            costPrice: costPrice,
            salePrice: costPrice * 1.5, // default markup 50%
            stockQty: quantity,
            category: 'Importado via XML',
            minStockAlert: 5
          }
        })
      }
    }
  } catch (err: any) {
    console.error(err)
    return { error: 'Falha ao ler o arquivo XML: ' + err.message }
  }

  revalidatePath('/produtos')
  return { success: true }
}

export async function registerManualEntry(formData: FormData) {
  const supplierId = formData.get('supplierId') as string | null
  const itemsRaw = formData.get('items') as string
  
  if (!itemsRaw) return
  
  const items = JSON.parse(itemsRaw) as { productId: string, quantity: number, unitCost: number }[]
  
  // Process the entry in a transaction to ensure all products are updated
  await prisma.$transaction(
    items.map(item => 
      prisma.product.update({
        where: { id: item.productId },
        data: { 
          stockQty: { increment: item.quantity },
          costPrice: item.unitCost > 0 ? item.unitCost : undefined // Only update cost if provided
        }
      })
    )
  )

  // Wait, could optionally create a FinanceTransaction for the supplier if needed, 
  // but instruction just says "atualizam o prisma.product (incrementando stockQty)".

  revalidatePath('/produtos')
  redirect('/produtos')
}
