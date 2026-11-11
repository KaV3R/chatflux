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

const NEON_PALETTE: ChatFluxThemePalette = {
	frame: '#05010d',
	sidebar: '#0b0418',
	surface: '#0e0620',
	surfaceAlt: '#130828',
	elevated: '#1c0c38',
	input: '#160a2e',
	header: '#10062a',
	headerHover: '#261048',
	guildItem: '#1a0b33',
	brand: '#ff2bd6',
	brandSecondary: '#c4009e',
	brandLight: '#7df9ff',
	link: '#22e6ff',
	text: '#fdf4ff',
	textSecondary: '#efe2ff',
	textMuted: '#c7a8f0',
	textFaint: '#9b7cc9',
	tint: '#22e6ff',
};

const MATRIX_PALETTE: ChatFluxThemePalette = {
	frame: '#000000',
	sidebar: '#020803',
	surface: '#030b05',
	surfaceAlt: '#041007',
	elevated: '#07180b',
	input: '#05130a',
	header: '#030d06',
	headerHover: '#0a2410',
	guildItem: '#06160a',
	brand: '#16c60c',
	brandSecondary: '#0e8a07',
	brandLight: '#a6ff9e',
	link: '#39ff14',
	text: '#d9ffd4',
	textSecondary: '#b8f5b0',
	textMuted: '#7fcf78',
	textFaint: '#4f9a4a',
	tint: '#39ff14',
};

const INFERNO_PALETTE: ChatFluxThemePalette = {
	frame: '#0a0201',
	sidebar: '#140402',
	surface: '#190603',
	surfaceAlt: '#1f0804',
	elevated: '#2c0d06',
	input: '#240a05',
	header: '#1a0503',
	headerHover: '#3a1208',
	guildItem: '#260b05',
	brand: '#ff4d00',
	brandSecondary: '#d01c00',
	brandLight: '#ffd27a',
	link: '#ffb020',
	text: '#fff3e8',
	textSecondary: '#ffe2cc',
	textMuted: '#e0a98a',
	textFaint: '#b57a5c',
	tint: '#ff6a1a',
};

// Shared building blocks for the "wild" themes. Overlays never catch clicks.
const OVERLAY_BASE = `position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;`;
const REDUCED_MOTION = `
@media (prefers-reduced-motion: reduce) {
	html::before, html::after, body::before, body::after { animation: none !important; }
}`;

const NEON_EXTRA = `
@keyframes cfNeonBar { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes cfNeonPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.85; } }
html::before {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 3px;
	background: linear-gradient(90deg, #ff2bd6, #22e6ff, #fff200, #ff2bd6);
	background-size: 200% 100%;
	box-shadow: 0 0 12px #ff2bd6, 0 0 24px #22e6ff;
	animation: cfNeonBar 4s linear infinite;
}
html::after {
	content: ''; ${OVERLAY_BASE}
	background:
		repeating-linear-gradient(0deg, rgba(34, 230, 255, 0.035) 0 1px, transparent 1px 3px),
		radial-gradient(ellipse at top left, rgba(255, 43, 214, 0.10), transparent 55%),
		radial-gradient(ellipse at bottom right, rgba(34, 230, 255, 0.10), transparent 55%);
	animation: cfNeonPulse 6s ease-in-out infinite;
}
a, h1, h2, h3 { text-shadow: 0 0 6px rgba(255, 43, 214, 0.55), 0 0 14px rgba(34, 230, 255, 0.25); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #ff2bd6, #22e6ff) !important; }
${REDUCED_MOTION}`;

const MATRIX_EXTRA = `
@keyframes cfMatrixFlicker { 0%, 100% { opacity: 0.9; } 47% { opacity: 0.9; } 48% { opacity: 0.6; } 49% { opacity: 1; } 50% { opacity: 0.8; } }
@keyframes cfMatrixScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
html:root {
	--font-sans: var(--font-mono);
	--font-sans-primary: 'Fluxer Mono';
}
body, input, textarea, button { font-family: var(--font-mono) !important; }
html::after {
	content: ''; ${OVERLAY_BASE}
	background:
		repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px),
		radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
	animation: cfMatrixFlicker 7s steps(1) infinite;
}
html::before {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 120px;
	background: linear-gradient(180deg, transparent, rgba(57, 255, 20, 0.06), transparent);
	animation: cfMatrixScan 6s linear infinite;
}
a, h1, h2, h3 { text-shadow: 0 0 6px rgba(57, 255, 20, 0.6); }
${REDUCED_MOTION}`;

