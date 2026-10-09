# Кинопаб TV

Неофициальный клиент [Кинопаба](https://kino.pub) для телевизоров LG на webOS. Навигация пультом, плеер на hls.js с переключением озвучки, субтитров и качества на лету, автозапуск следующей серии.

Нужна своя подписка на Кинопаб. Проверено на LG OLED (webOS 11, Chrome 132).

![Главная](docs/screenshots/home.jpg)

| | |
| --- | --- |
| ![Каталог с фильтрами](docs/screenshots/catalog.jpg) | ![Страница фильма](docs/screenshots/item.jpg) |
| Каталог: сортировка по рейтингу, фильтры по жанру, качеству, году и стране | Страница фильма с рейтингами КП и IMDb |
| ![Страница сериала](docs/screenshots/series.jpg) | ![Полное описание](docs/screenshots/plot.jpg) |
| Сериал: сезоны, серии с прогрессом просмотра | Полное описание, если оно не поместилось |
| ![Серии в плеере](docs/screenshots/episodes.jpg) | ![Аудио и субтитры](docs/screenshots/tracks.jpg) |
| Список серий прямо в плеере | Озвучка и субтитры в одной панели |

## Что понадобится

- Node.js 20+
- [webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-installation): `npm i -g @webos-tools/cli`
- аккаунт на [developer.lge.com](https://webostv.developer.lge.com) и приложение **Developer Mode** из LG Content Store на телевизоре
- компьютер и телевизор в одной сети

## Установка на телевизор

1. На телевизоре откройте Developer Mode, войдите в аккаунт LG, включите **Dev Mode Status** и **Key Server**, перезагрузите телевизор. Запомните IP и passphrase, которые показывает приложение.
2. Добавьте телевизор в webOS CLI под именем `tv`:

   ```bash
   ares-setup-device --add tv --info "{'host': '192.168.0.10', 'port': '9922', 'username': 'prisoner'}"
   ares-novacom --device tv --getkey   # спросит passphrase с экрана телевизора
   ares-device --device tv --system-info
   ```

3. Соберите и установите приложение:

   ```bash
   cd app
   npm install
   npm run deploy
   ```

4. При первом запуске приложение покажет код: введите его на `kino.pub/device`.

Другое имя устройства: `bash scripts/deploy.sh --device=имя`.

## Продление Developer Mode

LG выключает Developer Mode через 1000 часов. `scripts/renew-devmode.sh` сбрасывает таймер, его удобно запускать по расписанию (cron, launchd).

```bash
cp scripts/tv.conf.example scripts/tv.conf     # впишите IP телевизора
cp ~/.ssh/tv_webos ~/.ssh/tv_webos_nopass
ssh-keygen -p -f ~/.ssh/tv_webos_nopass -N ''  # ключ без passphrase для запуска по расписанию
bash scripts/renew-devmode.sh                  # лог: ~/Library/Logs/webos-devmode-renew.log
```

## Разработка

```bash
cd app
npm run dev      # http://localhost:5173, стрелки и Enter вместо пульта, Backspace вместо «назад»
npm run check    # tsc + oxlint + oxfmt --check
```

Отладка на телевизоре: `ares-inspect --device tv --app ru.vrnn.kinopub` выдаёт адрес DevTools.
