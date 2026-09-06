if ('serviceWorker' in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        '/cpyc-race-tonight/sw.js?v=20260906e',
        { scope: '/cpyc-race-tonight/' }
      );
      await registration.update();
      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    } catch (error) {
      console.warn('Sailing planner update check failed', error);
    }
  });
}