const INFERNO_EXTRA = `
@keyframes cfLavaBar { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes cfEmbers { 0%, 100% { opacity: 0.55; transform: scaleY(1); } 50% { opacity: 0.9; transform: scaleY(1.15); } }
html::before {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 3px;
	background: linear-gradient(90deg, #ff1a00, #ffb020, #ff4d00, #ffe14d, #ff1a00);
	background-size: 200% 100%;
	box-shadow: 0 0 14px #ff4d00, 0 0 28px #ff1a00;
	animation: cfLavaBar 3s linear infinite;
}
html::after {
	content: ''; ${OVERLAY_BASE} top: auto; height: 220px;
	transform-origin: bottom;
	background: radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255, 77, 0, 0.22), rgba(255, 26, 0, 0.08) 45%, transparent 75%);
	animation: cfEmbers 3.5s ease-in-out infinite;
}
a, h1, h2, h3 { text-shadow: 0 0 6px rgba(255, 106, 26, 0.6), 0 0 16px rgba(255, 26, 0, 0.3); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #ffb020, #ff1a00) !important; }
${REDUCED_MOTION}`;

// ---- "Extreme" themes ----

type Dot = [x: number, y: number, radius: number, alpha: number];

// Deterministic pseudo-random dots inside one background tile (same output on every build).
function scatter(
	seed: number,
	count: number,
	tile: number,
	radius: [number, number],
	alpha: [number, number],
): Array<Dot> {
	let state = seed;
	const next = (): number => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
	const round = (value: number): number => Math.round(value * 10) / 10;
	return Array.from({length: count}, (): Dot => {
		const r = round(radius[0] + next() * (radius[1] - radius[0]));
		const margin = r + 2;
		return [
			Math.round(margin + next() * (tile - 2 * margin)),
			Math.round(margin + next() * (tile - 2 * margin)),
			r,
			Math.round((alpha[0] + next() * (alpha[1] - alpha[0])) * 100) / 100,
		];
	});
}

function dotLayer(rgb: string, dots: Array<Dot>): string {
	return dots
		.map(
			([x, y, r, a]) => `radial-gradient(circle at ${x}px ${y}px, rgba(${rgb}, ${a}) 0 ${r}px, transparent ${r + 1}px)`,
		)
		.join(',\n\t\t');
}

function ringLayer(rgb: string, dots: Array<Dot>): string {
	return dots
		.map(
			([x, y, r, a]) =>
				`radial-gradient(circle at ${x}px ${y}px, transparent 0 ${r - 1.5}px, rgba(${rgb}, ${a}) ${r - 1}px ${r}px, transparent ${r + 1}px)`,
		)
		.join(',\n\t\t');
}

// A tiled layer that falls or rises forever. It is one tile taller than the screen and moves
// by exactly one tile, so the loop is seamless and only uses transform (cheap to animate).
function driftLayer(
	selector: string,
	background: string,
	tile: number,
	seconds: number,
	direction: 'down' | 'up',
	extra = '',
): string {
	const name = `cf${direction === 'down' ? 'Fall' : 'Rise'}${tile}`;
	const offset = direction === 'down' ? tile : -tile;
	return `
@keyframes ${name} { from { transform: translateY(0); } to { transform: translateY(${offset}px); } }
${selector} {
	content: ''; ${OVERLAY_BASE} ${direction === 'down' ? 'top' : 'bottom'}: -${tile}px;
	background: ${background};
	background-size: ${tile}px ${tile}px;
	animation: ${name} ${seconds}s linear infinite;
	will-change: transform;
	${extra}
}`;
}

const BLIZZARD_PALETTE: ChatFluxThemePalette = {
	frame: '#06101b',
	sidebar: '#0b1826',
	surface: '#0e1d2e',
	surfaceAlt: '#112235',
	elevated: '#182d45',
	input: '#13273c',
	header: '#0d1b2b',
	headerHover: '#1d3550',
	guildItem: '#14283f',
	brand: '#0ea5e9',
	brandSecondary: '#0284c7',
	brandLight: '#e0f2fe',
	link: '#7dd3fc',
	text: '#f4fbff',
	textSecondary: '#e1effa',
	textMuted: '#a9c3d8',
	textFaint: '#7d98b0',
	tint: '#bae6fd',
};

