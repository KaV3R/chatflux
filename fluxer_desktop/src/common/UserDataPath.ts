// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import {BUILD_CHANNEL, type BuildChannel} from '@electron/common/BuildChannel';
import {app} from 'electron';

interface UserDataPaths {
	readonly channel: BuildChannel;
	readonly directoryName: string;
	readonly base: string;
	readonly portable: boolean;
}

type ChannelStorageDirectoryMap = Record<BuildChannel, string>;

// ChatFlux: own data folder (%APPDATA%\chatflux) instead of upstream's %APPDATA%\fluxer.
const channelStorageDirectoryMap: ChannelStorageDirectoryMap = {
	stable: 'chatflux',
	canary: 'chatfluxcanary',
	development: 'chatfluxdevelopment',
};

const legacyChannelStorageDirectoryMap: ChannelStorageDirectoryMap = {
	stable: 'fluxer',
	canary: 'fluxercanary',
	development: 'fluxerdevelopment',
};

// Not carried over: Chromium caches, lock files, per-install native probe caches and the app store
// health marker (a fresh folder must not report an earlier store as "regressed").
const LEGACY_MIGRATION_SKIP = new Set(
	[
		'Cache',
		'Code Cache',
		'GPUCache',
		'GrShaderCache',
		'ShaderCache',
		'DawnGraphiteCache',
		'DawnWebGPUCache',
		'GPUPersistentCache',
		'Crashpad',
		'modules',
		'logs',
		'lockfile',
		'SingletonLock',
		'SingletonCookie',
		'SingletonSocket',
		'native-module-probes-v1.json',
		'native-module-preflight-v2.json',
		'account-store-state-v1.json',
	].map((name) => name.toLowerCase()),
);

function migrateLegacyUserData(legacyBase: string, base: string): void {
	try {
		if (fs.existsSync(base) || !fs.existsSync(legacyBase)) return;
	} catch {
		return;
	}
	const pending = `${base}.migrating-${process.pid}`;
	try {
		fs.rmSync(pending, {recursive: true, force: true});
		fs.cpSync(legacyBase, pending, {
			recursive: true,
			errorOnExist: false,
			filter: (source) => {
				const relative = path.relative(legacyBase, source);
				if (relative === '') return true;
				const top = relative.split(path.sep)[0]!.toLowerCase();
				return !LEGACY_MIGRATION_SKIP.has(top);
			},
		});
		fs.renameSync(pending, base);
	} catch {
		try {
			fs.rmSync(pending, {recursive: true, force: true});
		} catch {}
	}
}

class UserDataPathConflictError extends Error {
	public constructor(configured: string, requested: string) {
		super(`userData is already configured at ${configured} and cannot be reconfigured to ${requested}`);
		this.name = 'UserDataPathConflictError';
	}
}

let portableMode = false;
let configuredPaths: UserDataPaths | null = null;

function getPortableBasePath(): string {
	let appDir: string;
	if (process.platform === 'darwin') {
		const match = process.execPath.match(/^(.+?)\.app\//);
		appDir = match ? path.dirname(`${match[1]}.app`) : path.dirname(process.execPath);
	} else if (process.env.APPIMAGE) {
		appDir = path.dirname(process.env.APPIMAGE);
	} else {
		appDir = path.dirname(process.execPath);
	}
	return path.join(appDir, 'data');
}

function detectPortableMode(): boolean {
	if (process.argv.includes('--fluxer-portable')) return true;
	const envValue = process.env.FLUXER_PORTABLE;
	if (envValue && ['1', 'true', 'yes', 'on'].includes(envValue.trim().toLowerCase())) return true;
	const markerLocations = [path.join(path.dirname(process.execPath), '.portable')];
	if (process.platform === 'darwin') {
		const match = process.execPath.match(/^(.+?)\.app\//);
		if (match) {
			markerLocations.push(path.join(path.dirname(`${match[1]}.app`), '.portable'));
		}
	}
	if (process.env.APPIMAGE) {
		markerLocations.push(path.join(path.dirname(process.env.APPIMAGE), '.portable'));
	}
	return markerLocations.some((location) => {
		try {
			return fs.existsSync(location);
		} catch {
			return false;
		}
	});
}

function resolveUserDataPaths(channel: BuildChannel): {
	directoryName: string;
	base: string;
	portable: boolean;
} {
	const directoryName = channelStorageDirectoryMap[channel];
	const portable = detectPortableMode();
	if (portable) {
		const base = path.join(getPortableBasePath(), directoryName);
		return {directoryName, base, portable};
	}
	const appDataPath = app.getPath('appData');
	const base = path.join(appDataPath, directoryName);
	return {directoryName, base, portable};
}

export function isPortableMode(): boolean {
	return portableMode;
}

export function configureUserDataPath(): UserDataPaths {
	const channel = BUILD_CHANNEL;
	const {directoryName, base, portable} = resolveUserDataPaths(channel);
	if (configuredPaths != null) {
		if (configuredPaths.base !== base) {
			throw new UserDataPathConflictError(configuredPaths.base, base);
		}
		return configuredPaths;
	}
	portableMode = portable;
	migrateLegacyUserData(path.join(path.dirname(base), legacyChannelStorageDirectoryMap[channel]), base);
	if (portable) {
		fs.mkdirSync(base, {recursive: true});
	}
	app.setPath('userData', base);
	if (portable) {
		try {
			app.setPath('sessionData', path.join(base, 'session'));
			fs.mkdirSync(path.join(base, 'session'), {recursive: true});
		} catch {}
		try {
			const logsPath = path.join(base, 'logs');
			app.setPath('logs', logsPath);
			fs.mkdirSync(logsPath, {recursive: true});
		} catch {}
		try {
			const crashDumpsPath = path.join(base, 'crash-dumps');
			app.setPath('crashDumps', crashDumpsPath);
			fs.mkdirSync(crashDumpsPath, {recursive: true});
		} catch {}
	}
	configuredPaths = {
		channel,
		directoryName,
		base,
		portable,
	};
	return configuredPaths;
}
