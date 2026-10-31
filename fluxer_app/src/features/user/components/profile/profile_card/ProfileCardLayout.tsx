// SPDX-License-Identifier: AGPL-3.0-or-later

import {ProfileCardCosmetics} from '@app/features/chatflux_shop/components/Cosmetics';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import styles from '@app/features/user/components/profile/profile_card/ProfileCardLayout.module.css';
import {Trans} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface ProfileCardLayoutProps {
	borderColor: string;
	showPreviewLabel?: boolean;
	hoverRef?: (instance: HTMLDivElement | null) => void;
	className?: string;
	style?: React.CSSProperties;
	/** Whose ChatFlux Shop profile effect / frame to draw on the card. */
	cosmeticsUserId?: string | null;
	children: React.ReactNode;
}

export const ProfileCardLayout: React.FC<ProfileCardLayoutProps> = observer(
	({borderColor, showPreviewLabel = false, hoverRef, className, style, cosmeticsUserId, children}) => {
		const worn = ShopStore.getWorn(cosmeticsUserId);
		const frameColor = worn.frame?.color;
		const cardStyle = useMemo<React.CSSProperties>(
			() => ({...style, borderColor: frameColor ?? borderColor}),
			[borderColor, frameColor, style],
		);
		return (
			<div data-flx="user.profile.profile-card.profile-card-layout.div">
				{showPreviewLabel && (
					<div className={styles.previewLabel} data-flx="user.profile.profile-card.profile-card-layout.preview-label">
						<Trans>Profile preview</Trans>
					</div>
				)}
				<div
					ref={hoverRef}
					className={clsx(styles.profileCard, className)}
					style={cardStyle}
					data-flx="user.profile.profile-card.profile-card-layout.profile-card"
				>
					{children}
					<ProfileCardCosmetics worn={worn} />
				</div>
			</div>
		);
	},
);
