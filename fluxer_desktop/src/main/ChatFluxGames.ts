// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: finds the game the user is playing (Windows and Linux).
// The renderer asks for the running process names, matches them against the game list and
// reports the match to the ChatFlux activity service. Nothing here leaves the machine by itself.

import {execFile} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {requirePrivilegedRendererDocumentSender} from '@electron/main/PrivilegedRendererDocuments';
import {app, ipcMain, nativeImage} from 'electron';

const CHANNELS = {
	processes: 'chatflux-games:processes',
	windows: 'chatflux-games:windows',
	steam: 'chatflux-games:steam',
	icon: 'chatflux-games:icon',
} as const;

export interface ChatFluxRunningProcess {
	pid: number;
	name: string;
}

export interface ChatFluxWindowProcess extends ChatFluxRunningProcess {
	title: string;
}

function run(command: string, args: Array<string>, timeout = 10_000): Promise<string> {
	return new Promise((resolve) => {
		execFile(command, args, {windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024}, (error, stdout) => {
			resolve(error ? '' : String(stdout));
		});
	});
}

function parseCsvLine(line: string): Array<string> {
	const cells: Array<string> = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			cells.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	cells.push(current);
	return cells;
}

// ---- Linux: /proc instead of tasklist, Steam's registry.vdf instead of the registry ----

/** Program name of a Linux process. Proton/Wine games show up with their Windows .exe name. */
function linuxProcessName(pid: string): string | null {
	try {
		const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
		const argv0 = cmdline.split('\0')[0] ?? '';
		const base = argv0.split(/[\\/]/).pop()?.trim().toLowerCase();
		if (base) return base;
		return readFileSync(`/proc/${pid}/comm`, 'utf8').trim().toLowerCase() || null;
	} catch {
		return null;
	}
}

function listLinuxProcesses(onlyMine: boolean): Array<ChatFluxRunningProcess> {
	const uid = process.getuid?.() ?? -1;
	const result: Array<ChatFluxRunningProcess> = [];
	let entries: Array<string> = [];
	try {
		entries = readdirSync('/proc');
	} catch {
		return result;
	}
	for (const entry of entries) {
		if (!/^\d+$/.test(entry)) continue;
		if (onlyMine) {
			try {
				if (statSync(`/proc/${entry}`).uid !== uid) continue;
			} catch {
				continue;
			}
		}
		const name = linuxProcessName(entry);
		if (!name) continue;
		const pid = Number(entry);
		result.push({pid, name});
		// The game list uses Windows names; let native Linux builds (e.g. "cs2") match "cs2.exe" too.
		if (!name.endsWith('.exe')) result.push({pid, name: `${name}.exe`});
	}
	return result;
}

/** Programs of the current user, for the "add a game" picker (Linux has no portable window list). */
function listLinuxWindowProcesses(): Array<ChatFluxWindowProcess> {
	const seen = new Set<string>();
	const result: Array<ChatFluxWindowProcess> = [];
	for (const proc of listLinuxProcesses(true)) {
		if (seen.has(proc.name)) continue;
		// Skip the ".exe" aliases of native programs, they are not real names.
		if (proc.name.endsWith('.exe') && seen.has(proc.name.slice(0, -4))) continue;
		seen.add(proc.name);
		result.push({...proc, title: ''});
	}
	return result.sort((a, b) => a.name.localeCompare(b.name));
}

