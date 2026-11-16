# Ativação do ApoiaPet

O código usa Firebase Authentication, Firestore, Storage e Cloud Functions em `southamerica-east1`. O projeto Firebase ainda precisa ser criado pelo proprietário. Não há conexão de produção nem credenciais configuradas neste clone.

## 1. Criar e configurar o Firebase

1. No [Console Firebase](https://console.firebase.google.com/), crie um projeto e cadastre um aplicativo **Web**. A configuração do SDK JavaScript também é usada pelo Expo no Android/iOS.
2. Ative Authentication → Sign-in method → **E-mail/senha**. Adicione `localhost` aos domínios autorizados para desenvolvimento e o domínio HTTPS da aplicação quando publicar.
3. Em Authentication → Settings → Password policy, configure o modo **Require**, mínimo **10** caracteres, letra maiúscula, letra minúscula, número e caractere não alfanumérico. Essa política é obrigatória para também impedir senhas fracas criadas fora do aplicativo e na recuperação de senha. O app mostra e valida os cinco requisitos antes do cadastro.
4. Crie o Firestore no modo de produção e ative Storage. Cloud Functions e Storage podem exigir o plano Blaze e faturamento. Confira as condições no Console antes de ativar.
5. Copie `.env.example` para `.env.local` e preencha `apiKey`, `authDomain`, `projectId`, `appId` e `storageBucket` a partir da configuração Web. Mantenha `EXPO_PUBLIC_PAYMENTS_ENABLED=false` até homologar o Mercado Pago. Não use valores de exemplo nem chaves de conta de serviço.
6. Instale Firebase CLI pela fonte oficial (`npm.cmd install --global firebase-tools`) e entre com `firebase login`. Use Node 22 para as funções; o aplicativo pode ser desenvolvido com a versão local do Node.
7. Na pasta do app, execute `npm.cmd ci` e `npm.cmd --prefix functions ci`.
8. Copie `functions/.env.example` para `functions/.env.SEU_PROJECT_ID`; use `PAYMENTS_ENABLED=false`, seu domínio HTTPS em `APP_URL` e `https://southamerica-east1-SEU_PROJECT_ID.cloudfunctions.net` em `BACKEND_URL`.
9. As funções de pagamento referenciam dois segredos do Secret Manager. Configure `firebase functions:secrets:set MP_CLIENT_SECRET --project SEU_PROJECT_ID` e `firebase functions:secrets:set MP_WEBHOOK_SECRET --project SEU_PROJECT_ID`. Se ainda não criou a aplicação Mercado Pago, use valores temporários **NOT_CONFIGURED** e mantenha os dois indicadores de pagamento desativados. Substitua-os pelos segredos verdadeiros antes da homologação. Nunca envie esses valores pelo chat ou os coloque em `EXPO_PUBLIC_*`.
10. Publique o backend e as regras: `firebase deploy --only functions,firestore:rules,storage --project SEU_PROJECT_ID`. Autorize o acesso entre Storage e Firestore solicitado pelo CLI para que as regras consigam verificar a ONG participante.
11. Para leitura autenticada das fotos na web, copie `storage.cors.example.json`, ajuste o domínio e aplique com Google Cloud CLI: `gcloud storage buckets update gs://SEU_BUCKET --cors-file=storage.cors.example.json`. Mantenha somente as origens utilizadas. A autorização continua sendo feita pelas regras de Storage.
12. Reinicie o Metro: `npm.cmd run web -- --localhost --port 8081 --clear`. Abra http://localhost:8081.

O login só requer Authentication, mas cadastro completo, candidaturas, chat, agendamento e doações exigem as funções publicadas. Apenas adicionar o arquivo `.env.local` não publica o backend.

## 2. O que fica em cada lugar

| Dado | Persistência e acesso |
| --- | --- |
| Senha | Firebase Authentication; nunca no Firestore ou nas funções do app. |
| Nome de exibição e cidade | `profiles/{uid}`; perfil da ONG pode ser lido por usuários autenticados. Perfil de doador só pelo titular. |
| Nome completo do responsável, telefone e CEP/endereço | `privateProfiles/{uid}`, somente o titular e o backend. |
| Animais, foto, vacinas e situação | `pets/{id}`; catálogo lê `listed=true`, incluindo “Em processo de adoção”. ONG também lê seus pausados/adotados. |
| Candidatura, contato compartilhado, respostas e histórico | `applications/{petId_uid}`; somente candidato e ONG escolhida. Não há aprovação automática. |
| Fotos da moradia | Storage `homes/{uid}/{applicationId}/…`; leitura apenas do titular e da ONG da candidatura. Sem URL permanente de download nas telas. |
| Fotos dos animais | Storage `pets/{ongUid}/…`; disponíveis a usuários autenticados. JPG/PNG/WebP, até 5 MB por arquivo. |
| Mensagens | `applications/{id}/messages`; somente participantes. Envio após aprovação, arquivado ao concluir. |
| Retirada e avisos | Data/local na candidatura. Agenda mensal e avisos internos para os próximos 7 dias, em horário de Brasília. Não há push, SMS ou Google Calendar. |
| Doações e identificação do doador | `donations/{id}`; somente doador e ONG envolvidos. Total de simulações separado do total real. |
| Tokens OAuth e estados de autorização | `paymentCredentials` e `oauthStates`; acesso negado ao cliente. Segredos da aplicação ficam no Secret Manager. |

Todas as gravações de negócio passam por funções autenticadas. As regras negam gravações diretas do cliente. O servidor valida os dados, deriva titular/ONG da sessão e protege transições com transações. Nenhuma função administrativa de adoção decide elegibilidade automaticamente.

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

Execute `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run check:backend` e `npm.cmd --prefix functions run check`. `npx.cmd expo export --platform web --platform android` verifica os pacotes.

Os testes exercitam os handlers reais das funções com fronteira de Firestore/Storage em memória, incluindo propriedade da candidatura, reserva, retirada, encerramento de concorrentes, desistência e histórico de doações. Também testam validações e HMAC. Eles não substituem homologação com Authentication, regras Firestore/Storage, CORS, OAuth, checkout e webhook publicados. Essa homologação depende da criação dos projetos e das credenciais do proprietário.

As antigas rotas da demonstração redirecionam para a área conectada. Dados que existiam apenas em memória na demonstração não podem ser recuperados após recarregar. Se tiver usado a versão Firebase anterior, complete o cadastro para criar o perfil privado; animais antigos precisam ser recadastrados ou migrados para incluir situação, foto e vacinas. `testPayments` legado é somente leitura pelas regras; seus registros não são contados como dinheiro real.

Antes do uso público, defina política de retenção/exclusão de fotos e dados pessoais, rotina para remover uploads abandonados, verificação das ONGs, limites de uso e App Check/rate limiting conforme sua operação. Os arquivos não são apagados automaticamente ao encerrar uma candidatura, pois compõem o histórico solicitado.

Referências oficiais: [Expo ImagePicker SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [funções callable](https://firebase.google.com/docs/functions/callable), [Storage Rules](https://firebase.google.com/docs/storage/security).
