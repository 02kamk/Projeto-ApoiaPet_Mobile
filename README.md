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

O proprietário ainda precisa criar o projeto Firebase, publicar funções/regras e configurar as contas de pagamento. O clone não contém credenciais nem serviços de produção já ativos.

Siga [a configuração completa do Firebase](docs/firebase.md) e [o guia do Mercado Pago](docs/mercado-pago.md). Copie `.env.example` para `.env.local` e configure também o backend em `functions/` conforme os guias.

```powershell
npm.cmd ci
npm.cmd --prefix functions ci
npm.cmd run web -- --localhost --port 8081
```

No Windows com scripts PowerShell bloqueados, utilize `npm.cmd` e `npx.cmd`. Para Android/iOS, use um Expo Go compatível ou uma development build.

## Verificação

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check:backend
npm.cmd --prefix functions run check
npx.cmd expo export --platform web --platform android
```

Os testes do backend usam os handlers reais com persistência em memória na fronteira do Firestore/Storage. Regras publicadas, autenticação real, uploads e pagamentos ainda precisam de homologação com seus projetos e contas.

## Estrutura

- `src/account/`: telas de cadastro, catálogo, candidaturas, agenda e doações.
- `src/backend/`: sessão, consultas em tempo real e envio/leitura de fotos.
- `functions/`: validações, transações de adoção, chat e integração de pagamentos.
- `firestore.rules` e `storage.rules`: controle de acesso por titular e ONG participante.

As antigas rotas da demonstração redirecionam para a área conectada. Seus dados temporários não podem ser recuperados depois de recarregar. Arquivos antigos de demonstração e documentos de escopo anteriores permanecem como referência, sem participação no fluxo atual.

O cadastro de ONG é autodeclarado; imagens não geram aprovação automática. Adoções são avaliadas por pessoas. Pagamentos reais ficam desativados até configurar e homologar a integração.
