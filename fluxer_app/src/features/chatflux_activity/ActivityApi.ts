// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux activity: the game someone is playing. The desktop app reports it to the ChatFlux
// service (https://<instance>/shop-api/activity...), every client reads it from there.

import {shopRequest} from '@app/features/chatflux_shop/ShopApi';

export interface GameActivity {
	id: string;
	name: string;
	startedAt: number;
	icon: string | null;
}

export interface RecentGame {
	id: string;
	name: string;
	icon: string | null;
	lastPlayed: number;
	playing?: boolean;
}

export interface KnownGame {
	id: string;
	name: string;
	exes: Array<string>;
}

export interface ActivitySettings {
	share: boolean;
	servers: 'all' | 'none';
	guilds: Record<string, boolean>;
}

export interface ActivitySettingsResponse {
	settings: ActivitySettings;
	recent: Array<RecentGame>;
}

export interface ReportedGame {
	id: string;
	name: string;
	startedAt: number;
	steamAppId?: number;
}

const guildQuery = (guildId: string | null | undefined) => (guildId ? `&guild=${guildId}` : '');

export const ActivityApi = {
	games: () => shopRequest<{games: Array<KnownGame>}>('GET', '/activity/games'),
	activities: (ids: Array<string>, guildId: string | null) =>
		shopRequest<{users: Record<string, GameActivity>}>('GET', `/activities?ids=${ids.join(',')}${guildQuery(guildId)}`),
	recent: (userId: string, guildId: string | null) =>
		shopRequest<{recent: Array<RecentGame>}>('GET', `/activity/recent?id=${userId}${guildQuery(guildId)}`),
	report: (game: ReportedGame | null) =>
		shopRequest<{ok: boolean; needIcon?: boolean; hidden?: boolean}>('POST', '/activity', {game}, true),
	uploadIcon: (id: string, png: string) => shopRequest<{ok: boolean}>('POST', '/activity/icon', {id, png}, true),
	settings: () => shopRequest<ActivitySettingsResponse>('GET', '/activity/settings', undefined, true),
	saveSettings: (body: Partial<Omit<ActivitySettings, 'guilds'>> & {guilds?: Record<string, boolean | null>}) =>
		shopRequest<ActivitySettingsResponse>('POST', '/activity/settings', body, true),
	clearRecent: () => shopRequest<ActivitySettingsResponse>('POST', '/activity/recent/clear', {}, true),
};
