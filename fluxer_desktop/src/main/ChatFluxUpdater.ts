// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: self-updates from GitHub Releases (KaV3R/chatflux) using Velopack.
// The release workflow uploads releases.win.json + the full .nupkg next to the installer, and
// GitHub's "latest/download" URL serves them as a Velopack HTTP feed.

import {createRequire} from 'node:module';
import {isPortableMode} from '@electron/common/UserDataPath';
import {app, BrowserWindow, dialog} from 'electron';
import log from 'electron-log';
import type {UpdateInfo} from 'velopack';

const requireModule = createRequire(import.meta.url);

const CHATFLUX_UPDATE_FEED_URL = 'https://github.com/KaV3R/chatflux/releases/latest/download';
const FIRST_CHECK_DELAY_MS = 15_000;
const CHECK_INTERVAL_MS = 2 * 60 * 60_000;

type VelopackUpdateManager = InstanceType<typeof import('velopack').UpdateManager>;

let started = false;
let checking = false;
let dismissedVersion: string | null = null;

function createManager(): VelopackUpdateManager | null {
	try {
		const {UpdateManager} = requireModule('velopack') as typeof import('velopack');
		const manager = new UpdateManager(CHATFLUX_UPDATE_FEED_URL);
		// Throws when the app was not installed by the Velopack setup (e.g. dev or portable runs).
		manager.getCurrentVersion();
		return manager;
	} catch (error) {
		log.info('[ChatFluxUpdater] Not a Velopack install, auto-update is off', error);
		return null;
	}
}

function mainWindow(): BrowserWindow | undefined {
	return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed() && window.isVisible());
}

async function showBox(options: Electron.MessageBoxOptions): Promise<number> {
	const parent = mainWindow();
	const {response} = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
	return response;
}

const PROGRESS_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#1e1f22;color:#f2f3f5;font-family:'Segoe UI',sans-serif;user-select:none}
body{display:flex;flex-direction:column;justify-content:center;padding:0 22px;box-sizing:border-box;-webkit-app-region:drag}
h1{font-size:15px;font-weight:600;margin:0 0 12px}
.bar{height:8px;border-radius:4px;background:#3a3c42;overflow:hidden}
.fill{height:100%;width:0;background:#5865f2;transition:width .2s}
p{font-size:12px;color:#b5bac1;margin:10px 0 0}
</style></head><body><h1>ChatFlux frissítés letöltése</h1><div class="bar"><div class="fill" id="f"></div></div><p id="t">Letöltés...</p></body></html>`;

function openProgressWindow(): BrowserWindow | null {
	try {
		const parent = mainWindow();
		const win = new BrowserWindow({
			width: 380,
			height: 130,
			parent,
			modal: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			frame: false,
			show: false,
			skipTaskbar: true,
			backgroundColor: '#1e1f22',
			webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false},
		});
		win.once('ready-to-show', () => win.show());
		void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(PROGRESS_PAGE)}`);
		return win;
	} catch (error) {
		log.warn('[ChatFluxUpdater] Could not open the progress window', error);
		return null;
	}
}

function setProgress(win: BrowserWindow | null, percent: number): void {
	const value = Math.max(0, Math.min(100, Math.round(percent)));
	mainWindow()?.setProgressBar(value / 100);
	if (!win || win.isDestroyed()) return;
	void win.webContents
		.executeJavaScript(
			`document.getElementById('f').style.width='${value}%';document.getElementById('t').textContent='Letöltés... ${value}%';`,
		)
		.catch(() => {});
}

async function offerUpdate(manager: VelopackUpdateManager, update: UpdateInfo): Promise<void> {
	const version = update.TargetFullRelease.Version;
	if (dismissedVersion === version) return;
	let current = '';
	try {
		current = manager.getCurrentVersion();
	} catch {}
	const answer = await showBox({
		type: 'info',
		title: 'ChatFlux frissítés',
		message: `Új verzió érhető el: ${version}${current ? ` (most: ${current})` : ''}.`,
		detail: 'Letöltöd és telepíted most? A ChatFlux a telepítés után magától újraindul.',
		buttons: ['Frissítés', 'Később'],
		defaultId: 0,
		cancelId: 1,
		noLink: true,
	});
	if (answer !== 0) {
		dismissedVersion = version;
		return;
	}

	const progressWindow = openProgressWindow();
	try {
		log.info('[ChatFluxUpdater] Downloading update', {version});
		await manager.downloadUpdateAsync(update, (percent: number) => setProgress(progressWindow, percent));
		setProgress(progressWindow, 100);
		log.info('[ChatFluxUpdater] Update downloaded, restarting', {version});
		manager.waitExitThenApplyUpdate(update, false, true);
		app.quit();
	} catch (error) {
		log.error('[ChatFluxUpdater] Update failed', error);
		await showBox({
			type: 'error',
			title: 'ChatFlux frissítés',
			message: 'Nem sikerült letölteni a frissítést.',
			detail: 'Próbáld újra később, vagy töltsd le kézzel a GitHubról.',
			buttons: ['OK'],
			noLink: true,
		});
	} finally {
		mainWindow()?.setProgressBar(-1);
		if (progressWindow && !progressWindow.isDestroyed()) progressWindow.destroy();
	}
}

async function checkOnce(manager: VelopackUpdateManager): Promise<void> {
	if (checking) return;
	checking = true;
	try {
		const update = await manager.checkForUpdatesAsync();
		if (update == null) {
			log.info('[ChatFluxUpdater] Up to date', {version: manager.getCurrentVersion()});
			return;
		}
		await offerUpdate(manager, update);
	} catch (error) {
		log.warn('[ChatFluxUpdater] Update check failed', error);
	} finally {
		checking = false;
	}
}

export function startChatFluxAutoUpdates(): void {
	if (started) return;
	started = true;
	if (process.platform !== 'win32' || !app.isPackaged || isPortableMode()) return;
	const manager = createManager();
	if (manager == null) return;
	const run = (): void => {
		void checkOnce(manager);
	};
	setTimeout(run, FIRST_CHECK_DELAY_MS).unref();
	setInterval(run, CHECK_INTERVAL_MS).unref();
}
