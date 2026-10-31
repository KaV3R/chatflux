// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	ShopApi,
	type ShopCatalog,
	type ShopItem,
	type ShopMe,
	type ShopSlot,
	type WornCosmetics,
} from '@app/features/chatflux_shop/ShopApi';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = {
	warn: (...args: Array<unknown>) => console.warn('[ChatFluxShop]', ...args),
	debug: (...args: Array<unknown>) => console.debug('[ChatFluxShop]', ...args),
};
const WORN_TTL_MS = 3 * 60 * 1000;
const BATCH_DELAY_MS = 60;
const BATCH_SIZE = 100;
const EMPTY: WornCosmetics = Object.freeze({}) as WornCosmetics;

class ShopStore {
	catalog: ShopCatalog | null = null;
	catalogState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	me: ShopMe | null = null;
	meState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	worn = new Map<string, WornCosmetics>();
	pendingSku: string | null = null;

	private fetchedAt = new Map<string, number>();
	private queue = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		makeAutoObservable<ShopStore, 'fetchedAt' | 'queue' | 'timer'>(
			this,
			{fetchedAt: false, queue: false, timer: false, getWorn: false, itemBySku: false},
			{autoBind: true},
		);
	}

	/** What a user is wearing. Safe to call during render: unknown users are fetched in batches. */
	getWorn(userId: string | null | undefined): WornCosmetics {
		if (!userId) return EMPTY;
		const fetched = this.fetchedAt.get(userId);
		if (fetched == null || Date.now() - fetched > WORN_TTL_MS) this.enqueue(userId);
		return this.worn.get(userId) ?? EMPTY;
	}

	itemBySku(sku: string): ShopItem | undefined {
		return this.catalog?.items.find((item) => item.sku === sku);
	}

	get items(): Array<ShopItem> {
		return (this.catalog?.items ?? []).filter((item) => !item.hidden);
	}

	owns(sku: string): boolean {
		const item = this.itemBySku(sku);
		const owned = this.me?.owned ?? [];
		if (item?.type === 'bundle') return (item.contains ?? []).every((s) => owned.includes(s));
		return owned.includes(sku);
	}

	isEquipped(item: ShopItem): boolean {
		if (item.type === 'bundle') return false;
		return this.me?.equipped[item.type] === item.sku;
	}

	/** Price the server will charge: bundles never cost more than the pieces still missing. */
	priceFor(item: ShopItem): number {
		if (item.type !== 'bundle' || !this.me) return item.price;
		const missing = (item.contains ?? []).filter((s) => !this.me!.owned.includes(s));
		const piecesPrice = missing.reduce((sum, s) => sum + (this.itemBySku(s)?.price ?? 0), 0);
		return Math.min(item.price, piecesPrice);
	}

	async loadCatalog(force = false): Promise<void> {
		if (!force && (this.catalogState === 'loading' || this.catalogState === 'ready')) return;
		this.catalogState = 'loading';
		try {
			const catalog = await ShopApi.catalog();
			runInAction(() => {
				this.catalog = catalog;
				this.catalogState = 'ready';
			});
		} catch (error) {
			logger.warn('catalog failed', error);
			runInAction(() => {
				this.catalogState = 'error';
			});
		}
	}

	async loadMe(): Promise<void> {
		this.meState = 'loading';
		try {
			const me = await ShopApi.me();
			runInAction(() => this.applyMe(me));
		} catch (error) {
			logger.warn('me failed', error);
			runInAction(() => {
				this.meState = 'error';
			});
		}
	}

	async purchase(sku: string): Promise<void> {
		this.pendingSku = sku;
		try {
			const me = await ShopApi.purchase(sku);
			runInAction(() => this.applyMe(me));
		} finally {
			runInAction(() => {
				this.pendingSku = null;
			});
		}
	}

	async equip(slot: ShopSlot, sku: string | null): Promise<void> {
		this.pendingSku = sku ?? `unequip:${slot}`;
		try {
			const me = await ShopApi.equip(slot, sku);
			runInAction(() => this.applyMe(me));
		} finally {
			runInAction(() => {
				this.pendingSku = null;
			});
		}
	}

	private applyMe(me: ShopMe): void {
		this.me = me;
		this.meState = 'ready';
		this.worn.set(me.userId, me.wearing ?? {});
		this.fetchedAt.set(me.userId, Date.now());
	}

	private enqueue(userId: string): void {
		if (!/^\d+$/.test(userId)) return;
		this.fetchedAt.set(userId, Date.now());
		this.queue.add(userId);
		if (this.timer == null) this.timer = setTimeout(this.flush, BATCH_DELAY_MS);
	}

	private flush(): void {
		this.timer = null;
		const ids = [...this.queue];
		this.queue.clear();
		for (let i = 0; i < ids.length; i += BATCH_SIZE) {
			const batch = ids.slice(i, i + BATCH_SIZE);
			ShopApi.cosmetics(batch)
				.then(({users}) =>
					runInAction(() => {
						for (const id of batch) {
							const next = users[id] ?? {};
							const prev = this.worn.get(id);
							if (prev == null && Object.keys(next).length === 0) continue;
							if (prev != null && JSON.stringify(prev) === JSON.stringify(next)) continue;
							this.worn.set(id, next);
						}
					}),
				)
				.catch((error) => {
					logger.debug('cosmetics failed', error);
					// Try again later instead of hammering a missing service.
					for (const id of batch) this.fetchedAt.set(id, Date.now());
				});
		}
	}
}

export default new ShopStore();
