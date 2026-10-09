const fetch = require('node-fetch');

const BASE_NOSSA = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE = 'busca-processos-dev-key-2024';

async function testEndpoints() {
  console.log('=== Testando endpoint de busca ===');
  
  try {
    const resposta = await fetch(`${BASE_NOSSA}/buscar/oab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOSSA_CHAVE
      },
      body: JSON.stringify({ estado: 'MS', numero: '3616' })
    });

    console.log('Status:', resposta.status);
    const texto = await resposta.text();
    console.log('Resposta completa:', texto);
    console.log('Tamanho da resposta:', texto.length);
    
    const dados = JSON.parse(texto);
    console.log('Dados parseados:', JSON.stringify(dados, null, 2));
    
    if (dados.id) {
      console.log('\n=== Testando buscar resultado pelo ID ===');
      console.log('ID recebido:', dados.id);
      
      // Tentar buscar resultado
      await new Promise(r => setTimeout(r, 2000)); // esperar 2s
      
      const resultadoRes = await fetch(`${BASE_NOSSA}/resultado/${dados.id}`, {
        method: 'GET',
        headers: {
          'x-api-key': NOSSA_CHAVE
        }
      });
      
      console.log('Status do resultado:', resultadoRes.status);
      const resultadoTexto = await resultadoRes.text();
      console.log('Resposta do resultado:', resultadoTexto);
    }
  } catch (erro) {
    console.error('Erro:', erro.message);
  }
}

testEndpoints();
