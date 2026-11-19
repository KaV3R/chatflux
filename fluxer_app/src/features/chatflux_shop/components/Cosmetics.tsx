// SPDX-License-Identifier: AGPL-3.0-or-later

import Accessibility from '@app/features/accessibility/state/Accessibility';
import ChatFluxPrefs from '@app/features/chatflux_shop/ChatFluxPrefs';
import styles from '@app/features/chatflux_shop/components/Cosmetics.module.css';
import {shopAssetUrl, type WornCosmetic, type WornCosmetics} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

/** Shop cosmetics stand still when profile animations are off or reduced motion is on. */
function cosmeticsStill(): boolean {
	return !ChatFluxPrefs.animateProfiles || Accessibility.useReducedMotion;
}

/** Every animated SVG asset has a same-name PNG (first frame); use it while animations are off. */
export function cosmeticUrl(path: string | undefined | null): string | null {
	const url = shopAssetUrl(path);
	if (!url || !cosmeticsStill()) return url;
	return url.replace(/\.svg(?=$|[?#])/i, '.png');
}

/** An <img> that falls back to the animated SVG if its still PNG is missing. */
const CosmeticImg: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => (
	<img
		alt=""
		{...props}
		onError={(event) => {
			const img = event.currentTarget;
			if (/\.png(?=$|[?#])/i.test(img.src) && !img.dataset.fallback) {
				img.dataset.fallback = '1';
				img.src = img.src.replace(/\.png(?=$|[?#])/i, '.svg');
			}
		}}
	/>
);

/** Smallest avatar that still gets its decoration (tiny avatars would only look noisy). */
export const MIN_DECORATED_AVATAR_SIZE = 24;

export function useWornCosmetics(userId: string | null | undefined): WornCosmetics {
	return ShopStore.getWorn(userId);
}

export function getAvatarDecorationUrl(userId: string | null | undefined, size: number): string | null {
	if (size < MIN_DECORATED_AVATAR_SIZE) return null;
	return cosmeticUrl(ShopStore.getWorn(userId).decoration?.asset);
}

export const AvatarDecorationImage: React.FC<{url: string}> = ({url}) => (
	<CosmeticImg
		key={url}
		className={styles.decoration}
		src={url}
		alt=""
		aria-hidden
		draggable={false}
		data-flx="chatflux.avatar-decoration"
	/>
);

export const NameplateBackground: React.FC<{nameplate?: WornCosmetic}> = observer(({nameplate}) => {
	const url = cosmeticUrl(nameplate?.asset);
	if (!url) return null;
	return (
		<span className={styles.nameplate} aria-hidden data-flx="chatflux.nameplate">
			<CosmeticImg key={url} src={url} alt="" draggable={false} />
		</span>
	);
});

/** Nameplate for a user, looked up from the shop store. */
export const UserNameplate: React.FC<{userId: string}> = observer(({userId}) => (
	<NameplateBackground nameplate={ShopStore.getWorn(userId).nameplate} />
));

export const nameplateContentClassName = styles.nameplateContent;

export const ProfileEffectLayer: React.FC<{effect?: WornCosmetic}> = observer(({effect}) => {
	const url = cosmeticUrl(effect?.asset);
	if (!url) return null;
	return (
		<div
			className={clsx(
				styles.effect,
				effect?.align === 'center' && styles.effectAlignCenter,
				effect?.align === 'bottom' && styles.effectAlignBottom,
			)}
			aria-hidden
			data-flx="chatflux.profile-effect"
		>
			<CosmeticImg key={url} src={url} alt="" draggable={false} />
		</div>
	);
});

export const ProfileFrameLayer: React.FC<{frame?: WornCosmetic}> = observer(({frame}) => {
	if (!frame) return null;
	const top = cosmeticUrl(frame.top);
	const bottom = cosmeticUrl(frame.bottom);
	const glowStyle = frame.color ? ({'--chatflux-frame-color': frame.color} as React.CSSProperties) : undefined;
	return (
		<>
			{frame.color && <div className={styles.frameGlow} style={glowStyle} aria-hidden />}
			{top && (
				<CosmeticImg
					key={top}
					className={styles.frameTop}
					src={top}
					alt=""
					aria-hidden
					draggable={false}
					data-flx="chatflux.frame-top"
				/>
			)}
			{bottom && (
				<CosmeticImg
					key={bottom}
					className={styles.frameBottom}
					src={bottom}
					alt=""
					aria-hidden
					draggable={false}
					data-flx="chatflux.frame-bottom"
				/>
			)}
		</>
	);
});

/** Effect + frame layered on a profile card (the card must be position: relative). */
export const ProfileCardCosmetics: React.FC<{worn: WornCosmetics}> = ({worn}) => (
	<>
		<ProfileEffectLayer effect={worn.effect} />
		<ProfileFrameLayer frame={worn.frame} />
	</>
);