const BLIZZARD_EXTRA = `
${driftLayer('html::before', dotLayer('255, 255, 255', scatter(11, 14, 180, [1, 2], [0.35, 0.7])), 180, 7, 'down')}
${driftLayer('body::before', dotLayer('235, 246, 255', scatter(23, 8, 320, [2, 3.5], [0.45, 0.85])), 320, 10, 'down')}
html::after {
	content: ''; ${OVERLAY_BASE}
	box-shadow: inset 0 0 140px rgba(186, 230, 253, 0.16);
	background: radial-gradient(ellipse at 50% 0%, rgba(224, 242, 254, 0.08), transparent 60%);
}
a, h1, h2, h3 { text-shadow: 0 0 8px rgba(186, 230, 253, 0.55); }
${REDUCED_MOTION}`;

const SYNTHWAVE_PALETTE: ChatFluxThemePalette = {
	frame: '#0d0221',
	sidebar: '#150530',
	surface: '#1a0838',
	surfaceAlt: '#1f0a42',
	elevated: '#2b0f58',
	input: '#230c4a',
	header: '#170634',
	headerHover: '#33136a',
	guildItem: '#250d4d',
	brand: '#f72585',
	brandSecondary: '#b5179e',
	brandLight: '#ffd166',
	link: '#ff9e4f',
	text: '#fff1fb',
	textSecondary: '#f6defa',
	textMuted: '#c9a6de',
	textFaint: '#9a78b8',
	tint: '#c77dff',
};

const SYNTHWAVE_EXTRA = `
@keyframes cfSynthBar { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes cfSynthGrid { from { background-position: 0 0; } to { background-position: 0 50px; } }
html::before {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 3px;
	background: linear-gradient(90deg, #f72585, #ff9e4f, #ffd166, #c77dff, #f72585);
	background-size: 200% 100%;
	box-shadow: 0 0 12px #f72585, 0 0 26px #ff9e4f;
	animation: cfSynthBar 4s linear infinite;
}
body::before {
	content: ''; ${OVERLAY_BASE} top: auto; height: 38vh;
	background:
		repeating-linear-gradient(90deg, rgba(255, 60, 172, 0.55) 0 2px, transparent 2px 80px),
		repeating-linear-gradient(0deg, rgba(255, 60, 172, 0.55) 0 2px, transparent 2px 50px);
	transform: perspective(240px) rotateX(58deg);
	transform-origin: 50% 100%;
	-webkit-mask-image: linear-gradient(to top, black, transparent 85%);
	mask-image: linear-gradient(to top, black, transparent 85%);
	opacity: 0.55;
	animation: cfSynthGrid 1.6s linear infinite;
}
html::after {
	content: ''; ${OVERLAY_BASE}
	background:
		repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 3px),
		radial-gradient(ellipse 60% 45% at 50% 100%, rgba(255, 140, 60, 0.16), rgba(247, 37, 133, 0.08) 50%, transparent 75%);
}
a, h1, h2, h3 { text-shadow: 0 0 6px rgba(247, 37, 133, 0.6), 0 0 16px rgba(255, 158, 79, 0.3); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #ffd166, #f72585, #7b2cbf) !important; }
${REDUCED_MOTION}`;

const AURORA_PALETTE: ChatFluxThemePalette = {
	frame: '#020b0e',
	sidebar: '#051418',
	surface: '#06191e',
	surfaceAlt: '#081d23',
	elevated: '#0c2a31',
	input: '#0a222a',
	header: '#06161b',
	headerHover: '#11343b',
	guildItem: '#0b252c',
	brand: '#10b981',
	brandSecondary: '#059669',
	brandLight: '#a7f3d0',
	link: '#5eead4',
	text: '#effffb',
	textSecondary: '#d8f5ee',
	textMuted: '#9fcbc0',
	textFaint: '#6f9c92',
	tint: '#34d399',
};

