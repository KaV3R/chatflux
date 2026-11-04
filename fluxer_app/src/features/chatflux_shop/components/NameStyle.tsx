// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux display name styles: a bought font + effect, coloured by the user.

import styles from '@app/features/chatflux_shop/components/NameStyle.module.css';
import {type NameEffect, type ShopRender, shopAssetUrl, type WornNameStyle} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const DEFAULT_NAME_COLORS = ['#c084fc', '#f472b6'];

/** Effects that use a second colour. */
export const TWO_COLOR_EFFECTS: ReadonlyArray<NameEffect> = ['gradient', 'pop', 'gummy', 'prism'];

// ---------- colours ----------
function parseHex(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1, 7), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
	return `#${[r, g, b]
		.map((v) =>
			Math.round(Math.min(255, Math.max(0, v)))
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`;
}

export function mixColor(a: string, b: string, t: number): string {
	const x = parseHex(a);
	const y = parseHex(b);
	return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function shiftHue(hex: string, degrees: number): string {
	const [r, g, b] = parseHex(hex).map((v) => v / 255) as [number, number, number];
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
	if (d !== 0) {
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
	}
	h = (((h * 60 + degrees) % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const sectors: Array<[number, number, number]> = [
		[c, x, 0],
		[x, c, 0],
		[0, c, x],
		[0, x, c],
		[x, 0, c],
		[c, 0, x],
	];
	const [r1, g1, b1] = sectors[Math.min(5, Math.floor(h / 60))];
	return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
}

const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

// ---------- fonts ----------
const fontLoads = new Map<string, Promise<void>>();

export const nameFontFamily = (font: string) => `ChatFluxName-${font}`;

/** Loads a shop font once. Fetched as bytes so the page's font-src policy does not matter. */
export function ensureNameFont(font: string | null | undefined, file: string | null | undefined): void {
	if (!font || !file || fontLoads.has(font) || typeof FontFace === 'undefined') return;
	const url = shopAssetUrl(file);
	if (!url) return;
	const load = fetch(url, {credentials: 'omit'})
		.then((res) => {
			if (!res.ok) throw new Error(`font ${res.status}`);
			return res.arrayBuffer();
		})
		.then((buffer) => {
			const face = new FontFace(nameFontFamily(font), buffer);
			document.fonts.add(face);
			return face.load();
		})
		.then(() => undefined)
		.catch((error) => console.debug('[ChatFluxShop] font failed', font, error));
	fontLoads.set(font, load);
}

// ---------- style ----------
type NameCss = React.CSSProperties & Record<`--cfn-${string}`, string>;

export function nameStyleProps(style: WornNameStyle | null | undefined): {className: string; style: NameCss} | null {
	if (!style) return null;
	ensureNameFont(style.font, style.file);
	const chosen = (style.colors ?? []).filter(isHex);
	const c1 = chosen[0] ?? DEFAULT_NAME_COLORS[0];
	const c2 = chosen[1] ?? (chosen.length === 1 ? shiftHue(c1, 50) : DEFAULT_NAME_COLORS[1]);
	const effect = style.effect ?? 'solid';
	const css: NameCss = {
		'--cfn-c1': c1,
		'--cfn-c2': c2,
		'--cfn-c3': shiftHue(c1, 120),
		'--cfn-c4': shiftHue(c2, 120),
		'--cfn-light': mixColor(c1, '#ffffff', 0.6),
		'--cfn-dark': mixColor(c1, '#000000', 0.7),
		'--cfn-shine': mixColor(c1, '#ffffff', 0.85),
	};
	if (style.font) {
		css.fontFamily = `"${nameFontFamily(style.font)}", var(--font-sans, sans-serif)`;
		// Shop fonts have one weight; faux bold would smear thin details (e.g. Monoton's stripes).
		css.fontWeight = 400;
		css.fontSynthesis = 'none';
		if (style.scale && style.scale !== 1) css.fontSize = `${style.scale}em`;
	}
	const clipped = effect === 'gradient' || effect === 'gummy' || effect === 'prism' || effect === 'shimmer';
	return {
		className: clsx(styles.name, clipped && styles.clip, effect !== 'solid' && styles[effect]),
		style: css,
	};
}

/** Builds a name style from shop items (for previews before anything is saved). */
export function composeNameStyle(
	font: ShopRender | null | undefined,
	effect: ShopRender | null | undefined,
	colors?: Array<string> | null,
): WornNameStyle {
	return {
		sku: 'preview',
		font: font?.font ?? null,
		file: font?.file ?? null,
		scale: font?.scale ?? 1,
		effect: effect?.effect ?? 'solid',
		colors: colors ?? effect?.colors ?? null,
	};
}

/** Text drawn in a given name style (the outer element keeps its own size and ellipsis). */
export const NameStyleText: React.FC<{nameStyle: WornNameStyle | null | undefined; children: React.ReactNode}> = ({
	nameStyle,
	children,
}) => {
	const props = nameStyleProps(nameStyle);
	if (!props) return <>{children}</>;
	return (
		<span className={props.className} style={props.style} data-flx="chatflux.name-style">
			{children}
		</span>
	);
};

/** A user's name in the style they wear (plain text when they wear none). */
export const StyledName: React.FC<{userId: string | null | undefined; children: React.ReactNode}> = observer(
	({userId, children}) => <NameStyleText nameStyle={ShopStore.getWorn(userId).namestyle}>{children}</NameStyleText>,
);
