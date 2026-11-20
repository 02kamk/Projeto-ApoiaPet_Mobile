# Ativação do ApoiaPet

Arquitetura:

- **Firebase** (plano gratuito Spark): Authentication (login) e Firestore (banco). O app lê o Firestore diretamente, protegido por `firestore.rules`, e nunca grava nele.
- **Vercel** (pasta `backend/`): API que valida e grava todos os dados com `firebase-admin`, região `gru1` (São Paulo).
- **Vercel Blob** (store **privado**): fotos. Só a API envia e entrega as fotos, aplicando as regras de acesso.

```
App (Expo) ──login──▶ Firebase Auth
    │ ──leitura──▶ Firestore (firestore.rules)
    └─ token ──▶ Vercel /api/call, /api/upload, /api/photo ──▶ Firestore (admin) + Blob privado
Mercado Pago ──▶ /api/mp-callback, /api/mp-webhook
```

## 1. Criar e configurar

### Firebase

1. No [Console Firebase](https://console.firebase.google.com/), crie um projeto e cadastre um aplicativo **Web**. A configuração do SDK JavaScript também é usada pelo Expo no Android/iOS.
2. Ative Authentication → Sign-in method → **E-mail/senha**. Adicione `localhost` aos domínios autorizados para desenvolvimento e o domínio HTTPS da aplicação quando publicar.
3. Em Authentication → Settings → Password policy, configure o modo **Require**, mínimo **10** caracteres, letra maiúscula, letra minúscula, número e caractere não alfanumérico.
4. Crie o Firestore no modo de produção (região `southamerica-east1`). Não é preciso ativar Storage nem Cloud Functions.
5. Publique as regras: `firebase deploy --only firestore:rules --project SEU_PROJECT_ID` (Firebase CLI: `npm.cmd install --global firebase-tools` e `firebase login`), ou cole o conteúdo de `firestore.rules` em Firestore → Regras.
6. Em Configurações do projeto → Contas de serviço, clique em **Gerar nova chave privada**. Guarde o JSON com cuidado: ele dá acesso total ao projeto. Ele vai **somente** para a variável `FIREBASE_SERVICE_ACCOUNT` da Vercel, nunca para o app ou o Git.

### Vercel

1. Na [Vercel](https://vercel.com/), importe este repositório como um projeto novo e defina **Root Directory = `backend`**. Framework: **Other**. Não há comando de build.
2. Em Storage, crie um **Blob store privado** e conecte-o ao projeto. Na Vercel, a autenticação do Blob é automática (OIDC).
3. Em Settings → Environment Variables, configure as variáveis listadas em `backend/.env.example`:
   - `FIREBASE_SERVICE_ACCOUNT`: o JSON da conta de serviço, em uma linha;
   - `ALLOWED_ORIGINS`: domínios do app web, se houver (o app nativo não precisa);
   - `PAYMENTS_ENABLED=false` até homologar o Mercado Pago (ver [mercado-pago.md](mercado-pago.md)).
4. Faça o deploy. A URL do projeto (ex.: `https://apoiapet-api.vercel.app`) é a `EXPO_PUBLIC_API_URL` do app.

### App

1. Copie `.env.example` para `.env.local` e preencha `apiKey`, `authDomain`, `projectId` e `appId` da configuração Web, e `EXPO_PUBLIC_API_URL`. Mantenha `EXPO_PUBLIC_PAYMENTS_ENABLED=false` até homologar o Mercado Pago. Não coloque segredos em `EXPO_PUBLIC_*`: essas variáveis vão dentro do app.
2. Execute `npm.cmd ci` e reinicie o Metro: `npm.cmd run web -- --localhost --port 8081 --clear`.

O login só requer o Firebase, mas cadastro, animais, candidaturas, chat, agendamento, fotos e doações exigem a API publicada.

## 2. O que fica em cada lugar

| Dado | Persistência e acesso |
| --- | --- |
| Senha | Firebase Authentication; nunca no Firestore ou nas funções do app. |
| Nome de exibição e cidade | `profiles/{uid}`; perfil da ONG pode ser lido por usuários autenticados. Perfil de doador só pelo titular. |
| Nome completo do responsável, telefone e CEP/endereço | `privateProfiles/{uid}`, somente o titular e o backend. |
| Animais, foto, vacinas e situação | `pets/{id}`; catálogo lê `listed=true`, incluindo “Em processo de adoção”. ONG também lê seus pausados/adotados. |
| Candidatura, contato compartilhado, respostas e histórico | `applications/{petId_uid}`; somente candidato e ONG escolhida. Não há aprovação automática. |
| Fotos da moradia | Blob privado `homes/{uid}/{applicationId}/…`; `/api/photo` entrega apenas ao titular e à ONG da candidatura. Não existe URL pública. |
| Fotos dos animais e de perfil | Blob privado `pets/{ongUid}/…` e `avatars/{uid}/…`; entregues pela API a usuários autenticados. O app reduz para até 1600 px em JPEG (sem metadados de localização); o servidor confere o tipo real do arquivo (JPG/PNG/WebP, até 4 MB) e escolhe o caminho. |
| Mensagens | `applications/{id}/messages`; somente participantes. Envio após aprovação, arquivado ao concluir. |
| Retirada e avisos | Data/local na candidatura. Agenda mensal e avisos internos para os próximos 7 dias, em horário de Brasília. Não há push, SMS ou Google Calendar. |
| Doações e identificação do doador | `donations/{id}`; somente doador e ONG envolvidos. Total de simulações separado do total real. |
| Tokens OAuth e estados de autorização | `paymentCredentials` e `oauthStates`; acesso negado ao cliente. Segredos ficam nas variáveis de ambiente da Vercel. |

Todas as gravações passam pela API, que verifica o token do Firebase (`Authorization: Bearer`). As regras negam gravações diretas do cliente. O servidor valida os dados, deriva titular/ONG da sessão e protege transições com transações. Nenhuma função administrativa de adoção decide elegibilidade automaticamente.

## 3. Cadastro e busca por CEP

O CEP é validado com oito dígitos e consultado no [ViaCEP](https://viacep.com.br/). O backend consulta novamente a fonte e grava cidade/UF/código IBGE. Isso evita aceitar uma cidade adulterada no cliente. Falha de rede e CEP inexistente são apresentados sem salvar endereço incorreto.

O telefone aceita DDD brasileiro válido + 8 números de fixo (iniciado por 2–5) ou 9 de celular (iniciado por 9). A interface recebe 10/11 números, sem `+55`.

Adoção começa filtrada pelo **mesmo município**, com opção de ver o Brasil todo. Não calcula raio ou distância em quilômetros, nem usa localização precisa. Para doações, todas as ONGs cadastradas aparecem. O cadastro de ONG é autodeclarado; conexão financeira é separada.

## 4. Fluxo de adoção e teste entre contas

1. Crie uma ONG, cadastre um animal com foto e selecione as vacinas aplicadas e pendentes nas caixas por espécie. Marque testes realizados (FIV/FeLV para gatos) e informe o resultado; não informado nunca vira negativo automaticamente. Opção desmarcada significa “não registrado”. Use as observações para outras vacinas, exames, datas e registros antigos. O formulário registra dados, não define protocolo veterinário.
2. Entre em outra conta como doador/adotante. Busque o animal, preencha moradia, proteção, rotina e motivação, anexe 1–6 fotos e autorize compartilhamento com a ONG escolhida.
3. A candidatura aparece em Minhas candidaturas e Meu histórico do adotante, e em Administração do abrigo da ONG. Uma conta de outra ONG não pode acessar os detalhes.
4. A ONG inicia análise, pede complementação, aprova ou recusa com justificativa. Apartamentos devem ter suas proteções descritas e fotografadas; uma pessoa da ONG avalia o conjunto.
5. Após aprovação, ambos conversam no chat. A ONG registra data, horário de Brasília e local combinados para retirada.
6. A transação reserva o animal: continua no catálogo como **Em processo de adoção**, sem aceitar novas candidaturas. Outra candidatura não consegue agendar o mesmo animal.
7. A agenda mostra as retiradas. Após entrega efetiva, a ONG confirma em duas etapas; o animal vira **Adotado**, sai do catálogo e outras candidaturas ativas são encerradas. Os históricos permanecem.
8. Desistir de uma retirada libera o animal e preserva o histórico. Não é possível concluir uma candidatura ainda não agendada.
9. Recarregue e troque de conta para conferir isolamento e persistência. A evidência de fotos e mensagens continua disponível aos participantes.

## 5. Mercado Pago

Leia também [docs/mercado-pago.md](mercado-pago.md). Há integração de código para OAuth de cada ONG, preferência Checkout Pro e webhook autenticado. Isso **não significa** que uma conta já foi conectada ou que pagamentos reais foram homologados.

## Verificação local e limites

Execute `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run check:donations` e `npm.cmd run check:backend` (instale antes com `npm.cmd --prefix backend ci`). `npx.cmd expo export --platform web --platform android` verifica os pacotes.

Os testes exercitam os handlers e as rotas reais da API com Firestore e Blob em memória, incluindo login obrigatório, CORS, upload com checagem de tipo, regras de leitura das fotos, incluindo propriedade da candidatura, reserva, retirada, encerramento de concorrentes, desistência e histórico de doações. Também testam validações e HMAC. Eles não substituem homologação com Authentication, regras do Firestore, Blob, OAuth, checkout e webhook publicados. Essa homologação depende da criação dos projetos e das credenciais do proprietário.

Não há compatibilidade com dados legados: o banco começa vazio e toda escrita passa pela API. Doações de teste (confirmadas sem dinheiro) só são aceitas enquanto `PAYMENTS_ENABLED` não for `true`; com pagamentos reais ligados, o servidor as recusa. Erros inesperados são registrados no log da Vercel e o app recebe apenas uma mensagem genérica.

Antes do uso público, defina política de retenção/exclusão de fotos e dados pessoais, rotina para remover uploads abandonados, verificação das ONGs, limites de uso e App Check/rate limiting conforme sua operação. Os arquivos não são apagados automaticamente ao encerrar uma candidatura, pois compõem o histórico solicitado.

Referências oficiais: [Expo ImagePicker SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [Expo ImageManipulator SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/), [Vercel Functions](https://vercel.com/docs/functions), [Vercel Blob privado](https://vercel.com/docs/vercel-blob/private-storage), [verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
