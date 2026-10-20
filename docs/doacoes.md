# Escopo atualizado: adoção e doações de alimentação

A solicitação mais recente inclui novamente doações no aplicativo local. Esta decisão substitui os trechos anteriores que restringiam o projeto exclusivamente à adoção.

## Demonstração implementada

Início → Doar alimentação → escolher local → escolher necessidade e valor → revisar → Pix ou cartão → simular aprovação → registro e histórico.

- Três locais explicitamente fictícios, com necessidades de alimentação para gatos, cães e outros animais acolhidos.
- Contribuição financeira única destinada à alimentação; não equivale à compra ou entrega de ração.
- Valores sugeridos e valor personalizado; mínimo demonstrativo de R$ 1 e máximo de R$ 10.000.
- Pix: tela demonstrativa sem chave, QR Code pagável ou código de transferência.
- Cartão: cartão ilustrativo; nenhum dado real solicitado ou armazenado.
- Registros pendentes, confirmados em simulação e cancelados. Histórico em memória compartilhado entre rotas até recarregar.
- Nenhum dinheiro é recebido, cobrado ou transferido. Registro local não é comprovante financeiro.
- Pets adotados saem do catálogo após a conclusão da adoção; registros administrativos e candidaturas permanecem.

## Pendências para doações reais

Confirmar instituições e suas autorizações, escolher provedor de pagamento e conta recebedora, integrar backend e checkout do provedor, verificar confirmação por webhook e persistir registros com controle de acesso. Chaves administrativas e dados de cartão não devem ser incluídos no app.

Figma não consultado por limite da integração; interface implementada a partir da descrição mais recente e da identidade visual existente. Não afirmar reprodução fiel do protótipo.

## Verificar

`node scripts/check-donations.cjs`
`npm run typecheck`
`npm run lint`

Teste manual: escolha Pix, saia sem confirmar, reabra pelo histórico; confirme e verifique o registro. Repita com cartão e cancelamento. Reiniciar perde os dados. Testes em aparelho real e validação visual continuam pendentes.
