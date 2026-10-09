import requests
import json
# ==============================
# CONFIGURAÇÕES EXATAS DO SEU SISTEMA
# ==============================
API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJleHAiOjE4MTMyMDExOTkuMjM2Njc2LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2NvcGVyX2FwaV9wbGF5Z3JvdW5kIl19.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE"
# ==============================
# TESTE DA BUSCA POR OAB (mesma URL do bot)
# ==============================
print("🔍 TESTANDO CONEXÃO COM A API DO ESCAVADOR")
print("="*60)
# URL e parâmetros EXATOS que o bot usa
url = "https://api.escavador.com/api/v2/advogado/processos"
params = {
    "oab_estado": "RN",
    "oab_numero": "18133",
    "ordem": "desc",
    "por_pagina": "200"
}
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json"
}
print(f"📡 URL USADA: {url}")
print(f"🔢 PARÂMETROS: {json.dumps(params, indent=2)}")
print("\n⏳ Enviando requisição...\n")
try:
    resposta = requests.get(url, params=params, headers=headers, timeout=30)
    print(f"📊 CÓDIGO DE RESPOSTA: {resposta.status_code}")
    if resposta.status_code == 200:
        dados = resposta.json()
        print("✅ CONEXÃO BEM-SUCEDIDA!")
        print(f"\n📋 TOTAL DE ITENS RETORNADOS: {len(dados.get('items', []))}")
        if dados.get("items"):
            print("\n🎉 ENCONTRADO! Dados do primeiro processo:")
            print(json.dumps(dados["items"][0], indent=2, ensure_ascii=False))
        else:
            print("\n⚠️  A API RESPONDEU, MAS NÃO TEM PROCESSOS PARA ESSA OAB")
            print("📝 Dados completos da resposta:")
            print(json.dumps(dados, indent=2, ensure_ascii=False))
    elif resposta.status_code == 401:
        print("❌ ERRO DE AUTENTICAÇÃO: Token inválido ou expirado!")
    elif resposta.status_code == 403:
        print("❌ ACESSO NEGADO: Sua chave não tem permissão para essa busca!")
    elif resposta.status_code == 404:
        print("❌ ROTA NÃO EXISTE: A URL da API mudou!")
    else:
        print(f"❌ ERRO INESPERADO: {resposta.text}")
except Exception as e:
    print(f"❌ FALHA NA CONEXÃO: {str(e)}")
print("\n" + "="*60)
print("🔁 TESTE COM OAB CONHECIDA (SP 1) PARA CONFIRMAR")
print("="*60)
params["oab_estado"] = "SP"
params["oab_numero"] = "1"
resposta2 = requests.get(url, params=params, headers=headers, timeout=30)
dados2 = resposta2.json()
print(f"📋 TOTAL PARA OAB SP/1: {len(dados2.get('items', []))}")
if dados2.get("items"):
    print("✅ API ESTÁ FUNCIONANDO PERFEITAMENTE! O problema é só nos dados da OAB RN/18133.")
else:
    print("❌ HÁ PROBLEMA NA CONEXÃO OU NA CHAVE DE ACESSO.")
