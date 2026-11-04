// SPDX-License-Identifier: AGPL-3.0-or-later

// "Change display name style": pick a bought font + effect and colour them.

import {
	composeNameStyle,
	DEFAULT_NAME_COLORS,
	NameStyleText,
	TWO_COLOR_EFFECTS,
} from '@app/features/chatflux_shop/components/NameStyle';
import styles from '@app/features/chatflux_shop/components/NameStyleEditor.module.css';
import {NameStylePreview} from '@app/features/chatflux_shop/components/ShopItemPreview';
import {localize, ShopApiError, type ShopItem, type ShopRender, tr} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import {CheckIcon, EyedropperIcon, LockSimpleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useState} from 'react';

export const NAME_COLOR_PRESETS = [
	'#f472b6',
	'#22c55e',
	'#38bdf8',
	'#a855f7',
	'#e11d48',
	'#f97316',
	'#facc15',
	'#ffffff',
];

const EFFECT_LABELS: Record<string, [string, string]> = {
	solid: ['Egyszínű', 'Solid'],
	gradient: ['Színátmenet', 'Gradient'],
	neon: ['Neon', 'Neon'],
	toon: ['Rajzfilm', 'Toon'],
	pop: ['Pop', 'Pop'],
	gummy: ['Gumicukor', 'Gummy'],
	prism: ['Prizma', 'Prism'],
	shimmer: ['Csillogás', 'Shimmer'],
};

const effectLabel = (effect: string) => {
	const label = EFFECT_LABELS[effect];
	return label ? tr(label[0], label[1]) : effect;
};

interface Draft {
	font: string | null;
	effect: string | null;
	colors: Array<string>;
}

function savedDraft(): Draft {
	const me = ShopStore.me;
	return {
		font: me?.equipped.namefont ?? null,
		effect: me?.equipped.nameeffect ?? null,
		colors: me?.nameColors?.length ? [...me.nameColors] : [...DEFAULT_NAME_COLORS],
	};
}

const sameDraft = (a: Draft, b: Draft) =>
	a.font === b.font && a.effect === b.effect && a.colors.join() === b.colors.join();

const ColorRow: React.FC<{label: string; value: string; onChange: (color: string) => void}> = ({
	label,
	value,
	onChange,
}) => {
	const custom = !NAME_COLOR_PRESETS.includes(value.toLowerCase());
	return (
		<div className={styles.colorBlock}>
			{label && <div className={styles.subLabel}>{label}</div>}
			<div className={styles.colors}>
				<label
					className={clsx(styles.swatch, styles.swatchCustom, custom && styles.swatchActive)}
					style={{backgroundColor: value}}
					title={tr('Saját szín', 'Custom colour')}
				>
					<EyedropperIcon size={16} weight="bold" />
					<input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
				</label>
				{NAME_COLOR_PRESETS.map((color) => (
					<button
						key={color}
						type="button"
						className={clsx(styles.swatch, value.toLowerCase() === color && styles.swatchActive)}
						style={{backgroundColor: color}}
						onClick={() => onChange(color)}
						aria-label={color}
					>
						{value.toLowerCase() === color && <CheckIcon size={14} weight="bold" />}
					</button>
				))}
			</div>
		</div>
	);
};

