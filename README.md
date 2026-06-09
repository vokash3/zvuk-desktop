# Zvuk Desktop (Electron)

Простое неофициальное десктопное приложение стриминга ["Звук"](zvuk.com) на основе Electron.

<img src="./resources/icons/128x128.png" alt="zvuk_logo">

---

# ✅ Установка

⚠️ Программу можно скачать на странице релизов [здесь](https://github.com/vokash3/zvuk-desktop/releases).

---

# Ручная сборка

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