const AURORA_EXTRA = `
@keyframes cfAuroraA { 0%, 100% { transform: translateX(-12%) scaleY(1); opacity: 0.7; } 50% { transform: translateX(8%) scaleY(1.3); opacity: 1; } }
@keyframes cfAuroraB { 0%, 100% { transform: translateX(10%) scaleY(1.2); opacity: 0.8; } 50% { transform: translateX(-10%) scaleY(0.9); opacity: 0.45; } }
@keyframes cfTwinkle { from { opacity: 0.25; } to { opacity: 0.8; } }
html::before {
	content: ''; ${OVERLAY_BASE} left: -30%; right: -30%; bottom: auto; height: 55vh;
	transform-origin: top;
	background: linear-gradient(100deg, transparent 8%, rgba(52, 211, 153, 0.34) 20%, rgba(45, 212, 191, 0.12) 30%,
		rgba(52, 211, 153, 0.3) 38%, transparent 48%, rgba(168, 85, 247, 0.28) 58%, rgba(56, 189, 248, 0.2) 68%, transparent 80%);
	-webkit-mask-image: linear-gradient(to bottom, black, rgba(0, 0, 0, 0.5) 45%, transparent);
	mask-image: linear-gradient(to bottom, black, rgba(0, 0, 0, 0.5) 45%, transparent);
	animation: cfAuroraA 14s ease-in-out infinite;
}
body::before {
	content: ''; ${OVERLAY_BASE} left: -30%; right: -30%; bottom: auto; height: 42vh;
	transform-origin: top;
	background: linear-gradient(75deg, transparent 15%, rgba(244, 114, 182, 0.2) 28%, transparent 40%,
		rgba(74, 222, 128, 0.26) 55%, rgba(34, 211, 238, 0.16) 66%, transparent 78%);
	-webkit-mask-image: linear-gradient(to bottom, black, transparent);
	mask-image: linear-gradient(to bottom, black, transparent);
	animation: cfAuroraB 19s ease-in-out infinite;
}
html::after {
	content: ''; ${OVERLAY_BASE}
	background: ${dotLayer('230, 255, 250', scatter(7, 12, 240, [0.7, 1.4], [0.5, 0.9]))};
	background-size: 240px 240px;
	-webkit-mask-image: linear-gradient(to bottom, black, transparent 60%);
	mask-image: linear-gradient(to bottom, black, transparent 60%);
	animation: cfTwinkle 3.5s ease-in-out infinite alternate;
}
a, h1, h2, h3 { text-shadow: 0 0 8px rgba(52, 211, 153, 0.55), 0 0 18px rgba(168, 85, 247, 0.25); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #34d399, #22d3ee, #a855f7) !important; }
${REDUCED_MOTION}`;

const HYPERSPACE_PALETTE: ChatFluxThemePalette = {
	frame: '#03030c',
	sidebar: '#070818',
	surface: '#0a0b1f',
	surfaceAlt: '#0d0f27',
	elevated: '#141738',
	input: '#10122e',
	header: '#0b0d24',
	headerHover: '#1c2048',
	guildItem: '#12153a',
	brand: '#6366f1',
	brandSecondary: '#4f46e5',
	brandLight: '#c7d2fe',
	link: '#a5b4fc',
	text: '#f1f3ff',
	textSecondary: '#e0e4ff',
	textMuted: '#aab0d8',
	textFaint: '#7c83b0',
	tint: '#a5b4fc',
};

const HYPERSPACE_STARS = dotLayer('220, 230, 255', scatter(5, 18, 260, [0.8, 1.6], [0.5, 0.95]));

const HYPERSPACE_EXTRA = `
@keyframes cfWarp { 0% { transform: scale(0.5); opacity: 0; } 25% { opacity: 0.55; } 80% { opacity: 0.4; } 100% { transform: scale(2.2); opacity: 0; } }
html::before, body::before {
	content: ''; ${OVERLAY_BASE} inset: -50%;
	background: ${HYPERSPACE_STARS};
	background-size: 260px 260px;
	animation: cfWarp 5s linear infinite;
	will-change: transform, opacity;
}
body::before { animation-delay: -2.5s; background-position: 130px 90px; }
html::after {
	content: ''; ${OVERLAY_BASE}
	background:
		radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1), transparent 45%),
		radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.5) 100%);
}
a, h1, h2, h3 { text-shadow: 0 0 8px rgba(165, 180, 252, 0.6); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #a5b4fc, #6366f1) !important; }
${REDUCED_MOTION}`;

const DEEPSEA_PALETTE: ChatFluxThemePalette = {
	frame: '#010b14',
	sidebar: '#03141f',
	surface: '#041a28',
	surfaceAlt: '#05202f',
	elevated: '#082b3e',
	input: '#062435',
	header: '#041a29',
	headerHover: '#0b3349',
	guildItem: '#072638',
	brand: '#0891b2',
	brandSecondary: '#0e7490',
	brandLight: '#a5f3fc',
	link: '#67e8f9',
	text: '#ecfeff',
	textSecondary: '#d5f5fa',
	textMuted: '#9ccad6',
	textFaint: '#6e9cab',
	tint: '#22d3ee',
};

