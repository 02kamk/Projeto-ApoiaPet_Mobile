# Ativar pagamentos com Mercado Pago

Status: integração implementada no código, **não ativada nem homologada**. Não há aplicação Mercado Pago, conta de recebedor ou webhook configurados neste clone. O modo de simulação continua disponível depois de publicar o Firebase.

## Configurar a aplicação

1. Crie uma aplicação em Mercado Pago Developers, habilitada para Checkout Pro e autorização OAuth de contas recebedoras. Use contas de teste na homologação.
2. Configure a URL OAuth exata: `https://SEU-PROJETO.vercel.app/api/mp-callback`. Habilite PKCE S256. O backend cria `state` de uso único com expiração de dez minutos e faz a troca de código no servidor.
3. Nas variáveis de ambiente da Vercel, informe `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `APP_URL` (domínio HTTPS do app), `BACKEND_URL` (URL do projeto na Vercel, sem barra final) e `PAYMENTS_ENABLED=true` apenas no ambiente de homologação apropriado.
4. Configure o segredo real com `firebase functions:secrets:set MP_CLIENT_SECRET --project SEU_PROJECT_ID`.
5. Cadastre notificações de **pagamentos** e configure o segredo de assinatura na variável `MP_WEBHOOK_SECRET` da Vercel. A preferência aponta para `/api/mp-webhook?donationId=…`; preserve os parâmetros `data.id` enviados pelo provedor. O código usa a identificação do registro para localizar a conta recebedora e valida referência, moeda, valor e recebedor consultando a API do provedor.
6. Publique as funções novamente e coloque `EXPO_PUBLIC_PAYMENTS_ENABLED=true` no app de homologação. Reinicie/recompile o cliente após mudar essa variável.
7. Entre no ApoiaPet como ONG e selecione **Conectar minha ONG ao Mercado Pago**. A ONG deve autorizar sua própria conta no provedor. O token fica numa coleção negada ao cliente; renovações passam pelo servidor.
8. Entre como doador, escolha a ONG e **Mercado Pago · Pix / cartão**. O checkout hospedado coleta os dados de pagamento. O app não recebe número de cartão, CVV ou token privado. A disponibilidade de Pix e cartão depende da conta e do provedor.
9. Retorne ao app e confira o histórico. Retornar do checkout **não confirma** uma doação: só a consulta validada após webhook atualiza o estado.

## Homologação obrigatória

- Verifique que a cobrança cai na conta da ONG escolhida, não numa conta global da plataforma. Essa integração não cobra comissão de marketplace.
- Teste aprovação, pendência, recusa, cancelamento, reembolso e contestação. Os totais consideram somente os registros reais atualmente confirmados.
- Teste repetição da mesma solicitação: `requestId` mantém um único registro; reabrir o checkout deve usar o link do histórico. Uma criação que falhou não é repetida automaticamente; verifique o provedor antes de iniciar outra contribuição.
- Teste notificações repetidas, assinaturas inválidas, valor/moeda/recebedor divergentes e ordem invertida de eventos. Assinaturas com timestamp fora de dez minutos são rejeitadas; confirme essa tolerância com as tentativas de entrega do seu ambiente e mantenha o relógio do servidor sincronizado.
- Tentativas de pagamento ficam em `donations/{id}/attempts`. Um segundo pagamento aprovado para a mesma contribuição sinaliza `needsReconciliation` para revisão administrativa; não gera reembolso automático. Monitore esse campo no Console e faça a conciliação antes do uso público.
- Simulações são identificadas por `mode=test`; a função de simulação recusa registros reais. O cliente não tem permissão para escrever estados financeiros.
- Verifique expiração/renovação de tokens, reconexão da mesma conta e comportamento de rede indisponível. Sem conexão da ONG, o checkout informa erro e não inventa uma cobrança.

Para produção, use credenciais e contas de produção só após homologação completa. Publicar as funções, configurar regras e autorizar a conta recebedora são etapas externas que o proprietário precisa concluir.

Documentação oficial usada: [preferências Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference), [OAuth/PKCE](https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation), [renovação de token](https://www.mercadopago.com.br/developers/pt/docs/security/oauth/renewal), [notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications).