export const NameStyleEditor: React.FC<{onOpenItem: (item: ShopItem) => void}> = observer(({onOpenItem}) => {
	const [draft, setDraft] = useState<Draft>(savedDraft);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const meKey = `${ShopStore.me?.equipped.namefont}|${ShopStore.me?.equipped.nameeffect}|${ShopStore.me?.nameColors?.join()}`;

	// Follow changes made elsewhere (e.g. equipping from an item card).
	useEffect(() => {
		setDraft(savedDraft());
	}, [meKey]);

	const fonts = ShopStore.items.filter((item) => item.type === 'namefont');
	const effects = ShopStore.items.filter((item) => item.type === 'nameeffect');
	const ownsAny = [...fonts, ...effects].some((item) => ShopStore.owns(item.sku));
	const fontItem = draft.font ? ShopStore.itemBySku(draft.font) : undefined;
	const effectItem = draft.effect ? ShopStore.itemBySku(draft.effect) : undefined;
	const effectId = effectItem?.render?.effect ?? 'solid';
	const twoColors = TWO_COLOR_EFFECTS.includes(effectId);
	const colors = twoColors ? draft.colors : draft.colors.slice(0, 1);
	const preview = composeNameStyle(fontItem?.render, effectItem?.render, colors);
	const dirty = !sameDraft(draft, savedDraft());
	const busy = ShopStore.pendingSku != null;

	const pick = (item: ShopItem | null, slot: 'font' | 'effect') => {
		setSaved(false);
		if (item && !ShopStore.owns(item.sku)) {
			onOpenItem(item);
			return;
		}
		setDraft((prev) => ({...prev, [slot]: item?.sku ?? null}));
	};

	const setColor = (index: number, color: string) => {
		setSaved(false);
		setDraft((prev) => {
			const next = [...prev.colors];
			while (next.length < 2) next.push(DEFAULT_NAME_COLORS[next.length]);
			next[index] = color.toLowerCase();
			return {...prev, colors: next};
		});
	};

	const save = async () => {
		setError(null);
		try {
			await ShopStore.saveNameStyle({
				font: draft.font,
				effect: draft.effect,
				colors: ownsAny ? draft.colors.slice(0, 2) : null,
			});
			setSaved(true);
		} catch (e) {
			setError(
				e instanceof ShopApiError && e.code === 'not_owned'
					? tr('Ezt még nem vetted meg.', "You don't own this yet.")
					: tr('Nem sikerült menteni. Próbáld újra.', 'Could not save. Try again.'),
			);
		}
	};

	const reset = async () => {
		setError(null);
		try {
			await ShopStore.saveNameStyle({font: null, effect: null, colors: null});
			setSaved(false);
		} catch {
			setError(tr('Nem sikerült menteni. Próbáld újra.', 'Could not save. Try again.'));
		}
	};

	const sample = (text: string, font: ShopRender | null | undefined, effect: ShopRender | null | undefined) => (
		<NameStyleText nameStyle={composeNameStyle(font, effect, colors)}>{text}</NameStyleText>
	);

	return (
		<section className={styles.editor} data-flx="chatflux.shop.name-style-editor">
			<div className={styles.header}>
				<div className={styles.title}>{tr('Névstílus', 'Display Name Style')}</div>
				<div className={styles.hint}>
					{tr(
						'Ahogy itt kinéz, úgy látják a többiek a chatben, a taglistában és a profilodon.',
						'Others see it like this in chat, in the member list and on your profile.',
					)}
				</div>
			</div>
			<div className={styles.preview}>
				<NameStylePreview nameStyle={preview} size="large" />
			</div>

			<div className={styles.label}>{tr('Betűtípus', 'Font')}</div>
			<div className={styles.grid}>
				<button
					type="button"
					className={clsx(styles.tile, draft.font == null && styles.tileActive)}
					onClick={() => pick(null, 'font')}
					title={tr('Alap', 'Default')}
				>
					<span className={styles.tileSample}>{sample('Gg', null, effectItem?.render)}</span>
				</button>
				{fonts.map((item) => {
					const owned = ShopStore.owns(item.sku);
					return (
						<button
							key={item.sku}
							type="button"
							className={clsx(styles.tile, draft.font === item.sku && styles.tileActive, !owned && styles.tileLocked)}
							onClick={() => pick(item, 'font')}
							title={localize(item.name)}
						>
							<span className={styles.tileSample}>{sample('Gg', item.render, effectItem?.render)}</span>
							{!owned && <LockSimpleIcon className={styles.lock} size={12} weight="fill" />}
						</button>
					);
				})}
			</div>

			<div className={styles.label}>{tr('Effekt', 'Effect')}</div>
			<div className={clsx(styles.grid, styles.gridWide)}>
				<button
					type="button"
					className={clsx(styles.tile, draft.effect == null && styles.tileActive)}
					onClick={() => pick(null, 'effect')}
				>
					<span className={styles.tileEffect}>{sample(effectLabel('solid'), fontItem?.render, null)}</span>
				</button>
				{effects.map((item) => {
					const owned = ShopStore.owns(item.sku);
					return (
						<button
							key={item.sku}
							type="button"
							className={clsx(styles.tile, draft.effect === item.sku && styles.tileActive, !owned && styles.tileLocked)}
							onClick={() => pick(item, 'effect')}
							title={localize(item.name)}
						>
							<span className={styles.tileEffect}>
								{sample(effectLabel(item.render?.effect ?? ''), fontItem?.render, item.render)}
							</span>
							{!owned && <LockSimpleIcon className={styles.lock} size={12} weight="fill" />}
						</button>
					);
				})}
			</div>

			<div className={styles.label}>{tr('Szín', 'Colour')}</div>
			<ColorRow
				label={twoColors ? tr('Első szín', 'First colour') : ''}
				value={draft.colors[0] ?? DEFAULT_NAME_COLORS[0]}
				onChange={(color) => setColor(0, color)}
			/>
			{twoColors && (
				<ColorRow
					label={tr('Második szín', 'Second colour')}
					value={draft.colors[1] ?? DEFAULT_NAME_COLORS[1]}
					onChange={(color) => setColor(1, color)}
				/>
			)}

			<div className={styles.actions}>
				{!ownsAny && (
					<div className={styles.hint}>
						{tr(
							'Vegyél egy betűtípust vagy effektet a boltban, és utána a színt is szabadon választhatod.',
							'Buy a font or an effect in the shop, then you can pick the colour freely too.',
						)}
					</div>
				)}
				<button type="button" className={styles.save} disabled={!ownsAny || !dirty || busy} onClick={save}>
					{saved && !dirty ? tr('Elmentve', 'Saved') : tr('Mentés', 'Save')}
				</button>
				{ShopStore.me?.wearing.namestyle && (
					<button type="button" className={styles.reset} disabled={busy} onClick={reset}>
						{tr('Alaphelyzet', 'Reset')}
					</button>
				)}
				{error && <div className={styles.error}>{error}</div>}
			</div>
		</section>
	);
});
