// Настройки «Говоруна».
window.GOVORUN_CONFIG = {
  // Адрес Cloudflare Worker «Попугай-ритор» (папка worker/). Пусто — отзыв Попугая собирается на телефоне.
  PARROT_URL: 'https://govorun-parrot.govorun.workers.dev',
  // Сколько ждать ответа нейросети, мс. Дольше — показываем отзыв, собранный на телефоне.
  PARROT_TIMEOUT: 12000,
};
