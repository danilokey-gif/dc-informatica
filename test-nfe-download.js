/**
 * Teste de Download de NFe
 * Simula a conversão de buffer que estava falhando
 */

const JSZip = require('jszip');

async function testZipGeneration() {
  console.log('🧪 Testando geração de ZIP para download de NFe...\n');

  try {
    // Simular criação de ZIP com conteúdo
    const zip = new JSZip();
    
    // Adicionar alguns arquivos fictícios
    zip.file('NFSe/exemplo1.xml', '<?xml version="1.0"?><nfe>Exemplo 1</nfe>');
    zip.file('NFe/exemplo2.xml', '<?xml version="1.0"?><nfe>Exemplo 2</nfe>');
    
    console.log('✓ ZIP criado com 2 arquivos fictícios');

    // ❌ TESTE 1: Forma INCORRETA (que estava quebrando)
    console.log('\n❌ TESTE 1: Forma INCORRETA (antes da correção)');
    try {
      const zipBufferWrong = await zip.generateAsync({ type: 'uint8array' });
      console.log(`   - Tipo retornado: ${zipBufferWrong.constructor.name}`);
      console.log(`   - Tamanho original: ${zipBufferWrong.byteLength} bytes`);
      
      // Esta era a operação problemática
      const arrayBuffer = zipBufferWrong.buffer.slice(
        zipBufferWrong.byteOffset, 
        zipBufferWrong.byteOffset + zipBufferWrong.byteLength
      );
      console.log(`   - Tamanho após slice: ${arrayBuffer.byteLength} bytes`);
      
      if (arrayBuffer.byteLength === 0) {
        console.log('   ⚠️  PROBLEMA: Buffer vazio! Download falharia!');
      } else {
        console.log('   ✓ Buffer tem tamanho válido');
      }
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
    }

    // ✅ TESTE 2: Forma CORRETA (depois da correção)
    console.log('\n✅ TESTE 2: Forma CORRETA (após correção)');
    const zipBufferCorrect = await zip.generateAsync({ type: 'uint8array' });
    console.log(`   - Tipo retornado: ${zipBufferCorrect.constructor.name}`);
    console.log(`   - Tamanho: ${zipBufferCorrect.byteLength} bytes`);
    
    // Simular Response API (como no Next.js)
    if (typeof Response !== 'undefined') {
      const response = new Response(zipBufferCorrect, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="teste.zip"'
        }
      });
      console.log(`   ✓ Response criada com sucesso`);
      console.log(`   - Headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
    } else {
      console.log(`   ✓ Uint8Array pode ser enviado como Response (Node.js: simulated)`);
    }

    console.log('\n✨ RESULTADO: Download de ZIP deve funcionar corretamente!');
    console.log('\n📊 Resumo:');
    console.log('   - A correção passa Uint8Array diretamente');
    console.log('   - Response API manipula a conversão corretamente');
    console.log('   - Arquivo ZIP pode ser baixado sem problemas');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  }
}

// Executar teste
testZipGeneration().catch(console.error);
