# Registro de Toner GLPI

App Android simples para registrar toner usado direto no GLPI, sem backend local.

## Fluxo

- seletor de impressora
- botao `Enviar`
- registro direto na API do GLPI
- aviso de quantos toners compativeis ainda restam

## Configuracao local

O repositório nao precisa levar credenciais reais.

1. use [app-config.local.example.js](C:/Users/agrossdobrasil/Documents/dev/Glpi/app/app-config.local.example.js) como referencia das crendeciais do GLPI


## Comandos

```bash
npm install
npm test
npm run android:sync
npm run android:open
```

## Estrutura atual

- interface em [app](C:/Users/agrossdobrasil/Documents/dev/Glpi/app)
- cliente GLPI em [glpi.js](C:/Users/agrossdobrasil/Documents/dev/Glpi/app/lib/glpi.js)
- fluxo de impressoras e toners em [printerWorkflow.js](C:/Users/agrossdobrasil/Documents/dev/Glpi/app/lib/printerWorkflow.js)
- projeto Android em [android](C:/Users/agrossdobrasil/Documents/dev/Glpi/android)