const DEEPSEA_EXTRA = `
@keyframes cfRays { from { transform: translateX(-4%) skewX(-4deg); opacity: 0.6; } to { transform: translateX(4%) skewX(4deg); opacity: 1; } }
html::before {
	content: ''; ${OVERLAY_BASE} left: -20%; right: -20%; bottom: auto; height: 75vh;
	transform-origin: top;
	background: repeating-linear-gradient(110deg, transparent 0 60px, rgba(103, 232, 249, 0.06) 60px 100px, transparent 100px 190px);
	-webkit-mask-image: linear-gradient(to bottom, black, transparent);
	mask-image: linear-gradient(to bottom, black, transparent);
	animation: cfRays 9s ease-in-out infinite alternate;
}
${driftLayer('body::before', ringLayer('165, 243, 252', scatter(31, 9, 240, [3, 6], [0.25, 0.5])), 240, 11, 'up')}
${driftLayer('body::after', ringLayer('207, 250, 254', scatter(47, 5, 400, [6, 10], [0.18, 0.35])), 400, 17, 'up')}
html::after {
	content: ''; ${OVERLAY_BASE}
	background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 10, 25, 0.45) 100%);
}
a, h1, h2, h3 { text-shadow: 0 0 8px rgba(34, 211, 238, 0.5); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #67e8f9, #0e7490) !important; }
${REDUCED_MOTION}`;

const GLITCH_PALETTE: ChatFluxThemePalette = {
	frame: '#0a0a0a',
	sidebar: '#111111',
	surface: '#141414',
	surfaceAlt: '#181818',
	elevated: '#222222',
	input: '#1b1b1b',
	header: '#121212',
	headerHover: '#2a2a2a',
	guildItem: '#1e1e1e',
	brand: '#e6004c',
	brandSecondary: '#b3003c',
	brandLight: '#00fff0',
	link: '#00fff0',
	text: '#ffffff',
	textSecondary: '#e8e8e8',
	textMuted: '#a8a8a8',
	textFaint: '#7a7a7a',
	tint: '#00fff0',
};

const GLITCH_EXTRA = `
@keyframes cfGlitchBars {
	0%, 87%, 100% { opacity: 0; transform: translate(0, 0); }
	88% { opacity: 1; transform: translate(-6px, -8vh); }
	90% { opacity: 1; transform: translate(8px, 14vh); }
	92% { opacity: 0.8; transform: translate(-4px, -22vh); }
	94% { opacity: 0; }
}
@keyframes cfGlitchText {
	0%, 89%, 100% { text-shadow: 1.5px 0 rgba(255, 0, 85, 0.75), -1.5px 0 rgba(0, 255, 240, 0.75); }
	91% { text-shadow: -3px 0 rgba(255, 0, 85, 0.9), 3px 0 rgba(0, 255, 240, 0.9); }
	93% { text-shadow: 4px 1px rgba(255, 0, 85, 0.9), -4px -1px rgba(0, 255, 240, 0.9); }
	95% { text-shadow: 1.5px 0 rgba(255, 0, 85, 0.75), -1.5px 0 rgba(0, 255, 240, 0.75); }
}
@keyframes cfGlitchTop { 0%, 100% { background: #ff0055; } 33% { background: #00fff0; } 66% { background: #ffffff; } }
html::before, body::before {
	content: ''; ${OVERLAY_BASE}
	mix-blend-mode: screen;
	animation: cfGlitchBars 4.5s steps(1) infinite;
}
html::before {
	background: linear-gradient(transparent 0 22%, rgba(255, 0, 85, 0.22) 22% 23.5%, transparent 23.5% 61%,
		rgba(0, 255, 240, 0.2) 61% 62%, transparent 62% 80%, rgba(255, 255, 255, 0.12) 80% 80.6%, transparent 80.6%);
}
body::before {
	background: linear-gradient(transparent 0 38%, rgba(0, 255, 240, 0.18) 38% 40%, transparent 40% 71%,
		rgba(255, 0, 85, 0.2) 71% 71.8%, transparent 71.8%);
	animation-duration: 7s;
	animation-delay: -3s;
}
html::after {
	content: ''; ${OVERLAY_BASE}
	background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 3px);
}
body::after {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 2px;
	animation: cfGlitchTop 0.9s steps(1) infinite;
}
h1, h2, h3, a { animation: cfGlitchText 3s steps(1) infinite; }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #ff0055 50%, #00fff0 50%) !important; }
${REDUCED_MOTION}
@media (prefers-reduced-motion: reduce) { h1, h2, h3, a { animation: none !important; } }`;

