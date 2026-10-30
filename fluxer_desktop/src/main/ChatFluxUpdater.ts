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
let promptedVersion: string | null = null;

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

async function askToRestart(manager: VelopackUpdateManager, update: UpdateInfo): Promise<void> {
	const version = update.TargetFullRelease.Version;
	if (promptedVersion === version) return;
	promptedVersion = version;
	const parent = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed() && window.isVisible());
	const options: Electron.MessageBoxOptions = {
		type: 'info',
		title: 'ChatFlux frissítés',
		message: `Új ChatFlux verzió érhető el (${version}).`,
		detail: 'A frissítés letöltődött. Újraindítod most? Ha később, a következő indításkor települ.',
		buttons: ['Újraindítás most', 'Később'],
		defaultId: 0,
		cancelId: 1,
		noLink: true,
	};
	const {response} = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
	if (response !== 0) return;
	try {
		manager.waitExitThenApplyUpdate(update, false, true);
		app.quit();
	} catch (error) {
		log.error('[ChatFluxUpdater] Failed to apply the update', error);
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
		log.info('[ChatFluxUpdater] Downloading update', {version: update.TargetFullRelease.Version});
		await manager.downloadUpdateAsync(update, () => {});
		log.info('[ChatFluxUpdater] Update downloaded', {version: update.TargetFullRelease.Version});
		await askToRestart(manager, update);
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
