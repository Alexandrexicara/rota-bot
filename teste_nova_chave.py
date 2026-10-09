import requests
import json
# ==============================
# NOVA CHAVE VÁLIDA ATUALIZADA
# ==============================
API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiNzUyNmFjYmExNTY5NjM0ZTQwYTYzM2NmOTIxMWQ0NWU3Y2IwYmI1NWI3OWQ3ZGIwYTUwOTM0YTQ0MzgwYTY4Nzc0NzM0OTUzYjFlOTdhZGUiLCJpYXQiOjE3ODQyMzIyNjEuNjczOTUzLCJuYmYiOjE3ODQyMzIyNjEuNjczOTU0LCJleHAiOjE4MTU3OTMxOTkuNjcyNDY1LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2Vzc2FyX2FwaV9wbGF5Z3JvdW5kIl19.gAE09ftu6pObBQIhIXPvEuEOUSHr4C8ilrIX67uGZe-QVdYOVoKa2zKZzVUyURmAKMwCn-LkwgpIHRekGQ41ctMb_L68lXXehBlCSgWpo8npxRH5lpaaIpPUdYLGCFPTUIrJGARMSOMuLQ52tf6IlBTTQnDKysTVDPZ66pl87xpkfynYo9KyZXAEbYwZGXkfYwaSVpFor_WH5xo55idYk1PKaXq76Mv3cQZ1YEM9u__a21QTdAnEVwfhB3Dhr0a0PJQkLLoD1EJuIXhCM9hiC9KuYdKhtRq7CT8i5RvUFqvUs8l3PblLdhH-Y6_lhdwvEIeI5h_oUnbjgKDFLx84pOO83Fnlmcw_jpy1--SWbTT6gLhFsXDhmQ545p-NO6E7cr9Qu2Nm5lf-Ve8pTA5nUxqjVIpv-PJpEOdZzYyRbNBTTZA2bVcSfbJXLCfJ2PPJV7oO3NlOEadzoMGj6JDrtm8S_bdqZsbUgXylAtbuzjFLvjFTOI2ivVr50lCGT1jUf4CVsZ18QuHtY-pdKpEESIj-CYn4ebzGdTXcuROwuJBsVQDbustZ7iu5ThZrS3bv_tKXfTsa3kgkoo7Q04vweo5RJ2ITgnW5YovT2Qe6uZ3111V_ptruax4ExsnlXE96gaPRKOpcLle8fA3LlcrQ2AhpOWFIFQcYUQfEuRhrjvA"
url = "https://api.escavador.com/api/v2/advogado/processos"
params = {"oab_estado": "SP", "oab_numero": "1", "ordem": "desc", "por_pagina": "200"}
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "X-Requested-With": "XMLHttpRequest"
}
print("🔄 Testando nova chave...")
resp = requests.get(url, params=params, headers=headers, timeout=30)
if resp.status_code == 200:
    dados = resp.json()
    print(f"✅ SUCESSO! Conexão funcionando.")
    print(f"📋 Processos encontrados para OAB SP/1: {len(dados.get('items', []))}")
else:
    print(f"❌ Erro: {resp.status_code} - {resp.text[:150]}")
