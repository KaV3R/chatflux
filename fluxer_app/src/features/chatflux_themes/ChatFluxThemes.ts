// SPDX-License-Identifier: AGPL-3.0-or-later

import AccountThemeMode from '@app/features/theme/state/AccountThemeMode';
import ThemeLibrary from '@app/features/theme/state/ThemeLibrary';
import {makeAutoObservable} from 'mobx';

interface ChatFluxThemePalette {
	frame: string;
	sidebar: string;
	surface: string;
	surfaceAlt: string;
	elevated: string;
	input: string;
	header: string;
	headerHover: string;
	guildItem: string;
	brand: string;
	brandSecondary: string;
	brandLight: string;
	link: string;
	text: string;
	textSecondary: string;
	textMuted: string;
	textFaint: string;
	tint: string;
}

export interface ChatFluxThemeDefinition {
	id: string;
	fileName: string;
	name: {hu: string; en: string};
	description: {hu: string; en: string};
	badge?: {hu: string; en: string};
	emoji: string;
	palette: ChatFluxThemePalette;
	css: string;
}

function withAlpha(hex: string, alpha: number): string {
	const value = Number.parseInt(hex.slice(1), 16);
	return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function buildThemeCss(name: string, description: string, tags: string, p: ChatFluxThemePalette, extra = ''): string {
	return `/**
 * @name ${name}
 * @description ${description}
 * @author ChatFlux
 * @version 1.0.0
 * @tags ${tags}
 */

html:root {
	color-scheme: dark;
	--background-primary: ${p.frame};
	--bg-primary: ${p.frame};
	--bg-table-row-odd: ${p.frame};
	--background-secondary: ${p.sidebar};
	--bg-secondary: ${p.sidebar};
	--bg-table-row-even: ${p.sidebar};
	--guild-badge-surface: ${p.sidebar};
	--background-secondary-lighter: ${p.surface};
	--background-secondary-alt: ${p.surfaceAlt};
	--bg-blockquote: ${p.surfaceAlt};
	--background-tertiary: ${p.elevated};
	--bg-tertiary: ${p.elevated};
	--bg-table-header: ${p.elevated};
	--background-textarea: ${p.input};
	--background-channel-header: ${p.header};
	--background-header-primary: ${p.header};
	--background-header-secondary: ${p.header};
	--background-header-primary-hover: ${p.headerHover};
	--guild-list-foreground: ${p.guildItem};
	--guilds-layout-item-bg: ${p.guildItem};
	--panel-control-bg: ${p.surfaceAlt};
	--panel-control-border: ${withAlpha(p.tint, 0.4)};
	--panel-control-divider: ${withAlpha(p.tint, 0.3)};
	--background-modifier-hover: ${withAlpha(p.tint, 0.07)};
	--bg-hover: ${withAlpha(p.tint, 0.07)};
	--surface-interactive-hover-bg: ${withAlpha(p.tint, 0.07)};
	--background-modifier-selected: ${withAlpha(p.tint, 0.14)};
	--bg-active: ${withAlpha(p.tint, 0.14)};
	--surface-interactive-selected-bg: ${withAlpha(p.tint, 0.14)};
	--surface-interactive-selected-color: ${p.text};
	--background-modifier-accent: ${withAlpha(p.tint, 0.18)};
	--background-modifier-accent-focus: ${withAlpha(p.tint, 0.28)};
	--border-color: ${withAlpha(p.tint, 0.2)};
	--border-color-hover: ${withAlpha(p.tint, 0.32)};
	--border-color-focus: ${withAlpha(p.brandLight, 0.5)};
	--brand-primary: ${p.brand};
	--accent-primary: ${p.brand};
	--brand-secondary: ${p.brandSecondary};
	--brand-primary-light: ${p.brandLight};
	--brand-primary-foreground: ${p.link};
	--brand-primary-pressed: color-mix(in srgb, ${p.brand} 88%, black);
	--text-link: ${p.link};
	--text-selection: ${withAlpha(p.brand, 0.35)};
	--text-primary: ${p.text};
	--text-secondary: ${p.textSecondary};
	--text-chat: ${p.textSecondary};
	--text-primary-muted: ${p.textMuted};
	--text-chat-muted: ${p.textMuted};
	--text-tertiary: ${p.textFaint};
	--text-tertiary-secondary: ${p.textFaint};
	--text-tertiary-muted: color-mix(in srgb, ${p.textFaint} 85%, ${p.frame});
	--scrollbar-thumb-bg: ${withAlpha(p.tint, 0.4)};
	--scrollbar-thumb-bg-hover: ${withAlpha(p.tint, 0.65)};
}

::selection {
	background: ${withAlpha(p.brand, 0.35)};
}
${extra}`;
}

const HALLOWEEN_PALETTE: ChatFluxThemePalette = {
	frame: '#0d0912',
	sidebar: '#16101d',
	surface: '#1b1424',
	surfaceAlt: '#1f1729',
	elevated: '#281c33',
	input: '#221830',
	header: '#1a1322',
	headerHover: '#2c2038',
	guildItem: '#241a2e',
	brand: '#ea6a12',
	brandSecondary: '#c2410c',
	brandLight: '#fdba74',
	link: '#fb923c',
	text: '#f7f0ff',
	textSecondary: '#ece2f8',
	textMuted: '#c9b8de',
	textFaint: '#a690bf',
	tint: '#a855f7',
};

const MOONLIGHT_PALETTE: ChatFluxThemePalette = {
	frame: '#060b18',
	sidebar: '#0c1426',
	surface: '#0f182d',
	surfaceAlt: '#121c33',
	elevated: '#18243f',
	input: '#131e37',
	header: '#0f1830',
	headerHover: '#1c2a49',
	guildItem: '#152039',
	brand: '#3b82f6',
	brandSecondary: '#2563eb',
	brandLight: '#bfdbfe',
	link: '#93c5fd',
	text: '#eef4ff',
	textSecondary: '#dfe8fb',
	textMuted: '#b4c3de',
	textFaint: '#8ea2c4',
	tint: '#93c5fd',
};

const SAKURA_PALETTE: ChatFluxThemePalette = {
	frame: '#120a10',
	sidebar: '#1c1119',
	surface: '#21141e',
	surfaceAlt: '#261823',
	elevated: '#301e2c',
	input: '#2a1a26',
	header: '#20131c',
	headerHover: '#36222f',
	guildItem: '#2b1b27',
	brand: '#db2777',
	brandSecondary: '#be185d',
	brandLight: '#fbcfe8',
	link: '#f9a8d4',
	text: '#fff2f8',
	textSecondary: '#f8e3ed',
	textMuted: '#dcbccb',
	textFaint: '#b997a9',
	tint: '#f472b6',
};

export const CHATFLUX_THEMES: ReadonlyArray<ChatFluxThemeDefinition> = [
	{
		id: 'chatflux-theme-halloween-2026',
		fileName: 'chatflux-halloween-2026.css',
		name: {hu: 'Tökfényes éjszaka', en: 'Pumpkin Night'},
		description: {
			hu: 'Halloween 2026: éjlila sötétség és töknarancs fények.',
			en: 'Halloween 2026: midnight purple darkness with pumpkin-orange glow.',
		},
		badge: {hu: 'HALLOWEEN 2026', en: 'HALLOWEEN 2026'},
		emoji: '🎃',
		palette: HALLOWEEN_PALETTE,
		css: buildThemeCss(
			'Pumpkin Night',
			'Halloween 2026 – midnight purple and pumpkin orange.',
			'chatflux, halloween, dark',
			HALLOWEEN_PALETTE,
		),
	},
	{
		id: 'chatflux-theme-moonlight',
		fileName: 'chatflux-moonlight.css',
		name: {hu: 'Holdfényes CatFlux', en: 'CatFlux Moonlight'},
		description: {
			hu: 'Mélykék éjszakai égbolt ezüstös holdfénnyel, a CatFlux bannerhez illik.',
			en: 'Deep blue night sky with silver moonlight, matching the CatFlux banner.',
		},
		emoji: '🌙',
		palette: MOONLIGHT_PALETTE,
		css: buildThemeCss(
			'CatFlux Moonlight',
			'Deep blue night sky with silver moonlight.',
			'chatflux, blue, dark',
			MOONLIGHT_PALETTE,
		),
	},
	{
		id: 'chatflux-theme-sakura',
		fileName: 'chatflux-sakura.css',
		name: {hu: 'Sakura éj', en: 'Sakura Night'},
		description: {
			hu: 'Sötét szilvaszín háttér és cseresznyevirág-rózsaszín kiemelések.',
			en: 'Dark plum background with cherry-blossom pink accents.',
		},
		emoji: '🌸',
		palette: SAKURA_PALETTE,
		css: buildThemeCss(
			'Sakura Night',
			'Dark plum background with cherry-blossom pink accents.',
			'chatflux, pink, dark',
			SAKURA_PALETTE,
		),
	},
];

const CHATFLUX_THEME_IDS: ReadonlySet<string> = new Set(CHATFLUX_THEMES.map((theme) => theme.id));

export function getActiveChatFluxThemeId(): string | null {
	const enabled = ThemeLibrary.enabledIdsFor(AccountThemeMode.activeTarget);
	for (let index = enabled.length - 1; index >= 0; index--) {
		if (CHATFLUX_THEME_IDS.has(enabled[index])) return enabled[index];
	}
	return null;
}

async function disableOtherChatFluxThemes(keepId: string | null): Promise<void> {
	const target = AccountThemeMode.activeTarget;
	for (const id of ThemeLibrary.enabledIdsFor(target)) {
		if (id !== keepId && CHATFLUX_THEME_IDS.has(id)) {
			await ThemeLibrary.setThemeEnabled(id, false, target);
		}
	}
}

export async function applyChatFluxTheme(theme: ChatFluxThemeDefinition): Promise<void> {
	await ThemeLibrary.init();
	const existing = ThemeLibrary.themes.find((item) => item.id === theme.id);
	if (!existing || existing.css !== theme.css) {
		await ThemeLibrary.saveTheme(
			ThemeLibrary.createThemeFromCss(theme.css, theme.fileName, 'import', {
				id: theme.id,
				createdAt: existing?.createdAt,
			}),
		);
	}
	await disableOtherChatFluxThemes(theme.id);
	await ThemeLibrary.setThemeEnabled(theme.id, true, AccountThemeMode.activeTarget);
}

export async function resetChatFluxTheme(): Promise<void> {
	await ThemeLibrary.init();
	await disableOtherChatFluxThemes(null);
}

export type ChatFluxExploreSection = 'communities' | 'themes';

class ChatFluxExploreState {
	section: ChatFluxExploreSection = 'communities';

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	setSection(section: ChatFluxExploreSection): void {
		this.section = section;
	}
}

export const ChatFluxExplore = new ChatFluxExploreState();
