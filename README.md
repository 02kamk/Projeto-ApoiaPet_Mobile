# ApoiaPet

Aplicativo Expo + React Native + TypeScript para adoção responsável e apoio a ONGs.

## Funcionalidades

- Cadastro e login com Firebase Authentication; nome completo, telefone brasileiro e endereço por CEP.
- Senha com 10 caracteres ou mais, letra maiúscula, minúscula, número e caractere especial.
- Catálogo por município com opção de ver todo o Brasil, fotos, vacinas selecionáveis e testes com resultados (incluindo FIV/FeLV para gatos).
- Candidatura com fotos privadas do ambiente, análise humana e histórico por usuário/ONG.
- Chat após aprovação, agenda mensal de retiradas e avisos internos para os próximos sete dias.
- Reserva do animal ao agendar a retirada; conclusão da adoção após confirmação pela ONG.
- Histórico de doações com identificação do doador, totais reais separados das simulações.
- Integração de código com Mercado Pago: OAuth da ONG, Checkout Pro e confirmação por webhook.

## Configurar e executar

Para testar agora sem faturamento, use [o guia dos emuladores locais](docs/teste-local.md): `npm.cmd run emulators` e, em outro terminal, `npm.cmd run web -- --localhost --port 8081 --clear`.

O clone não contém credenciais. Para usar seus próprios serviços, crie o projeto Firebase, publique as regras e a API na Vercel e configure as contas de pagamento.

Siga [a configuração completa do Firebase](docs/firebase.md) e [o guia do Mercado Pago](docs/mercado-pago.md). Copie `.env.example` para `.env.local` e publique o backend da pasta `backend/` na Vercel conforme os guias.

```powershell
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd run web -- --localhost --port 8081
```

No Windows com scripts PowerShell bloqueados, utilize `npm.cmd` e `npx.cmd`. Para Android/iOS, use um Expo Go compatível ou uma development build.

## Versão online e APK

- **Web:** https://apoiapet.vercel.app (republicar com `npm.cmd run deploy:web`).
- **API:** https://apoiapet-api.vercel.app (pasta `backend/`, região São Paulo).
- **Android:** gere o APK com `npx.cmd eas-cli build -p android --profile preview`. O perfil usa os valores públicos fixados em `eas.json`, não o `.env.local`. Arquivos `.apk`/`.aab` não vão para o Git.

Para instalar o APK, copie o arquivo para o celular Android e permita "instalar apps de fontes desconhecidas" quando o sistema pedir.

## Avisos

- **Versão de testes.** A interface publicada (web e APK) ainda não passou por homologação completa. Os fluxos da API foram verificados por testes automatizados, mas use apenas dados fictícios.
- **Dados de demonstração.** O banco tem 10 ONGs fictícias no sul de SC (Criciúma, Forquilhinha, Içara, Siderópolis, Nova Veneza, Urussanga, Araranguá e Tubarão) com 27 animais de exemplo. As fotos vêm do Wikimedia Commons; veja os [créditos](docs/creditos-fotos.md).
- **Pagamentos desativados.** Doações reais pelo Mercado Pago ficam bloqueadas (`PAYMENTS_ENABLED=false`); só há doações de teste, sem cobrança.
- **Chaves públicas no app.** A configuração web do Firebase em `eas.json` e `.env.example` é pública por natureza; a proteção vem das regras do Firestore e da API. Chaves privadas (conta de serviço do Firebase, token do Blob, segredos do Mercado Pago) ficam só nas variáveis de ambiente da Vercel e nunca devem ser commitadas.
- **Pendências de segurança da conta:** revogar chaves de conta de serviço que tenham sido expostas e apagar cópias locais delas, ativar 2FA na Vercel e remover projetos vazios criados por engano no Google Cloud e na Expo.

## Verificação

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check:backend
npm.cmd --prefix backend run check
npx.cmd expo export --platform web --platform android
```

Os testes do backend usam os handlers reais com Firestore e Vercel Blob em memória. Regras publicadas, autenticação real, uploads e pagamentos ainda precisam de homologação com seus projetos e contas.

## Estrutura

- `src/account/`: telas de cadastro, catálogo, candidaturas, agenda e doações.
- `src/backend/`: sessão, consultas em tempo real e envio/leitura de fotos.
- `backend/`: API na Vercel (`api/` = rotas, `lib/` = validações, transações de adoção, chat, fotos e pagamentos).
- `firestore.rules`: leitura por titular e ONG participante (gravação só pela API). O acesso às fotos é aplicado em `backend/lib/photos.js`.

As antigas rotas da demonstração redirecionam para a área conectada. Seus dados temporários não podem ser recuperados depois de recarregar. Arquivos antigos de demonstração e documentos de escopo anteriores permanecem como referência, sem participação no fluxo atual.

O cadastro de ONG é autodeclarado; imagens não geram aprovação automática. Adoções são avaliadas por pessoas. Pagamentos reais ficam desativados até configurar e homologar a integração.
