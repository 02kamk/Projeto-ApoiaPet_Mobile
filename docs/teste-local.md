# Testar sem faturamento com os emuladores

O aplicativo pode usar Authentication, Firestore, Storage e Functions locais sem ativar o plano Blaze. O projeto de teste é **demo-apoiapet** e é separado do projeto real `apoiapet`. Contas e fotos criadas aqui não aparecem no Console Firebase da nuvem.

## Iniciar

No terminal da pasta do projeto:

```powershell
npm.cmd run emulators
```

Aguarde a mensagem de que todos os emuladores estão prontos. Em outro terminal:

```powershell
npm.cmd run web -- --localhost --port 8081 --clear
```

- App: http://localhost:8081
- Painel local de contas, banco e arquivos: http://127.0.0.1:4000

O `.env.local` já está com `EXPO_PUBLIC_USE_EMULATORS=true` e os pagamentos reais desativados. A configuração pública do projeto real foi preservada no arquivo, mas o modo local usa outro nome de aplicativo e substitui todos os serviços pela configuração `demo-apoiapet`. Não há fallback para a nuvem quando um emulador está parado.

O script usa a CLI instalada em `.local-tools/firebase`, detecta o Java do Android Studio quando necessário e mantém downloads/configurações em `.local-tools`. Para preparar outro computador:

```powershell
npm.cmd ci
npm.cmd --prefix functions ci
npm.cmd install --prefix .local-tools/firebase firebase-tools --no-audit --no-fund
```

É necessário Java compatível (use JDK 21 ou superior). No primeiro início, há downloads oficiais do Firebase. Nenhuma conta de faturamento ou login na CLI é necessário para esse projeto `demo-`.

## Teste manual

1. Crie uma conta de ONG com nome completo do responsável, telefone brasileiro e CEP real válido. A consulta de CEP ainda usa o ViaCEP e exige internet.
2. Cadastre um animal com foto e informações de vacinação.
3. Saia e crie uma conta de adotante com CEP no mesmo município, ou desative o filtro de cidade no catálogo.
4. Envie uma candidatura com as fotos do ambiente.
5. Entre na ONG e analise a candidatura. Após aprovar, teste o chat e agende a retirada.
6. Confira a agenda e o status “Em processo de adoção” no catálogo.
7. Confirme a retirada pela ONG e confira os históricos nas duas contas.
8. Crie uma contribuição em modo de simulação. Confirme-a e confira a identificação do doador na ONG.

E-mails de teste não recebem mensagens reais; recuperação e confirmação de e-mail podem ser inspecionadas nos logs/painel do emulador. A política de senha do Console da nuvem não é importada para o emulador: a interface continua exigindo os requisitos definidos no app. Evite dados pessoais reais nos testes.

## Salvar dados e encerrar

Em um segundo terminal, antes de encerrar:

```powershell
npm.cmd run emulators:save
```

Os dados de contas, banco e Storage são exportados para `.emulator-data` (ignorada pelo Git). O próximo `npm.cmd run emulators` importa esse diretório automaticamente. O encerramento normal com Ctrl+C também solicita exportação. Não feche o terminal nem desligue o computador antes de finalizar a exportação. Queda de energia/encerramento forçado pode perder alterações ainda não exportadas.

## Android e celular

O app continua sendo mobile. No **emulador Android** do Android Studio, o cliente usa `10.0.2.2` para alcançar os serviços do computador. Inicie os emuladores Firebase e depois `npm.cmd run android` com o emulador Android aberto.

O simulador iOS usa loopback, mas exige macOS. No navegador deste Windows, usa `127.0.0.1`.

Os serviços estão restritos ao próprio computador. **Celular físico não está configurado nesta etapa**: para usar Expo Go no aparelho será necessário configurar o IP da rede e o acesso aos serviços locais separadamente. Não basta apontar para `localhost` no telefone.

## Verificação automática

Com os quatro emuladores ativos, execute:

```powershell
npm.cmd run check:emulators
```

O teste usa SDKs reais contra os emuladores: cria contas fictícias, salva perfis, envia fotos, verifica regras de acesso de outra ONG, realiza candidatura/chat/agendamento/retirada e confirma uma doação simulada. Os registros ficam apenas no ambiente demo com e-mails `example.test`.

Pagamentos Mercado Pago reais estão bloqueados no cliente e no backend do ambiente local. Nenhuma cobrança é realizada.

Para voltar futuramente à nuvem, altere `EXPO_PUBLIC_USE_EMULATORS=false`, retire a sobreposição `functions/.env.local` (mantendo-a como backup fora da pasta de funções), configure o projeto real conforme [firebase.md](firebase.md) e reinicie o app. Isso não transfere automaticamente os dados fictícios do emulador para produção.
