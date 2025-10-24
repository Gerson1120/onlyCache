if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[App] Registro SW exitoso:', reg))
            .catch(err => console.error('[App] Error de registro SW:', err));
    });
} else {
    console.warn('[App] El navegador no soporta Service Workers.');
}
