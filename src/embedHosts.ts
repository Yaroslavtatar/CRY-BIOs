/** Зависимостей нет: файл подключается и клиентом, и сервером (CSP).
 */
// ВАЖНО: BioPage рендерит эти эмбеды в iframe с sandbox="allow-scripts allow-same-origin". Это безопасно, пока
// в списке только ЧУЖИЕ домены. Если сюда попадёт свой origin (или его поддомен), песочница перестанет защищать:
// страница в iframe сможет снять sandbox и получить доступ к данным основного сайта. Свои домены сюда не добавлять.
// Список синхронизирован с `frame-src` в CSP (server.ts, через EMBED_HOSTS).
export const EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'player.vimeo.com',
];
