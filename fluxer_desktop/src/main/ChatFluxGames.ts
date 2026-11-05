// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: finds the game the user is playing (Windows only).
// The renderer asks for the running process names, matches them against the game list and
// reports the match to the ChatFlux activity service. Nothing here leaves the machine by itself.

import {execFile} from 'node:child_process';
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

/** Every running process (name + pid). Cheap enough to call every few seconds. */
async function listProcesses(): Promise<Array<ChatFluxRunningProcess>> {
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
