# Vendas de motos · Caique e Danielle

Painel com três visões: **Juntos**, **CAIQUE** e **DANIELLE**.
Cada um registra a moto vendida, o valor e se foi com ou sem seguro.
O painel mostra o total vendido de cada um, o total dos dois e gráficos.

Feito com React (Vite), Firebase Firestore e Recharts.

## 1. Criar o Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**.
2. No menu **Build → Firestore Database**, clique em **Criar banco de dados** (modo produção, região `southamerica-east1`).
3. Na aba **Regras**, cole o conteúdo do arquivo `firestore.rules` e clique em **Publicar**.
4. Em **Configurações do projeto (engrenagem) → Seus apps**, clique em **</> Web**, registre o app e copie os valores do `firebaseConfig`.

## 2. Rodar no computador

```bash
npm install
cp .env.example .env     # preencha com os valores do Firebase
npm run dev
```

## 3. Subir no GitHub

```bash
git init
git add .
git commit -m "Painel de vendas de motos"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/vendas-motos.git
git push -u origin main
```

(O arquivo `.env` não sobe, o `.gitignore` já bloqueia.)

## 4. Publicar na Vercel

1. Em https://vercel.com, clique em **Add New → Project** e escolha o repositório `vendas-motos`.
2. A Vercel detecta o Vite sozinha (build `npm run build`, saída `dist`).
3. Em **Environment Variables**, cadastre as 6 variáveis do `.env.example` com os valores do Firebase.
4. Clique em **Deploy**. Cada `git push` na `main` publica de novo.

## Atenção sobre segurança

Não há login: quem tiver o link consegue ver, adicionar e excluir vendas.
Se for usar com dados reais, não divulgue o link ou peça para adicionar login com Firebase Authentication e restringir as regras aos dois usuários.
