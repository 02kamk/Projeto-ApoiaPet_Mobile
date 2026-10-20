# Verificacao da base local

- TypeScript: aprovado.
- Expo install --check: dependencias compativeis.
- Expo Doctor: 20/20 verificacoes aprovadas.
- Exportacao do bundle Android: aprovada. Nao e um APK nem teste em dispositivo.
- Regras locais verificadas via Node: candidatura duplicada, exclusao com historico, restricao administrativa, complementacao, conclusao, encerramento das outras candidaturas e idempotencia.
- npm audit apos Router: 26 ocorrencias (7 moderadas e 19 altas), incluindo dependencias transitivas. Sem correcao forcada ou downgrade automatico. Revisao pendente antes de uso real.
- Sem validacao visual ou teste em celular.
