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

## Recursos

- **Metas e comissão:** abra "Metas e comissão" no painel para definir a meta mensal da loja, do CAIQUE e da DANIELLE e o percentual de comissão. Isso cria o documento `config/geral` no Firestore.
- **Este mês:** comparativo com o mês anterior e progresso da meta.
- **Ranking do mês** entre CAIQUE e DANIELLE.
- **Pós-venda:** lembretes para 7, 30 e 90 dias depois da venda (vencidos nos últimos 30 dias e os próximos 3 dias). Clique em "Feito" para baixar o lembrete.
- **Lembrete de seguro:** para quem comprou sem seguro, avisa no 7º e no 25º dia que o cliente tem 30 dias para contratar o seguro com preço de moto nova. O botão "WhatsApp" abre a conversa com a mensagem pronta (você pode editar antes de enviar). "Já avisei" baixa o lembrete e "Fechou seguro" marca a venda como com seguro.
- **Telefone do cliente:** preencha ao registrar a venda; sem ele, o botão do WhatsApp não aparece.
- **Celular:** o menu de perfis fica fixo embaixo da tela, as vendas viram cartões e os botões têm tamanho bom para o toque. No Chrome do Android use o menu ⋮ → "Adicionar à tela inicial"; no iPhone, Compartilhar → "Adicionar à Tela de Início".
- **Importar planilha:** em "Importar planilha do Excel", escolha um arquivo .xlsx, .xls, .csv ou .pdf (PDF com texto; PDF de foto ou escaneado não é lido). O sistema reconhece as colunas pelo título (Data, Vendedor, Cliente, Telefone, Moto, Seguro, Valor), mostra uma prévia e só então importa. Vendas que já existem são ignoradas, então não duplica se importar duas vezes. Há um botão para baixar uma planilha modelo.
- **Filtro por período**, **modelos mais vendidos** e **edição** de vendas.
- **Baixar para Excel:** gera um arquivo `.csv` que abre direto no Excel.

Depois de atualizar o projeto, **publique de novo o conteúdo de `firestore.rules`** no console do Firebase (aba Regras). Sem isso, editar vendas e salvar metas será bloqueado.

## Atenção sobre segurança

Não há login: quem tiver o link consegue ver, adicionar e excluir vendas.
Se for usar com dados reais, não divulgue o link ou peça para adicionar login com Firebase Authentication e restringir as regras aos dois usuários.
