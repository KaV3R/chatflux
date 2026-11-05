// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GameActivity as GameActivityData, RecentGame} from '@app/features/chatflux_activity/ActivityApi';
import {useGameActivity, useNow, useRecentGames} from '@app/features/chatflux_activity/ActivityStore';
import styles from '@app/features/chatflux_activity/components/GameActivity.module.css';
import {shopAssetUrl, tr} from '@app/features/chatflux_shop/ShopApi';
import {GameControllerIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';

/** 49:36 or 1:02:05 */
export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** "5 perce", "3 napja" / "5m ago", "3d ago" */
export function formatAgo(timestamp: number, now = Date.now()): string {
	const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
	if (minutes < 1) return tr('épp most', 'just now');
	if (minutes < 60) return tr(`${minutes} perce`, `${minutes}m ago`);
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return tr(`${hours} órája`, `${hours}h ago`);
	const days = Math.floor(hours / 24);
	return tr(`${days} napja`, `${days}d ago`);
}

export const GameIcon: React.FC<{icon: string | null; name: string; size: number; className?: string}> = ({
	icon,
	name,
	size,
	className,
}) => {
	const [failed, setFailed] = useState(false);
	const src = !failed ? shopAssetUrl(icon) : null;
	return (
		<div
			className={clsx(styles.icon, className)}
			style={{width: size, height: size}}
			data-flx="chatflux.game-activity.icon"
		>
			{src ? (
				<img src={src} alt={name} draggable={false} onError={() => setFailed(true)} />
			) : (
				<GameControllerIcon size={Math.round(size * 0.55)} weight="fill" />
			)}
		</div>
	);
};

/** One line under the name in the member list: controller icon + game name. */
export const MemberListGameActivity: React.FC<{activity: GameActivityData; className?: string}> = ({
	activity,
	className,
}) => (
	<div
		className={clsx(styles.memberLine, className)}
		title={activity.name}
		data-flx="chatflux.game-activity.member-line"
	>
		<GameControllerIcon size={13} weight="fill" className={styles.memberLineIcon} />
		<span className={styles.memberLineText}>{activity.name}</span>
	</div>
);

const ElapsedTimer: React.FC<{startedAt: number}> = ({startedAt}) => {
	const now = useNow(1000);
	return (
		<span className={styles.elapsed} data-flx="chatflux.game-activity.elapsed">
			<GameControllerIcon size={13} weight="fill" />
			{formatElapsed(now - startedAt)}
		</span>
	);
};

/** "Playing" card with icon, game name and the time spent in the game. */
export const GameActivityCard: React.FC<{activity: GameActivityData; className?: string}> = ({activity, className}) => (
	<div className={clsx(styles.card, className)} data-flx="chatflux.game-activity.card">
		<div className={styles.cardLabel}>{tr('Játszik', 'Playing')}</div>
		<div className={styles.cardBody}>
			<GameIcon icon={activity.icon} name={activity.name} size={56} />
			<div className={styles.cardText}>
				<div className={styles.cardName}>{activity.name}</div>
				<ElapsedTimer startedAt={activity.startedAt} />
			</div>
		</div>
	</div>
);

/** The card for a user, or nothing when they are not playing (or do not share it here). */
export const UserGameActivity: React.FC<{userId: string; guildId?: string | null; className?: string}> = observer(
	({userId, guildId, className}) => {
		const activity = useGameActivity(userId, guildId);
		if (!activity) return null;
		return <GameActivityCard activity={activity} className={className} />;
	},
);

const RecentRow: React.FC<{game: RecentGame; now: number}> = ({game, now}) => (
	<div className={styles.recentRow} data-flx="chatflux.game-activity.recent-row">
		<GameIcon icon={game.icon} name={game.name} size={44} />
		<div className={styles.cardText}>
			<div className={styles.recentName}>{game.name}</div>
			<div className={clsx(styles.recentMeta, game.playing && styles.recentMetaPlaying)}>
				<GameControllerIcon size={12} weight="fill" />
				{game.playing ? tr('Most játszik', 'Playing now') : formatAgo(game.lastPlayed, now)}
			</div>
		</div>
	</div>
);

/** Games the user played in the last 30 days. */
export const RecentGamesSection: React.FC<{userId: string; guildId?: string | null}> = ({userId, guildId}) => {
	const recent = useRecentGames(userId, guildId);
	const now = useNow(60_000);
	if (recent.length === 0) return null;
	return (
		<div className={styles.recentSection} data-flx="chatflux.game-activity.recent-section">
			<div className={styles.recentTitle}>{tr('Legutóbbi aktivitás', 'Recent activity')}</div>
			<div className={styles.recentList}>
				{recent.map((game) => (
					<RecentRow key={game.id} game={game} now={now} />
				))}
			</div>
		</div>
	);
};
