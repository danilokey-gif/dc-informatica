# Correções de Download de NFe - Resumo

## Problema Identificado
O sistema estava **falhando ao fazer download de Notas Fiscais (NFe)** porque a conversão de buffer estava incorreta.

## Erros Corrigidos

### 1. **Download de NFe do Período** (`/notas-fiscais/download`)
**Arquivo:** `src/app/(app)/notas-fiscais/download/route.ts`

**Problema:**
```typescript
// ❌ ERRADO - buffer.slice() retornava buffer inválido
const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
const arrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength) as ArrayBuffer
return new Response(arrayBuffer, { ... })
```

**Solução:**
```typescript
// ✅ CORRETO - passa Uint8Array diretamente
const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
return new Response(zipBuffer, { ... })
```

**Por quê:**
- `zip.generateAsync({ type: 'uint8array' })` já retorna um buffer válido
- `NextResponse` (e `Response`) sabem como converter `Uint8Array` para bytes corretamente
- A operação `.buffer.slice()` estava criando um buffer inválido ou vazio

### 2. **Download de Notas Importadas do Governo** (`/notas-fiscais/download-importadas`)
**Arquivo:** `src/app/(app)/notas-fiscais/download-importadas/route.ts`

**Problema:** Mesmo problema que acima

**Solução:** Aplicada a mesma correção

## Impacto

✅ **Agora funcionam:**
- ⬇️ Baixar notas do período em `.zip`
- ⬇️ Baixar notas importadas do governo em `.zip`
- 📄 Download de XMLs individuais
- 🖨️ Visualização de PDFs (DANFE/DANFSe)

## Como Testar

1. Acesse **Notas Fiscais** no menu
2. Clique em **"Baixar .zip"** e selecione um período
3. O arquivo deverá baixar corretamente

## Detalhes Técnicos

A biblioteca `jszip` retorna um `Uint8Array` quando usando `type: 'uint8array'`. Esse é o tipo correto para enviar como resposta HTTP. A tentativa de extrair o `.buffer` subjacente e fazer `slice()` estava criando uma cópia inválida ou vazia do buffer.

**Referência:** [MDN - Uint8Array.buffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/buffer)
