# ApoiaPet

Demonstração mobile de adoção responsável em React Native + Expo + TypeScript.

## Executar

Requer Node.js e npm. No Windows com scripts PowerShell bloqueados, utilize npm.cmd/npx.cmd.

```sh
npm ci
npm start
```

Leia o QR com um Expo Go compatível com o SDK instalado. Android: `npm run android` com emulador configurado. Não foi testado em celular nesta sessão.

## Estado real

- Boas-vindas, início, catálogo com filtros, perfil, formulário em três etapas, revisão, candidaturas, histórico, painel e editor de pets.
- CRUD em memória: excluir pet sem vínculos; arquivar pet com histórico.
- Análise humana simulada, complementação com histórico, aprovação, desistência e conclusão que encerra outras candidaturas ativas do pet.
- Nenhuma autenticação real, token, persistência ou autorização no backend. A conta demo e o acesso administrativo são simulações. Reiniciar perde tudo. Não utilizar dados pessoais reais.
- Firebase Authentication, Firestore, Storage e regras de segurança ainda não integrados. Não guardar senhas em documentos ou chaves administrativas no aplicativo.
- Sem doações, pagamentos, chat, classificação de aptidão ou aprovação automática.
- Ilustrações representadas por emojis; ícone final de pata e coração e fotos ainda pendentes.

## Organização

`src/DemoScreen.tsx`: navegação e composição das telas. `src/ui.tsx`: componentes e identidade visual. `src/types.ts`: entidades. `src/domain.ts`: validação e regras locais. Próxima refatoração: extrair cada tela para arquivo próprio antes da integração Firebase.

## Verificação

```sh
npx tsc --noEmit
npx expo install --check
npx expo-doctor
```

Veja `docs/escopo.md`, `docs/apresentacao.md` e `docs/backlog.md`.

## Git

Este projeto deve usar seu próprio repositório, sem alterar o remoto do Ponto Certo:
https://github.com/02kamk/Projeto-ApoiaPet_Mobile

Se ainda não houver repositório local, na pasta ApoiaPet:

```sh
git init -b main
git add .
git commit -m "Base navegável de adoção ApoiaPet"
git remote add origin https://github.com/02kamk/Projeto-ApoiaPet_Mobile.git
git push -u origin main
```

Antes de publicar, consultar o remoto. Se já tiver commits, reconciliar o histórico; nunca usar force push. Nenhuma publicação deve ser presumida a partir destes comandos.
