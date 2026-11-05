// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux desktop: looks at the running programs every few seconds, recognises games and
// reports the current one to the activity service. Only runs in the Windows desktop app.

import Authentication from '@app/features/auth/state/Authentication';
import {ActivityApi, type KnownGame, type ReportedGame} from '@app/features/chatflux_activity/ActivityApi';
import ActivityStore from '@app/features/chatflux_activity/ActivityStore';
import SessionManager from '@app/features/platform/state/AuthSession';
import {getElectronAPI} from '@app/features/ui/utils/NativeUtils';
import {makeAutoObservable, runInAction} from 'mobx';

const STORAGE_KEY = 'chatflux.games.v1';
const SCAN_MS = 15_000;
const BEAT_MS = 60_000;
const GAMES_REFRESH_MS = 60 * 60 * 1000;

/** A game this device has seen or the user added. `enabled: false` = never share it. */
export interface RegisteredGame {
	id: string;
	name: string;
	exe?: string;
	enabled: boolean;
	lastPlayed?: number;
	custom?: boolean;
}

export interface DetectedGame extends ReportedGame {
	pid?: number;
}

interface DesktopGameApi {
	chatfluxGameProcesses: () => Promise<Array<{pid: number; name: string}>>;
	chatfluxGameWindows: () => Promise<Array<{pid: number; name: string; title: string}>>;
	chatfluxSteamRunningApp: () => Promise<{appId: number; name: string | null} | null>;
	chatfluxProcessIcon: (pid: number) => Promise<string | null>;
}

function desktopApi(): DesktopGameApi | null {
	const api = getElectronAPI() as Partial<DesktopGameApi> | null;
	if (!api?.chatfluxGameProcesses || !api.chatfluxSteamRunningApp || !api.chatfluxProcessIcon) return null;
	return api as DesktopGameApi;
}

function readRegistered(): Record<string, RegisteredGame> {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Record<string, RegisteredGame>) : {};
	} catch {
		return {};
	}
}

class ActivityDetector {
	/** The game being played right now (also when it is not shared). */
	current: DetectedGame | null = null;
	registered: Record<string, RegisteredGame> = readRegistered();
	running = false;

	private knownGames: Array<KnownGame> = [];
	private knownGamesAt = 0;
	private lastReported: string | null = null;
	private iconsSent = new Set<string>();
	private scanning = false;

	constructor() {
		makeAutoObservable<ActivityDetector, 'knownGames' | 'knownGamesAt' | 'lastReported' | 'iconsSent' | 'scanning'>(
			this,
			{
				knownGames: false,
				knownGamesAt: false,
				lastReported: false,
				iconsSent: false,
				scanning: false,
			},
			{autoBind: true},
		);
	}

	get supported(): boolean {
		return desktopApi() != null;
	}

	get registeredList(): Array<RegisteredGame> {
		return Object.values(this.registered).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
	}

	start(): void {
		if (this.running || !desktopApi()) return;
		this.running = true;
		setInterval(this.scan, SCAN_MS);
		setInterval(this.beat, BEAT_MS);
		window.addEventListener('beforeunload', this.stopSharing);
		void this.scan();
	}

	setEnabled(id: string, enabled: boolean): void {
		const game = this.registered[id];
		if (!game) return;
		this.registered[id] = {...game, enabled};
		this.persist();
		void this.scan();
	}

	remove(id: string): void {
		delete this.registered[id];
		this.persist();
		void this.scan();
	}

	/** Adds a program the user picked from the running windows. */
	addCustom(exe: string, name: string): void {
		const cleanExe = exe.toLowerCase().trim();
		const cleanName = name.trim().slice(0, 80);
		if (!cleanExe || !cleanName) return;
		const known = this.knownGames.find((game) => game.exes.includes(cleanExe));
		const id = known?.id ?? `x:${cleanExe.replace(/[^a-z0-9._+!' -]/g, '').slice(0, 80)}`;
		this.registered[id] = {
			id,
			name: known?.name ?? cleanName,
			exe: cleanExe,
			enabled: true,
			custom: !known,
			lastPlayed: this.registered[id]?.lastPlayed,
		};
		this.persist();
		void this.scan();
	}

