# Zvuk Desktop (Electron)

Простое неофициальное десктопное приложение стриминга ["Звук"](zvuk.com) на основе Electron.

<img src="https://go.zvuk.com/thumb/300x0/filters:quality(75):no_upscale()/imgs/2024/07/24/09/6541781/d82b84d332b09f3decf45c487aedcaecba761551.png" alt="zvuk_logo">

## Запуск
```bash
npm install
npm start
```

## Сборка (macOS .dmg)
```bash
npm run dist
```

## Решение проблем
### MacOS
Если приложение не запускается и просит отправить себя в корзину из-за "повреждения", нужно выполнить команду `xattr -c /Applications/Zvuk\ Desktop.app` в терминале, после чего запустить программу.

## Автообновления
GitHub Releases (`vokash3/zvuk-desktop`), запрос при старте на установку.
