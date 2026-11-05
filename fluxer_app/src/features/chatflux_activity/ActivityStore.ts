// SPDX-License-Identifier: AGPL-3.0-or-later

import {ActivityApi, type GameActivity, type RecentGame} from '@app/features/chatflux_activity/ActivityApi';
import {shopBaseUrl} from '@app/features/chatflux_shop/ShopApi';
import {makeAutoObservable, runInAction} from 'mobx';
import {useEffect, useState} from 'react';

/** Safety net only: changes normally arrive right away over /activity/events. */
const POLL_MS = 30_000;
const POLL_LIVE_MS = 5 * 60_000;
const BATCH_DELAY_MS = 80;
const BATCH_SIZE = 100;

/** Activity is fetched per server, because people choose where they share it. */
const keyOf = (userId: string, guildId: string | null) => `${guildId ?? ''}|${userId}`;

class ActivityStore {
	activities = new Map<string, GameActivity>();

	private watchers = new Map<string, number>();
	private fetchedAt = new Map<string, number>();
	private queue = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private poller: ReturnType<typeof setInterval> | null = null;
	private events: EventSource | null = null;
	private eventsOpen = false;
	private lastPoll = 0;

	constructor() {
		makeAutoObservable<
			ActivityStore,
			'watchers' | 'fetchedAt' | 'queue' | 'timer' | 'poller' | 'events' | 'eventsOpen' | 'lastPoll'
		>(
			this,
			{
				watchers: false,
				fetchedAt: false,
				queue: false,
				timer: false,
				poller: false,
				events: false,
				eventsOpen: false,
				lastPoll: false,
			},
			{autoBind: true},
		);
	}

	/** Listens for "someone's game changed" pushes from the activity service. */
	private connectEvents(): void {
		if (this.events || typeof EventSource === 'undefined') return;
		try {
			const source = new EventSource(`${shopBaseUrl()}/activity/events`);
			source.onopen = () => {
				// We may have missed changes while disconnected.
				if (!this.eventsOpen) for (const key of this.watchers.keys()) this.enqueue(key);
				this.eventsOpen = true;
			};
			source.onerror = () => {
				// EventSource reconnects by itself; poll in the meantime.
				this.eventsOpen = false;
			};
			source.addEventListener('change', (event) => {
				try {
					const {id} = JSON.parse((event as MessageEvent<string>).data) as {id?: string};
					if (id) this.refreshUser(id);
				} catch {}
			});
			this.events = source;
		} catch {
			this.events = null;
		}
	}

	private disconnectEvents(): void {
		this.events?.close();
		this.events = null;
		this.eventsOpen = false;
	}

	get(userId: string, guildId: string | null): GameActivity | null {
		return this.activities.get(keyOf(userId, guildId)) ?? null;
	}

	/** Keeps the activity of `userId` fresh while something on screen shows it. Returns the unwatch function. */
	watch(userId: string, guildId: string | null): () => void {
		if (!/^\d+$/.test(userId)) return () => {};
		const key = keyOf(userId, guildId);
		this.watchers.set(key, (this.watchers.get(key) ?? 0) + 1);
		const fetched = this.fetchedAt.get(key);
		// While the event stream is open a cached result stays correct.
		if (fetched == null || (!this.eventsOpen && Date.now() - fetched > POLL_MS)) this.enqueue(key);
		this.connectEvents();
		this.poller ??= setInterval(this.poll, POLL_MS);
		return () => {
			const count = (this.watchers.get(key) ?? 1) - 1;
			if (count > 0) {
				this.watchers.set(key, count);
				return;
			}
			this.watchers.delete(key);
			// Nobody gets change events for it any more, so fetch it again next time.
			this.fetchedAt.delete(key);
			if (this.watchers.size === 0 && this.poller != null) {
				clearInterval(this.poller);
				this.poller = null;
				this.disconnectEvents();
			}
		};
	}

	/** Fetches a user again right away (e.g. after our own game changed). */
	refreshUser(userId: string): void {
		for (const key of this.watchers.keys()) {
			if (key.endsWith(`|${userId}`)) this.enqueue(key);
		}
	}

	private poll(): void {
		if (typeof document !== 'undefined' && document.hidden) return;
		if (this.eventsOpen && Date.now() - this.lastPoll < POLL_LIVE_MS) return;
		this.lastPoll = Date.now();
		for (const key of this.watchers.keys()) this.enqueue(key);
	}

	private enqueue(key: string): void {
		this.fetchedAt.set(key, Date.now());
		this.queue.add(key);
		this.timer ??= setTimeout(this.flush, BATCH_DELAY_MS);
	}

	private flush(): void {
		this.timer = null;
		const byGuild = new Map<string, Array<string>>();
		for (const key of this.queue) {
			const [guild, userId] = key.split('|');
			const list = byGuild.get(guild) ?? [];
			list.push(userId);
			byGuild.set(guild, list);
		}
		this.queue.clear();
		for (const [guild, ids] of byGuild) {
			for (let i = 0; i < ids.length; i += BATCH_SIZE) {
				const batch = ids.slice(i, i + BATCH_SIZE);
				ActivityApi.activities(batch, guild || null)
					.then(({users}) =>
						runInAction(() => {
							for (const id of batch) {
								const key = keyOf(id, guild || null);
								const next = users[id];
								const prev = this.activities.get(key);
								if (!next) {
									if (prev) this.activities.delete(key);
									continue;
								}
								if (prev && prev.id === next.id && prev.startedAt === next.startedAt && prev.icon === next.icon)
									continue;
								this.activities.set(key, next);
							}
						}),
					)
					.catch(() => {
						// The activity service is optional; try again on the next poll.
					});
			}
		}
	}
}

const store = new ActivityStore();
export default store;

/** The game `userId` is playing, as people in `guildId` (or in DMs) may see it. Use inside an observer. */
export function useGameActivity(userId: string | null | undefined, guildId?: string | null): GameActivity | null {
	const guild = guildId ?? null;
	useEffect(() => (userId ? store.watch(userId, guild) : undefined), [userId, guild]);
	return userId ? store.get(userId, guild) : null;
}

/** Games played in the last 30 days (empty while loading or when hidden). */
export function useRecentGames(userId: string | null | undefined, guildId?: string | null): Array<RecentGame> {
	const [recent, setRecent] = useState<Array<RecentGame>>([]);
	const guild = guildId ?? null;
	useEffect(() => {
		if (!userId) return;
		let alive = true;
		ActivityApi.recent(userId, guild)
			.then(({recent: list}) => {
				if (alive) setRecent(list);
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [userId, guild]);
	return recent;
}

/** Re-renders every `intervalMs` and returns the current time. */
export function useNow(intervalMs = 1000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}
