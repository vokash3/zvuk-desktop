// preload.js — здесь можно добавлять мосты, если понадобится
const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('zvukApp', { version: '1.0.0' })
