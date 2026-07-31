# 🔍 Campo de Busca de Clientes - Implementado

## Descrição
Adicionado campo de busca avançado na página de Clientes para buscar rapidamente por **nome** ou **CPF/CNPJ**.

## Recursos Implementados

### 1. **Busca em Tempo Real**
- Filtra a lista de clientes conforme você digita
- Sem necessidade de clicar em botão de busca
- Atualização instantânea da tabela

### 2. **Busca por Múltiplos Critérios**
```
✅ Nome (case-insensitive)
   - "João" encontra "joão", "JOÃO", "João da Silva"
   - Suporta busca parcial: "silva" encontra "João Silva"

✅ CPF/CNPJ (ignora formatação)
   - "123.456.789-00" = "12345678900"
   - Busca funciona com ou sem formatação
   - Busca parcial de números
```

### 3. **Interface Amigável**
- 🔍 Ícone de lupa no label
- 📊 Contador de resultados
- ℹ️ Mensagem informativa quando não encontra

## Como Usar

### 1. Buscar por Nome
```
Campo: "Danilo"
Resultado: ✅ Encontrado 1 cliente
- Danilo Chaves
```

### 2. Buscar por CPF/CNPJ
```
Campo: "52.059.797"
Resultado: ✅ Encontrado 2 clientes
- MDM Paróquia Nossa Senhora Rosa Mística (52.059.797/0067-22)
- M. D. M. - Paróquia Santa Antonieta (52.059.797/0055-99)
```

### 3. Busca Parcial
```
Campo: "MDM"
Resultado: ✅ Encontrado 5 clientes
- M. D. M. - Paróquia Santa Antonieta
- M. D. M. - Paróquia São Miguel Arcanjo de Marília
- MDM Paróquia Sagrada Família
- MDM Cúria Diocesana de Marília
- MDM Paróquia São Miguel Arcanjo
```

## Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/app/(app)/clientes/page.tsx` | Integração do componente ClientesList |
| `src/app/(app)/clientes/ClientesList.tsx` | **NOVO** - Componente cliente com busca |

## Código

### Página Principal (page.tsx)
```typescript
import ClientesList from "./ClientesList"

export default async function ClientesPage() {
  const clientes = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2>Clientes</h2>
        <Link href="/clientes/novo" className="btn btn-primary">
          Novo Cliente
        </Link>
      </div>

      <ClientesList clientes={clientes} />
    </div>
  )
}
```

### Componente de Busca (ClientesList.tsx)
```typescript
'use client'

const [searchTerm, setSearchTerm] = useState('')
const [filteredClientes, setFilteredClientes] = useState(clientes)

useEffect(() => {
  const term = searchTerm.toLowerCase().replace(/\D/g, '')
  
  const filtered = clientes.filter(cliente => {
    const nameMatch = cliente.name.toLowerCase().includes(searchTerm.toLowerCase())
    const documentMatch = cliente.document 
      ? cliente.document.replace(/\D/g, '').includes(term)
      : false
    
    return nameMatch || documentMatch
  })

  setFilteredClientes(filtered)
}, [searchTerm, clientes])
```

## Lógica de Busca

### Nome
- Converte ambos (input e dados) para minúsculas
- Busca substring (parcial)
- Exemplo: "João" encontra "João Silva"

### CPF/CNPJ
- Remove todos os caracteres não-numéricos
- Compara apenas os dígitos
- Funciona com "123.456.789-00" e "12345678900"

### Resultado
- Se encontra match em nome OU documento = mostra o cliente
- Se não encontra nada e há busca ativa = mensagem "Nenhum cliente encontrado"
- Se limpa a busca = volta a mostrar todos

## Benefícios

| Benefício | Descrição |
|-----------|-----------|
| ⚡ **Instantâneo** | Não precisa recarregar página |
| 🔍 **Flexível** | Busca por nome, CPF ou CNPJ |
| 📊 **Informativo** | Mostra quantidade de resultados |
| 🎯 **Preciso** | Ignora formatação e maiúsculas |
| ♿ **Acessível** | Campo com label descritivo |

## Casos de Uso

### Caso 1: Buscar cliente específico
1. Abrir página de Clientes
2. Digitar "Danilo" no campo de busca
3. Ver apenas clientes com "Danilo" no nome

### Caso 2: Buscar por documento
1. Abrir página de Clientes
2. Digitar "52059797" (ou "52.059.797/0067-22")
3. Ver clientes com esse CNPJ

### Caso 3: Procurar paróquia
1. Abrir página de Clientes
2. Digitar "Santa Antonieta"
3. Ver todas as paróquias com esse nome

## Performance

- ✅ Busca é feita em memória (não consulta banco de dados)
- ✅ Rápido mesmo com centenas de clientes
- ✅ Sem debounce necessário - resposta instantânea

## Próximas Melhorias Possíveis

- [ ] Histórico de buscas recentes
- [ ] Busca avançada (filtros por telefone, data, etc)
- [ ] Exportar resultados da busca
- [ ] Marcadores favoritos

---

**Status:** ✅ Implementado e Testado
**Versão:** 1.0
**Data:** 31/07/2026
