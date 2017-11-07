# Подключение камер в драйвере Yahka

Доработанный драйвер находится пока вот тут:
https://github.com/kirovilya/ioBroker.yahka

Для доработки драйвера https://github.com/jensweigele/ioBroker.yahka использовались:
- документация и исходные тексты https://github.com/KhaosT/HAP-NodeJS и плагин для Homebridge https://github.com/KhaosT/homebridge-camera-ffmpeg 
- статья https://geektimes.ru/post/281962/ 

**Внимание! Драйвер находится в стадии разработки. Стабильность не гарантируется! Ставите на свой страх и риск!**

## Установка FFMPEG.

Для каждой платформы он ставится по-разному. Можно собрать из исходников, либо поискать готовую сборку. Например тут https://www.johnvansickle.com/ffmpeg/ 
Обязательно наличие кодировщика libx264.
Проверить наличие кодировщика после установки ffmpeg можно командой:
```
ffmpeg -codecs | grep 264
```
В результатах должна быть строка вида:
```
DEV.LS h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (decoders: h264 h264_v4l2m2m h264_vdpau ) (encoders: libx264 libx264rgb h264_v4l2m2m )
```

Для Raspberry Pi 3 можно воспользоваться готовой сборкой в которой есть кодек с поддержкой аппаратного кодирования GPU (h264_omx, меньше потребляет ресурсов).
https://github.com/legotheboss/YouTube-files/raw/master/ffmpeg_3.1.4-1_armhf.deb
Ставить так:
```
wget https://github.com/legotheboss/YouTube-files/raw/master/ffmpeg_3.1.4-1_armhf.deb
sudo dpkg -i ffmpeg_3.1.4-1_armhf.deb
```
В этой сборке присутствуют оба кодека: libx264 и h264_omx

## Установка драйвера Yahka.

1. Ставим драйвер Yahka из **собственного источника** (https://github.com/kirovilya/ioBroker.yahka).
2. Добавляем экземпляр драйвера

## Обновляем драйвер Yahka.

1. Ставим драйвер Yahka из **собственного источника** (https://github.com/kirovilya/ioBroker.yahka).
2. Выполняем обновление файлов драйвера в базе (жмем кнопку рядом с драйвером либо в консоли iobroker upload yahka).

## Настройка драйвера:

1. Тут можно ничего не менять
2. Добавляем устройство:
Тут нужно задать название камеры и **ВАЖНО** выбрать категорию **Camera**.

3. Добавляем сервис:
**ВАЖНО** выбрать тип обслуживания **Camera** и в характеристиках указать **source** в параметрах адрес потока с камеры.
Примеры каналов:
http://stmv2.srvstm.com:1935/tvjsid/tvjsid/playlist.m3u8
rtsp://stmv2.srvstm.com:1935/tveespirita/tveespirita 
rtsp://stmv2.srvstm.com/mandruva/mandruva
rtsp://studiosystem.co.in:1935/v4news/livestream

4. Сохранить и закрыть. Драйвер должен успешно запуститься

## Подключение камеры в HomeKit

1. В приложении Дом нажимаем **Добавить аксессуар**

2. Жмем **Нет кода или не можете сканировать?** и далее выбираем доступные устройства 

3. В окне пароля вводим тот пароль, который указан в параметрах Хаба в драйвере Yahka (123-45-678 по-умолчанию)

4. И вуаля - камера добавлена