const DISCO_PALETTE: ChatFluxThemePalette = {
	frame: '#0b0614',
	sidebar: '#120a20',
	surface: '#160c27',
	surfaceAlt: '#1a0f2e',
	elevated: '#24143f',
	input: '#1d1035',
	header: '#150b25',
	headerHover: '#2c1850',
	guildItem: '#1f1238',
	brand: '#db2777',
	brandSecondary: '#a21caf',
	brandLight: '#fde047',
	link: '#facc15',
	text: '#fff7fd',
	textSecondary: '#f5e6f7',
	textMuted: '#c8acd6',
	textFaint: '#9a7eaa',
	tint: '#c084fc',
};

const DISCO_EXTRA = `
@keyframes cfDiscoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes cfDiscoBar { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes cfSparkle { 0%, 100% { opacity: 0; } 50% { opacity: 0.7; } }
html::before {
	content: ''; ${OVERLAY_BASE} inset: -60%;
	background: conic-gradient(from 0deg, rgba(255, 0, 128, 0.1), transparent 8%, rgba(0, 200, 255, 0.1) 16%, transparent 24%,
		rgba(255, 230, 0, 0.1) 33%, transparent 41%, rgba(140, 255, 0, 0.09) 50%, transparent 58%,
		rgba(170, 0, 255, 0.1) 66%, transparent 74%, rgba(255, 120, 0, 0.1) 83%, transparent 91%, rgba(255, 0, 128, 0.1));
	mix-blend-mode: screen;
	animation: cfDiscoSpin 18s linear infinite;
	will-change: transform;
}
html::after {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 3px;
	background: linear-gradient(90deg, #ff0080, #ff7800, #ffe600, #8cff00, #00c8ff, #aa00ff, #ff0080);
	background-size: 200% 100%;
	box-shadow: 0 0 12px #ff0080, 0 0 24px #00c8ff;
	animation: cfDiscoBar 2.5s linear infinite;
}
body::before, body::after {
	content: ''; ${OVERLAY_BASE}
	animation: cfSparkle 1.6s ease-in-out infinite;
}
body::before {
	background: ${dotLayer('255, 255, 255', scatter(3, 9, 300, [1, 2], [0.7, 1]))};
	background-size: 300px 300px;
}
body::after {
	background: ${dotLayer('253, 224, 71', scatter(17, 7, 230, [1, 1.8], [0.6, 1]))};
	background-size: 230px 230px;
	animation-delay: -0.8s;
}
a, h1, h2, h3 { text-shadow: 0 0 6px rgba(255, 0, 128, 0.6), 0 0 14px rgba(250, 204, 21, 0.35); }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #ff0080, #ffe600, #00c8ff, #aa00ff) !important; }
${REDUCED_MOTION}`;

const TOXIC_PALETTE: ChatFluxThemePalette = {
	frame: '#050803',
	sidebar: '#0a1006',
	surface: '#0d1508',
	surfaceAlt: '#10190a',
	elevated: '#18240f',
	input: '#131d0c',
	header: '#0d1408',
	headerHover: '#1f2e12',
	guildItem: '#152010',
	brand: '#65a30d',
	brandSecondary: '#4d7c0f',
	brandLight: '#d9f99d',
	link: '#bef264',
	text: '#f7fee7',
	textSecondary: '#ecfccb',
	textMuted: '#b5c99a',
	textFaint: '#87996c',
	tint: '#bef264',
};