	/** Running programs with a window, for the "add a game" picker. */
	async listWindows(): Promise<Array<{pid: number; name: string; title: string}>> {
		const api = getElectronAPI() as Partial<DesktopGameApi> | null;
		if (!api?.chatfluxGameWindows) return [];
		try {
			return await api.chatfluxGameWindows();
		} catch {
			return [];
		}
	}

	private persist(): void {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.registered));
		} catch {}
	}

	private async loadKnownGames(): Promise<void> {
		if (Date.now() - this.knownGamesAt < GAMES_REFRESH_MS && this.knownGames.length > 0) return;
		try {
			const {games} = await ActivityApi.games();
			this.knownGames = games;
			this.knownGamesAt = Date.now();
		} catch {
			// Steam detection and user-added games still work without the list.
			this.knownGamesAt = Date.now() - GAMES_REFRESH_MS + 5 * 60 * 1000;
		}
	}

	private async detect(api: DesktopGameApi): Promise<DetectedGame | null> {
		await this.loadKnownGames();
		const processes = await api.chatfluxGameProcesses();
		const byExe = new Map<string, number>();
		for (const proc of processes) if (!byExe.has(proc.name)) byExe.set(proc.name, proc.pid);
		// Games the user added come first, then the shared game list.
		for (const game of Object.values(this.registered)) {
			if (!game.custom || !game.exe) continue;
			const pid = byExe.get(game.exe);
			if (pid != null) return {id: game.id, name: game.name, startedAt: Date.now(), pid};
		}
		for (const game of this.knownGames) {
			for (const exe of game.exes) {
				const pid = byExe.get(exe);
				if (pid != null) return {id: game.id, name: game.name, startedAt: Date.now(), pid};
			}
		}
		const steam = await api.chatfluxSteamRunningApp();
		if (steam?.appId) {
			return {id: `s:${steam.appId}`, name: steam.name || 'Steam', startedAt: Date.now(), steamAppId: steam.appId};
		}
		return null;
	}

	private async scan(): Promise<void> {
		const api = desktopApi();
		if (!api || this.scanning) return;
		this.scanning = true;
		try {
			const found = await this.detect(api);
			runInAction(() => {
				if (found && this.current?.id === found.id) {
					found.startedAt = this.current.startedAt;
				}
				this.current = found;
				if (found) {
					const prev = this.registered[found.id];
					this.registered[found.id] = {
						id: found.id,
						name: prev?.custom ? prev.name : found.name,
						exe: prev?.exe,
						custom: prev?.custom,
						enabled: prev?.enabled ?? true,
						lastPlayed: Date.now(),
					};
					this.persist();
				}
			});
			const shared = this.sharedGame();
			const signature = shared ? `${shared.id}|${shared.name}` : null;
			if (signature !== this.lastReported) await this.beat();
		} catch {
			// Try again on the next scan.
		} finally {
			this.scanning = false;
		}
	}

	/** The current game if the user shares it. */
	private sharedGame(): DetectedGame | null {
		const game = this.current;
		if (!game) return null;
		if (this.registered[game.id]?.enabled === false) return null;
		const name = this.registered[game.id]?.custom ? this.registered[game.id].name : game.name;
		return {...game, name};
	}

	private async beat(): Promise<void> {
		if (!SessionManager.token) return;
		const game = this.sharedGame();
		const signature = game ? `${game.id}|${game.name}` : null;
		if (game == null && this.lastReported == null) return;
		try {
			const result = await ActivityApi.report(
				game ? {id: game.id, name: game.name, startedAt: game.startedAt, steamAppId: game.steamAppId} : null,
			);
			this.lastReported = signature;
			const me = Authentication.currentUserId;
			if (me) ActivityStore.refreshUser(me);
			if (game && result.needIcon && game.pid != null && !this.iconsSent.has(game.id)) {
				this.iconsSent.add(game.id);
				const png = await desktopApi()?.chatfluxProcessIcon(game.pid);
				if (png) {
					await ActivityApi.uploadIcon(game.id, png);
					if (me) ActivityStore.refreshUser(me);
				}
			}
		} catch {
			// The service may be down; the next beat tries again.
		}
	}

	private stopSharing(): void {
		if (this.lastReported == null || !SessionManager.token) return;
		void ActivityApi.report(null).catch(() => {});
	}
}

export default new ActivityDetector();
