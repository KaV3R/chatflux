// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux Shop: talks to the small shop service that runs next to the Fluxer server
// (https://<instance>/shop-api). The service stores owned / equipped profile cosmetics.

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import SessionManager from '@app/features/platform/state/AuthSession';
import {i18n} from '@lingui/core';

export type ShopSlot = 'decoration' | 'nameplate' | 'effect' | 'frame';
export type ShopItemType = ShopSlot | 'bundle';
export type LocalizedText = string | {hu?: string; en?: string};

export interface ShopRender {
	asset?: string;
	top?: string;
	bottom?: string;
	color?: string;
	align?: 'top' | 'center' | 'bottom';
}

export interface ShopItem {
	sku: string;
	type: ShopItemType;
	collection?: string;
	name: LocalizedText;
	description?: LocalizedText;
	price: number;
	featured?: boolean;
	hidden?: boolean;
	badge?: LocalizedText;
	tags?: Array<string>;
	contains?: Array<string>;
	render?: ShopRender;
}

export interface ShopCollection {
	id: string;
	name: LocalizedText;
	tagline?: LocalizedText;
	description?: LocalizedText;
	banner?: string;
	accent?: string;
	featured?: boolean;
}

export interface ShopCatalog {
	currency?: LocalizedText;
	collections: Array<ShopCollection>;
	items: Array<ShopItem>;
}

export type WornCosmetic = ShopRender & {sku: string};
export type WornCosmetics = Partial<Record<ShopSlot, WornCosmetic>>;

export interface ShopMe {
	userId: string;
	balance: number;
	owned: Array<string>;
	equipped: Partial<Record<ShopSlot, string>>;
	wearing: WornCosmetics;
}

export class ShopApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
	) {
		super(`shop ${status} ${code}`);
	}
}

export function isHungarian(): boolean {
	return (i18n.locale || '').toLowerCase().startsWith('hu');
}

/** Small two-language helper so the shop needs no entries in the translation catalogs. */
export function tr(hu: string, en: string): string {
	return isHungarian() ? hu : en;
}

export function localize(text: LocalizedText | undefined): string {
	if (text == null) return '';
	if (typeof text === 'string') return text;
	return (isHungarian() ? (text.hu ?? text.en) : (text.en ?? text.hu)) ?? '';
}

export function shopBaseUrl(): string {
	try {
		return `${new URL(RuntimeConfig.apiEndpoint).origin}/shop-api`;
	} catch {
		return '/shop-api';
	}
}

export function shopAssetUrl(path: string | undefined | null): string | null {
	if (!path) return null;
	if (/^https?:\/\//.test(path)) return path;
	return `${shopBaseUrl()}/${path.replace(/^\/+/, '')}`;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, auth = false): Promise<T> {
	const headers: Record<string, string> = {};
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (auth) {
		const token = SessionManager.token;
		if (!token) throw new ShopApiError(401, 'unauthorized');
		headers.Authorization = token;
	}
	const res = await fetch(`${shopBaseUrl()}${path}`, {
		method,
		headers,
		credentials: 'omit',
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	let json: unknown = null;
	try {
		json = await res.json();
	} catch {}
	if (!res.ok) {
		const code = (json as {error?: string} | null)?.error ?? 'error';
		throw new ShopApiError(res.status, code);
	}
	// Not JSON (e.g. the web app's index.html when /shop-api is not routed yet).
	if (json == null || typeof json !== 'object') throw new ShopApiError(res.status, 'bad_response');
	return json as T;
}

export const ShopApi = {
	catalog: () => request<ShopCatalog>('GET', '/catalog'),
	me: () => request<ShopMe>('GET', '/me', undefined, true),
	purchase: (sku: string) => request<ShopMe>('POST', '/purchase', {sku}, true),
	equip: (slot: ShopSlot, sku: string | null) => request<ShopMe>('POST', '/equip', {slot, sku}, true),
	cosmetics: (ids: Array<string>) =>
		request<{users: Record<string, WornCosmetics>}>('GET', `/cosmetics?ids=${ids.join(',')}`),
};