const TOXIC_EXTRA = `
@keyframes cfHazard { from { background-position: 0 0; } to { background-position: 28.28px 0; } }
@keyframes cfToxicPulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
html::before {
	content: ''; ${OVERLAY_BASE} bottom: auto; height: 6px;
	background: repeating-linear-gradient(45deg, #facc15 0 10px, #111111 10px 20px);
	background-size: 28.28px 28.28px;
	box-shadow: 0 0 14px rgba(250, 204, 21, 0.6);
	animation: cfHazard 1s linear infinite;
}
html::after {
	content: ''; ${OVERLAY_BASE}
	box-shadow: inset 0 0 160px rgba(132, 204, 22, 0.25);
	background: radial-gradient(ellipse 70% 40% at 50% 100%, rgba(163, 230, 53, 0.1), transparent 70%);
	animation: cfToxicPulse 3s ease-in-out infinite;
}
${driftLayer(
	'body::before',
	ringLayer('190, 242, 100', scatter(13, 12, 220, [3, 7], [0.5, 0.85])),
	220,
	8,
	'up',
	`-webkit-mask-image: linear-gradient(to top, black, transparent 70%);
	mask-image: linear-gradient(to top, black, transparent 70%);`,
)}
a, h1, h2, h3 { text-shadow: 0 0 8px rgba(190, 242, 100, 0.6); }
::-webkit-scrollbar-thumb { background: repeating-linear-gradient(45deg, #facc15 0 6px, #111111 6px 12px) !important; }
${REDUCED_MOTION}`;

