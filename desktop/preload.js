// Fa sapere all'app che gira nella versione per computer (così non mostra il tutorial "aggiungi alla Home").
const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('quadriamoDesktop', { version: process.env.npm_package_version || 'desktop' })
