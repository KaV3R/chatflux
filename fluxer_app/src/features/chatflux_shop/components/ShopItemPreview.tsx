// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	AvatarDecorationImage,
	NameplateBackground,
	ProfileCardCosmetics,
} from '@app/features/chatflux_shop/components/Cosmetics';
import styles from '@app/features/chatflux_shop/components/ShopItemPreview.module.css';
import {type ShopItem, shopAssetUrl, type WornCosmetic, type WornCosmetics} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import Users from '@app/features/user/state/Users';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import * as NicknameUtils from '@app/features/user/utils/NicknameUtils';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

type PreviewSize = 'small' | 'large';

function useMe(): {avatarUrl: string | null; name: string} {
	const user = Users.currentUser;
	if (!user) return {avatarUrl: null, name: 'ChatFlux'};
	return {
		avatarUrl: AvatarUtils.getUserAvatarURL({id: user.id, avatar: user.avatar}, false),
		name: NicknameUtils.getNickname(user, null),
	};
}

function asWorn(item: ShopItem): WornCosmetic {
	return {sku: item.sku, ...item.render};
}

/** Everything a bundle contains, worn at once. */
function bundleWorn(item: ShopItem): WornCosmetics {
	const worn: WornCosmetics = {};
	for (const sku of item.contains ?? []) {
		const piece = ShopStore.itemBySku(sku);
		if (piece && piece.type !== 'bundle') worn[piece.type] = asWorn(piece);
	}
	return worn;
}

const DecoratedAvatar: React.FC<{decoration?: WornCosmetic; px: number; avatarUrl: string | null}> = ({
	decoration,
	px,
	avatarUrl,
}) => {
	const decorationUrl = shopAssetUrl(decoration?.asset);
	return (
		<div className={styles.avatarWrap} style={{width: px, height: px}}>
			{avatarUrl ? (
				<img className={styles.avatar} src={avatarUrl} alt="" draggable={false} />
			) : (
				<div className={styles.avatar} />
			)}
			{decorationUrl && <AvatarDecorationImage url={decorationUrl} />}
		</div>
	);
};

const NameplateRows: React.FC<{nameplate?: WornCosmetic; size: PreviewSize}> = ({nameplate, size}) => {
	const me = useMe();
	const rowClass = clsx(styles.row, size === 'large' && styles.rowLarge);
	return (
		<div className={styles.rows}>
			<div className={clsx(rowClass, styles.rowFaded)}>
				<div className={styles.rowAvatar} />
				<div className={styles.skeleton} style={{width: '45%'}} />
			</div>
			<div className={rowClass}>
				<NameplateBackground nameplate={nameplate} />
				{me.avatarUrl ? (
					<img className={styles.rowAvatar} src={me.avatarUrl} alt="" />
				) : (
					<div className={styles.rowAvatar} />
				)}
				<span className={styles.rowName}>{me.name}</span>
			</div>
			<div className={clsx(rowClass, styles.rowFaded)}>
				<div className={styles.rowAvatar} />
				<div className={styles.skeleton} style={{width: '60%'}} />
			</div>
		</div>
	);
};

const MiniProfileCard: React.FC<{worn: WornCosmetics; size: PreviewSize}> = ({worn, size}) => {
	const me = useMe();
	const decorationUrl = shopAssetUrl(worn.decoration?.asset);
	return (
		<div
			className={clsx(styles.card, size === 'large' ? styles.cardLarge : styles.cardSmall)}
			style={worn.frame?.color ? {borderColor: worn.frame.color} : undefined}
		>
			<div className={styles.cardBanner} />
			<div className={styles.cardAvatar}>
				{me.avatarUrl ? <img className={styles.avatar} src={me.avatarUrl} alt="" /> : <div className={styles.avatar} />}
				{decorationUrl && <AvatarDecorationImage url={decorationUrl} />}
			</div>
			<div className={styles.cardBody}>
				<span className={styles.cardName}>{me.name}</span>
				{worn.nameplate ? (
					<div className={styles.cardNameplate}>
						<NameplateBackground nameplate={worn.nameplate} />
						<div className={styles.skeleton} style={{width: '55%'}} />
					</div>
				) : (
					<div className={styles.skeleton} style={{width: '55%'}} />
				)}
				<div className={styles.skeleton} style={{width: '85%'}} />
				<div className={styles.skeleton} style={{width: '70%'}} />
			</div>
			<ProfileCardCosmetics worn={worn} />
		</div>
	);
};

export const ShopItemPreview: React.FC<{item: ShopItem; size?: PreviewSize}> = observer(({item, size = 'small'}) => {
	const me = useMe();
	switch (item.type) {
		case 'decoration':
			return <DecoratedAvatar decoration={asWorn(item)} px={size === 'large' ? 176 : 96} avatarUrl={me.avatarUrl} />;
		case 'nameplate':
			return <NameplateRows nameplate={asWorn(item)} size={size} />;
		case 'effect':
			return <MiniProfileCard worn={{effect: asWorn(item)}} size={size} />;
		case 'frame':
			return <MiniProfileCard worn={{frame: asWorn(item)}} size={size} />;
		case 'bundle':
			return <MiniProfileCard worn={bundleWorn(item)} size={size} />;
		default:
			return null;
	}
});
