# Testar localmente com os emuladores

Login e banco rodam nos emuladores do Firebase (projeto **demo-apoiapet**, separado do projeto real). A API roda no computador com `vercel dev`. As fotos usam um Blob store de verdade: crie na Vercel um store **privado só para desenvolvimento**, separado do de produção. Contas criadas aqui não aparecem no Console Firebase da nuvem.

## Preparar (uma vez)

```powershell
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd install --prefix .local-tools/firebase firebase-tools --no-audit --no-fund
npm.cmd install --global vercel
```

É necessário Java compatível (JDK 21 ou superior) para os emuladores. No primeiro início, há downloads oficiais do Firebase. Nenhuma conta de faturamento ou login na CLI do Firebase é necessário para o projeto `demo-`.

Crie `backend/.env.local` (ignorado pelo Git) a partir de `backend/.env.example`, com:

```
FIREBASE_PROJECT_ID=demo-apoiapet
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
BLOB_READ_WRITE_TOKEN=token-do-store-de-desenvolvimento
ALLOWED_ORIGINS=http://localhost:8081
PAYMENTS_ENABLED=false
```

Deixe `FIREBASE_SERVICE_ACCOUNT` vazio: sem ele, a API usa os emuladores. No `.env.local` do app, use `EXPO_PUBLIC_USE_EMULATORS=true` e `EXPO_PUBLIC_API_URL=http://localhost:3000`.

## Iniciar

Em três terminais, na pasta do projeto:

```powershell
npm.cmd run emulators
```

```powershell
cd backend; vercel dev --listen 3000
```

```powershell
npm.cmd run web -- --localhost --port 8081 --clear
```

- App: http://localhost:8081
- Painel local de contas e banco: http://127.0.0.1:4000

O script dos emuladores usa a CLI instalada em `.local-tools/firebase`, detecta o Java do Android Studio quando necessário e mantém downloads/configurações em `.local-tools`. Não há fallback para a nuvem quando um emulador está parado.

## Teste manual

1. Crie uma conta de ONG com nome completo do responsável, telefone brasileiro e CEP real válido. A consulta de CEP ainda usa o ViaCEP e exige internet.
2. Cadastre um animal com foto e informações de vacinação.
3. Saia e crie uma conta de adotante com CEP no mesmo município, ou desative o filtro de cidade no catálogo.
4. Envie uma candidatura com as fotos do ambiente.
5. Entre na ONG e analise a candidatura. Após aprovar, teste o chat e agende a retirada.
6. Confira a agenda e o status “Em processo de adoção” no catálogo.
7. Confirme a retirada pela ONG e confira os históricos nas duas contas.
8. Faça uma doação de teste (nada é cobrado) e confira a identificação do doador na ONG.

E-mails de teste não recebem mensagens reais; recuperação e confirmação de e-mail podem ser inspecionadas nos logs/painel do emulador. A política de senha do Console da nuvem não é importada para o emulador: a interface continua exigindo os requisitos definidos no app. Evite dados pessoais reais nos testes.

## Salvar dados e encerrar

Em outro terminal, antes de encerrar:

```powershell
npm.cmd run emulators:save
```

Os dados de contas e banco são exportados para `.emulator-data` (ignorada pelo Git); as fotos ficam no Blob de desenvolvimento. O próximo `npm.cmd run emulators` importa esse diretório automaticamente. O encerramento normal com Ctrl+C também solicita exportação. Não feche o terminal nem desligue o computador antes de finalizar a exportação.

## Android e celular

No **emulador Android** do Android Studio, o cliente usa `10.0.2.2` para alcançar os serviços do computador; use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`. Inicie os emuladores Firebase, a API e depois `npm.cmd run android` com o emulador Android aberto.

O simulador iOS usa loopback, mas exige macOS. No navegador deste Windows, usa `127.0.0.1`.

**Celular físico não está configurado nesta etapa**: para usar Expo Go no aparelho é preciso apontar o app para o IP do computador na rede (ou para a API publicada na Vercel). Não basta usar `localhost` no telefone.

## Verificação automática

`npm.cmd run check:backend` testa os handlers e rotas reais da API (login obrigatório, CORS, regras de fotos, fluxo de adoção e doações) com Firestore e Blob em memória, sem precisar dos emuladores.

Pagamentos Mercado Pago reais ficam bloqueados enquanto `PAYMENTS_ENABLED` não for `true`. Nenhuma cobrança é realizada.

Para usar a nuvem, altere `EXPO_PUBLIC_USE_EMULATORS=false`, aponte `EXPO_PUBLIC_API_URL` para a API publicada, configure o projeto real conforme [firebase.md](firebase.md) e reinicie o app. Isso não transfere os dados fictícios do emulador para produção.