function linuxSteamRunningApp(): {appId: number; name: string | null} | null {
	const home = os.homedir();
	const candidates = [
		path.join(home, '.steam', 'registry.vdf'),
		path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.steam', 'registry.vdf'),
	];
	for (const file of candidates) {
		let text: string;
		try {
			text = readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		const appId = Number.parseInt(/"RunningAppID"\s+"(\d+)"/i.exec(text)?.[1] ?? '', 10);
		if (!appId) continue;
		const block = new RegExp(`"${appId}"\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? '';
		const name = /"name"\s+"([^"]+)"/i.exec(block)?.[1] ?? null;
		return {appId, name};
	}
	return null;
}

/** Every running process (name + pid). Cheap enough to call every few seconds. */
async function listProcesses(): Promise<Array<ChatFluxRunningProcess>> {
	if (process.platform === 'linux') return listLinuxProcesses(false);
	if (process.platform !== 'win32') return [];
	const out = await run('tasklist', ['/fo', 'csv', '/nh']);
	const processes: Array<ChatFluxRunningProcess> = [];
	for (const line of out.split(/\r?\n/)) {
		if (!line.startsWith('"')) continue;
		const [name, pidRaw] = parseCsvLine(line);
		const pid = Number.parseInt(pidRaw ?? '', 10);
		if (name && Number.isFinite(pid)) processes.push({pid, name: name.toLowerCase()});
	}
	return processes;
}

/** Processes that have a visible window, for the "add a game" picker. */
async function listWindowProcesses(): Promise<Array<ChatFluxWindowProcess>> {
	if (process.platform === 'linux') return listLinuxWindowProcesses();
	if (process.platform !== 'win32') return [];
	const script =
		'[Console]::OutputEncoding=[Text.Encoding]::UTF8;' +
		"Get-Process | Where-Object {$_.MainWindowTitle -and $_.Id -ne $PID} | ForEach-Object { '{0}|{1}|{2}' -f $_.Id, $_.ProcessName, $_.MainWindowTitle }";
	const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 15_000);
	const result: Array<ChatFluxWindowProcess> = [];
	for (const line of out.split(/\r?\n/)) {
		const [pidRaw, name, ...titleParts] = line.split('|');
		const pid = Number.parseInt(pidRaw ?? '', 10);
		if (!Number.isFinite(pid) || !name) continue;
		result.push({pid, name: `${name.toLowerCase()}.exe`, title: titleParts.join('|').trim()});
	}
	return result;
}

/** The Steam game running right now, read from the registry Steam keeps up to date. */
async function steamRunningApp(): Promise<{appId: number; name: string | null} | null> {
	if (process.platform === 'linux') return linuxSteamRunningApp();
	if (process.platform !== 'win32') return null;
	const out = await run('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID']);
	const match = /RunningAppID\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(out);
	const appId = match ? Number.parseInt(match[1], 16) : 0;
	if (!appId) return null;
	const nameOut = await run('reg', ['query', `HKCU\\Software\\Valve\\Steam\\Apps\\${appId}`, '/v', 'Name']);
	const name = /Name\s+REG_SZ\s+(.+)/i.exec(nameOut)?.[1]?.trim() ?? null;
	return {appId, name};
}

/** The icon of a running program as a base64 PNG (up to 128px), or null. */
async function processIcon(pid: number): Promise<string | null> {
	if (process.platform !== 'win32' || !Number.isInteger(pid) || pid <= 0) return null;
	const out = await run('powershell.exe', [
		'-NoProfile',
		'-NonInteractive',
		'-Command',
		`[Console]::OutputEncoding=[Text.Encoding]::UTF8;(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path`,
	]);
	const exePath = out.trim();
	if (!/\.exe$/i.test(exePath)) return null;
	try {
		const image = await nativeImage.createThumbnailFromPath(exePath, {width: 128, height: 128});
		if (!image.isEmpty()) return image.toPNG().toString('base64');
	} catch {}
	try {
		const image = await app.getFileIcon(exePath, {size: 'large'});
		if (!image.isEmpty()) return image.toPNG().toString('base64');
	} catch {}
	return null;
}

export function registerChatFluxGameIpc(): void {
	ipcMain.handle(CHANNELS.processes, (event) => {
		requirePrivilegedRendererDocumentSender(event, CHANNELS.processes);
		return listProcesses();
	});
	ipcMain.handle(CHANNELS.windows, (event) => {
		requirePrivilegedRendererDocumentSender(event, CHANNELS.windows);
		return listWindowProcesses();
	});
	ipcMain.handle(CHANNELS.steam, (event) => {
		requirePrivilegedRendererDocumentSender(event, CHANNELS.steam);
		return steamRunningApp();
	});
	ipcMain.handle(CHANNELS.icon, (event, pid: unknown) => {
		requirePrivilegedRendererDocumentSender(event, CHANNELS.icon);
		return processIcon(typeof pid === 'number' ? pid : Number.NaN);
	});
}