const EXTREME_BADGE = {hu: 'EXTRÉM', en: 'EXTREME'};

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
	{
		id: 'chatflux-theme-neon-city',
		fileName: 'chatflux-neon-city.css',
		name: {hu: 'Neonváros', en: 'Neon City'},
		description: {
			hu: 'Cyberpunk éjszaka: izzó pink és cián neon, futó fénycsík és CRT-csíkok.',
			en: 'Cyberpunk night: glowing pink and cyan neon, a running light bar and CRT lines.',
		},
		badge: {hu: 'VAD', en: 'WILD'},
		emoji: '🌆',
		palette: NEON_PALETTE,
		css: buildThemeCss(
			'Neon City',
			'Cyberpunk neon with animated glow.',
			'chatflux, neon, cyberpunk, animated',
			NEON_PALETTE,
			NEON_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-matrix',
		fileName: 'chatflux-matrix.css',
		name: {hu: 'Mátrix', en: 'The Grid'},
		description: {
			hu: 'Hacker-terminál: koromfekete, zöld foszfor, fix szélességű betűk, vibráló CRT-monitor.',
			en: 'Hacker terminal: pitch black, green phosphor, monospace text and a flickering CRT.',
		},
		badge: {hu: 'VAD', en: 'WILD'},
		emoji: '💚',
		palette: MATRIX_PALETTE,
		css: buildThemeCss(
			'The Grid',
			'Green phosphor hacker terminal.',
			'chatflux, green, terminal, animated',
			MATRIX_PALETTE,
			MATRIX_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-inferno',
		fileName: 'chatflux-inferno.css',
		name: {hu: 'Pokoli láva', en: 'Inferno'},
		description: {
			hu: 'Izzó láva és parázs: hömpölygő tűzcsík fent, lüktető parázsfény alul.',
			en: 'Molten lava and embers: a rolling fire bar on top and pulsing ember glow below.',
		},
		badge: {hu: 'VAD', en: 'WILD'},
		emoji: '🔥',
		palette: INFERNO_PALETTE,
		css: buildThemeCss(
			'Inferno',
			'Molten lava with animated fire glow.',
			'chatflux, red, fire, animated',
			INFERNO_PALETTE,
			INFERNO_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-hyperspace',
		fileName: 'chatflux-hyperspace.css',
		name: {hu: 'Hiperugrás', en: 'Hyperspace'},
		description: {
			hu: 'Fénysebességgel száguldasz: a csillagok folyamatosan feléd zúgnak a képernyő közepéből.',
			en: 'Light speed: stars keep rushing at you from the middle of the screen.',
		},
		badge: EXTREME_BADGE,
		emoji: '🚀',
		palette: HYPERSPACE_PALETTE,
		css: buildThemeCss(
			'Hyperspace',
			'Warp-speed starfield.',
			'chatflux, space, animated',
			HYPERSPACE_PALETTE,
			HYPERSPACE_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-synthwave',
		fileName: 'chatflux-synthwave.css',
		name: {hu: 'Szintihullám', en: 'Synthwave'},
		description: {
			hu: '80-as évek retró-futurizmusa: lenyugvó neonnap, alul végtelenbe futó pink rácsháló.',
			en: '80s retro-future: a neon sunset glow and an endless pink grid rolling at the bottom.',
		},
		badge: EXTREME_BADGE,
		emoji: '🌅',
		palette: SYNTHWAVE_PALETTE,
		css: buildThemeCss(
			'Synthwave',
			'Neon sunset with a rolling grid.',
			'chatflux, retro, neon, animated',
			SYNTHWAVE_PALETTE,
			SYNTHWAVE_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-aurora',
		fileName: 'chatflux-aurora.css',
		name: {hu: 'Sarki fény', en: 'Aurora'},
		description: {
			hu: 'Hullámzó zöld-lila északi fény az égen, alatta pislákoló csillagok.',
			en: 'Waving green and purple northern lights with twinkling stars.',
		},
		badge: EXTREME_BADGE,
		emoji: '🌌',
		palette: AURORA_PALETTE,
		css: buildThemeCss(
			'Aurora',
			'Animated northern lights.',
			'chatflux, green, aurora, animated',
			AURORA_PALETTE,
			AURORA_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-blizzard',
		fileName: 'chatflux-blizzard.css',
		name: {hu: 'Hóvihar', en: 'Blizzard'},
		description: {
			hu: 'Jeges kék fagy a képernyő szélén, és folyamatosan, két rétegben hulló hó.',
			en: 'Icy blue frost around the edges and snow falling in two layers.',
		},
		badge: EXTREME_BADGE,
		emoji: '🌨️',
		palette: BLIZZARD_PALETTE,
		css: buildThemeCss(
			'Blizzard',
			'Falling snow and frost.',
			'chatflux, winter, snow, animated',
			BLIZZARD_PALETTE,
			BLIZZARD_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-deep-sea',
		fileName: 'chatflux-deep-sea.css',
		name: {hu: 'Mélytenger', en: 'Deep Sea'},
		description: {
			hu: 'A tenger mélyén vagy: hullámzó fénysugarak felülről, felszálló buborékok mindenhol.',
			en: 'Deep under the sea: swaying light rays from above and bubbles rising everywhere.',
		},
		badge: EXTREME_BADGE,
		emoji: '🫧',
		palette: DEEPSEA_PALETTE,
		css: buildThemeCss(
			'Deep Sea',
			'Light rays and rising bubbles.',
			'chatflux, ocean, blue, animated',
			DEEPSEA_PALETTE,
			DEEPSEA_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-glitch',
		fileName: 'chatflux-glitch.css',
		name: {hu: 'Glitch', en: 'Glitch'},
		description: {
			hu: 'Elromlott a mátrix: RGB-csúszású címek, hirtelen villanó zavarcsíkok, vibráló felső sáv.',
			en: 'Something broke: RGB-split headings, sudden glitch bars and a flickering top line.',
		},
		badge: EXTREME_BADGE,
		emoji: '👾',
		palette: GLITCH_PALETTE,
		css: buildThemeCss(
			'Glitch',
			'RGB split and glitch bars.',
			'chatflux, glitch, animated',
			GLITCH_PALETTE,
			GLITCH_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-disco',
		fileName: 'chatflux-disco.css',
		name: {hu: 'Diszkóláz', en: 'Disco Fever'},
		description: {
			hu: 'Forgó színes reflektorfények, csillogó diszkógömb-szikrák és szivárványos fénycsík.',
			en: 'Spinning coloured spotlights, disco-ball sparkles and a rainbow light bar.',
		},
		badge: EXTREME_BADGE,
		emoji: '🪩',
		palette: DISCO_PALETTE,
		css: buildThemeCss(
			'Disco Fever',
			'Spinning spotlights and sparkles.',
			'chatflux, party, rainbow, animated',
			DISCO_PALETTE,
			DISCO_EXTRA,
		),
	},
	{
		id: 'chatflux-theme-toxic',
		fileName: 'chatflux-toxic.css',
		name: {hu: 'Radioaktív', en: 'Toxic'},
		description: {
			hu: 'Veszélyzóna: mozgó sárga-fekete szalag, lüktető mérgeszöld izzás és fortyogó buborékok.',
			en: 'Danger zone: a moving hazard stripe, pulsing toxic-green glow and bubbling goo.',
		},
		badge: EXTREME_BADGE,
		emoji: '☢️',
		palette: TOXIC_PALETTE,
		css: buildThemeCss(
			'Toxic',
			'Hazard stripes and toxic glow.',
			'chatflux, green, toxic, animated',
			TOXIC_PALETTE,
			TOXIC_EXTRA,
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
