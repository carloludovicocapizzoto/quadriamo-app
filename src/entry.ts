// Parametri con cui è stata aperta l'app (?login=1, ?signup=1, …), letti una volta all'avvio: App li toglie
// subito dall'indirizzo, ma alcune schermate (es. il benvenuto) compaiono solo dopo il caricamento dei dati.
export const ENTRY = new URLSearchParams(window.location.search)
export const fromSiteAccount = ENTRY.get('login') === '1' || ENTRY.get('signup') === '1'
