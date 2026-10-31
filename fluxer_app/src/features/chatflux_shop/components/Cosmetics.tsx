// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/chatflux_shop/components/Cosmetics.module.css';
import {shopAssetUrl, type WornCosmetic, type WornCosmetics} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

/** Smallest avatar that still gets its decoration (tiny avatars would only look noisy). */
export const MIN_DECORATED_AVATAR_SIZE = 24;

export function useWornCosmetics(userId: string | null | undefined): WornCosmetics {
	return ShopStore.getWorn(userId);
}

export function getAvatarDecorationUrl(userId: string | null | undefined, size: number): string | null {
	if (size < MIN_DECORATED_AVATAR_SIZE) return null;
	return shopAssetUrl(ShopStore.getWorn(userId).decoration?.asset);
}

export const AvatarDecorationImage: React.FC<{url: string}> = ({url}) => (
	<img
		className={styles.decoration}
		src={url}
		alt=""
		aria-hidden
		draggable={false}
		data-flx="chatflux.avatar-decoration"
	/>
);

export const NameplateBackground: React.FC<{nameplate?: WornCosmetic}> = ({nameplate}) => {
	const url = shopAssetUrl(nameplate?.asset);
	if (!url) return null;
	return (
		<span className={styles.nameplate} aria-hidden data-flx="chatflux.nameplate">
			<img src={url} alt="" draggable={false} />
		</span>
	);
};

/** Nameplate for a user, looked up from the shop store. */
export const UserNameplate: React.FC<{userId: string}> = observer(({userId}) => (
	<NameplateBackground nameplate={ShopStore.getWorn(userId).nameplate} />
));

export const nameplateContentClassName = styles.nameplateContent;

export const ProfileEffectLayer: React.FC<{effect?: WornCosmetic}> = ({effect}) => {
	const url = shopAssetUrl(effect?.asset);
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
			<img src={url} alt="" draggable={false} />
		</div>
	);
};

export const ProfileFrameLayer: React.FC<{frame?: WornCosmetic}> = ({frame}) => {
	if (!frame) return null;
	const top = shopAssetUrl(frame.top);
	const bottom = shopAssetUrl(frame.bottom);
	const glowStyle = frame.color ? ({'--chatflux-frame-color': frame.color} as React.CSSProperties) : undefined;
	return (
		<>
			{frame.color && <div className={styles.frameGlow} style={glowStyle} aria-hidden />}
			{top && (
				<img className={styles.frameTop} src={top} alt="" aria-hidden draggable={false} data-flx="chatflux.frame-top" />
			)}
			{bottom && (
				<img
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
};

/** Effect + frame layered on a profile card (the card must be position: relative). */
export const ProfileCardCosmetics: React.FC<{worn: WornCosmetics}> = ({worn}) => (
	<>
		<ProfileEffectLayer effect={worn.effect} />
		<ProfileFrameLayer frame={worn.frame} />
	</>
);
