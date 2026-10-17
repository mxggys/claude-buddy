// Automatische Updates aus den GitHub-Releases des privaten Repos.
// Der Lese-Schlüssel (Token) liegt nur in den Einstellungen auf deinem PC, nie im Code.
const { app, net } = require('electron');

const REPO = { owner: 'clavicular-alt', repo: 'claude-buddy' };
const CHECK_EVERY = 4 * 60 * 60 * 1000;

// Prüft den Schlüssel direkt bei GitHub: gültig? Wann läuft er ab?
// GitHub schickt das Ablaufdatum im Kopf „github-authentication-token-expiration“ mit.
async function checkToken(token) {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Claude-Buddy' },
    });
    if (res.status === 401) return { problem: 'expired' };
    if (res.status === 403 || res.status === 404) return { problem: 'noaccess' };
    const exp = res.headers.get('github-authentication-token-expiration');
    const expiresAt = exp ? new Date(exp.replace(' ', 'T').replace(' ', '')) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
      const days = (expiresAt - Date.now()) / 86400000;
      if (days <= 7) return { problem: 'soon', expiresAt };
    }
    return { problem: null, expiresAt };
  } catch {
    return { problem: null }; // offline: nichts melden
  }
}

function setupUpdater({ getToken, onStatus, log }) {
  let autoUpdater = null;
  let status = { text: 'Noch nicht geprüft', ready: false, token: null };
  let tokenState = { problem: null };
  const report = (text, extra = {}) => {
    status = { text, ready: false, token: tokenState, ...extra };
    onStatus(status);
    log('update', text);
  };

  function load() {
    if (autoUpdater) return autoUpdater;
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = { info() {}, warn: (m) => log('update', m), error: (m) => log('update', m), debug() {} };
    autoUpdater.on('checking-for-update', () => report('Suche nach Updates …'));
    autoUpdater.on('update-not-available', () => report(`Du hast die neueste Version (${app.getVersion()}).`));
    autoUpdater.on('update-available', (info) => report(`Version ${info.version} wird geladen …`));
    autoUpdater.on('download-progress', (p) => report(`Lade Update … ${Math.round(p.percent)} %`));
    autoUpdater.on('update-downloaded', (info) => report(`Version ${info.version} ist bereit.`, { ready: true }));
    autoUpdater.on('error', (err) => {
      const msg = String(err && err.message || err);
      if (/401|403|Bad credentials/i.test(msg)) { tokenState = { problem: 'expired' }; report('Update-Schlüssel abgelaufen oder ungültig.'); }
      else if (/404|No published versions/i.test(msg)) report('Noch keine Version veröffentlicht.');
      else report('Update fehlgeschlagen. Details im Fehler-Log.');
      log('update fehler', msg);
    });
    return autoUpdater;
  }

  async function check() {
    const token = (getToken() || '').trim();
    if (!token) { tokenState = { problem: 'missing' }; return report('Kein Update-Schlüssel eingetragen.'); }
    tokenState = await checkToken(token);
    if (tokenState.problem === 'expired') return report('Update-Schlüssel abgelaufen oder ungültig.');
    if (tokenState.problem === 'noaccess') return report('Update-Schlüssel hat keinen Zugriff auf claude-buddy.');
    if (!app.isPackaged) return report('Updates gehen nur in der installierten App.');
    const updater = load();
    updater.setFeedURL({ provider: 'github', ...REPO, private: true, token });
    updater.checkForUpdates().catch(() => { /* wird über das error-Ereignis gemeldet */ });
  }

  setTimeout(check, 15000);
  setInterval(check, CHECK_EVERY);

  return {
    check,
    status: () => status,
    installNow: () => { if (autoUpdater && status.ready) autoUpdater.quitAndInstall(true, true); },
  };
}

module.exports = { setupUpdater };
