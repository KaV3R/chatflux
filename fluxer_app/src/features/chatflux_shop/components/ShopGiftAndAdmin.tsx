// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/chatflux_shop/components/ShopPage.module.css';
import {
	localize,
	type ShopAdminUser,
	ShopApi,
	ShopApiError,
	type ShopItem,
	tr,
} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import Relationships from '@app/features/relationship/state/Relationships';
import type {User} from '@app/features/user/models/User';
import Users from '@app/features/user/state/Users';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import * as NicknameUtils from '@app/features/user/utils/NicknameUtils';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {CoinVerticalIcon, GiftIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const ID_PATTERN = /^\d{5,20}$/;

function formatCoins(value: number): string {
	return value.toLocaleString('hu-HU');
}

function displayNameFor(userId: string, fallback?: string | null): string {
	const user = Users.getUser(userId);
	if (user) return NicknameUtils.getNickname(user, null);
	return fallback || userId;
}

export function giftErrorText(error: unknown): string {
	if (error instanceof ShopApiError) {
		switch (error.code) {
			case 'not_enough_coins':
				return tr('Nincs elég Cicaérméd ehhez.', "You don't have enough Cat Coins for this.");
			case 'recipient_owns':
				return tr('Ez már megvan neki.', 'They already own this.');
			case 'unknown_user':
				return tr('Nincs ilyen felhasználó.', 'No such user.');
			case 'gift_self':
				return tr('Magadnak nem küldhetsz ajándékot.', "You can't gift yourself.");
			case 'gift_bot':
				return tr('Botnak nem küldhetsz ajándékot.', "You can't gift a bot.");
			case 'bad_user':
				return tr('Hibás felhasználó ID.', 'Invalid user ID.');
			case 'forbidden':
				return tr('Ehhez nincs jogod.', "You're not allowed to do this.");
		}
		return tr(`Hiba történt (${error.status}).`, `Something went wrong (${error.status}).`);
	}
	return tr('A bolt most nem érhető el.', 'The shop is unavailable right now.');
}

/* ---------------------------------------------------------------- gift picker */

export const GiftPicker: React.FC<{item: ShopItem; onClose: () => void}> = observer(({item, onClose}) => {
	const [query, setQuery] = useState('');
	const [manualId, setManualId] = useState('');
	const [targetId, setTargetId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const busy = ShopStore.pendingSku != null;
	const balance = ShopStore.me?.balance ?? 0;

	const friends = useMemo(() => {
		const q = query.trim().toLowerCase();
		return Relationships.getRelationships()
			.filter((r) => r.type === RelationshipTypes.FRIEND)
			.map((r) => r.user)
			.filter((u): u is User => u != null)
			.filter((u) => q === '' || NicknameUtils.getNickname(u, null).toLowerCase().includes(q) || u.username.includes(q))
			.sort((a, b) => NicknameUtils.getNickname(a, null).localeCompare(NicknameUtils.getNickname(b, null)));
	}, [query]);

	const send = async () => {
		const target = targetId ?? (ID_PATTERN.test(manualId.trim()) ? manualId.trim() : null);
		if (!target) {
			setError(tr('Válassz egy barátot, vagy írj be egy felhasználó ID-t.', 'Pick a friend or enter a user ID.'));
			return;
		}
		setError(null);
		try {
			const result = await ShopStore.gift(item.sku, target);
			setSentTo(displayNameFor(target, result?.name));
		} catch (e) {
			setError(giftErrorText(e));
		}
	};

	if (sentTo) {
		return (
			<div className={styles.giftBox}>
				<div className={styles.giftDone}>
					<GiftIcon weight="fill" size={28} />
					{tr(`Elküldve ${sentTo} részére!`, `Sent to ${sentTo}!`)}
				</div>
				<button type="button" className={styles.secondaryButton} onClick={onClose}>
					{tr('Kész', 'Done')}
				</button>
			</div>
		);
	}

	return (
		<div className={styles.giftBox}>
			<div className={styles.giftTitle}>{tr('Kinek küldöd?', 'Who is it for?')}</div>
			<input
				className={styles.input}
				placeholder={tr('Barát keresése', 'Search friends')}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			<div className={styles.friendList}>
				{friends.length === 0 && (
					<div className={styles.friendEmpty}>{tr('Nincs találat a barátaid között.', 'No matching friends.')}</div>
				)}
				{friends.map((user) => (
					<button
						key={user.id}
						type="button"
						className={clsx(styles.friendRow, targetId === user.id && styles.friendRowActive)}
						onClick={() => {
							setTargetId(targetId === user.id ? null : user.id);
							setManualId('');
						}}
					>
						<img
							className={styles.friendAvatar}
							src={AvatarUtils.getUserAvatarURL({id: user.id, avatar: user.avatar}, false)}
							alt=""
						/>
						<span>{NicknameUtils.getNickname(user, null)}</span>
					</button>
				))}
			</div>
			<input
				className={styles.input}
				placeholder={tr('…vagy felhasználó ID', '…or a user ID')}
				value={manualId}
				inputMode="numeric"
				onChange={(event) => {
					setManualId(event.target.value.replace(/\D/g, ''));
					setTargetId(null);
				}}
			/>
			<button type="button" className={styles.primaryButton} disabled={busy || balance < item.price} onClick={send}>
				<GiftIcon weight="fill" size={18} />
				{tr(`Ajándékba küldöm – ${formatCoins(item.price)}`, `Send as a gift – ${formatCoins(item.price)}`)}
			</button>
			{item.type === 'bundle' && (
				<div className={styles.hint}>
					{tr(
						'Csomagnál csak azokért fizetsz, amik még nincsenek meg neki.',
						'For bundles you only pay for the pieces they are missing.',
					)}
				</div>
			)}
			<button type="button" className={styles.linkButton} onClick={onClose}>
				{tr('Mégse', 'Cancel')}
			</button>
			{error && <div className={styles.error}>{error}</div>}
		</div>
	);
});

/* ---------------------------------------------------------------- received gifts */

export const GiftNotice: React.FC = observer(() => {
	const gifts = ShopStore.me?.gifts ?? [];
	const [busy, setBusy] = useState(false);
	if (gifts.length === 0) return null;
	return (
		<div className={styles.giftNotice} data-flx="chatflux.shop.gift-notice">
			<GiftIcon weight="fill" size={28} className={styles.giftNoticeIcon} />
			<div className={styles.giftNoticeBody}>
				<div className={styles.giftNoticeTitle}>{tr('Ajándékot kaptál!', 'You got a gift!')}</div>
				{gifts.map((gift) => {
					const from = gift.from ? displayNameFor(gift.from, gift.fromName) : (gift.fromName ?? 'ChatFlux');
					const item = gift.sku ? ShopStore.itemBySku(gift.sku) : undefined;
					return (
						<div key={`${gift.at}-${gift.sku ?? gift.coins}`}>
							{item && tr(`${from} neked adta: ${localize(item.name)}`, `${from} gave you: ${localize(item.name)}`)}
							{!item &&
								gift.coins != null &&
								tr(
									`${from} ${formatCoins(gift.coins)} Cicaérmét írt jóvá neked.`,
									`${from} gave you ${formatCoins(gift.coins)} Cat Coins.`,
								)}
						</div>
					);
				})}
			</div>
			<button
				type="button"
				className={styles.secondaryButton}
				style={{padding: '0 1rem'}}
				disabled={busy}
				onClick={() => {
					setBusy(true);
					ShopStore.markGiftsSeen()
						.catch(() => {})
						.finally(() => setBusy(false));
				}}
			>
				{tr('Köszönöm!', 'Thanks!')}
			</button>
		</div>
	);
});

/* ---------------------------------------------------------------- admin */

export const ShopAdminPanel: React.FC = observer(() => {
	const [users, setUsers] = useState<Array<ShopAdminUser>>([]);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newId, setNewId] = useState('');
	const [amount, setAmount] = useState('500');
	const [sku, setSku] = useState('');
	const [message, setMessage] = useState<{ok: boolean; text: string} | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			const result = await ShopApi.adminUsers();
			setUsers(result.users);
			setLoadError(null);
		} catch (e) {
			setLoadError(giftErrorText(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return users
			.map((u) => ({...u, display: displayNameFor(u.userId, u.name)}))
			.filter((u) => q === '' || u.display.toLowerCase().includes(q) || u.userId.includes(q))
			.sort((a, b) => a.display.localeCompare(b.display));
	}, [users, query]);

	const selected = selectedId ? rows.find((u) => u.userId === selectedId) : undefined;
	const selectedName = selectedId ? displayNameFor(selectedId, selected?.name) : '';

	const grant = async (body: {coins?: number; sku?: string}) => {
		if (!selectedId) return;
		setBusy(true);
		setMessage(null);
		try {
			const result = await ShopApi.adminGrant({userId: selectedId, name: selectedName, ...body});
			setMessage({
				ok: true,
				text: tr(
					`Kész. ${selectedName} egyenlege: ${formatCoins(result.balance)}`,
					`Done. ${selectedName} now has ${formatCoins(result.balance)}`,
				),
			});
			if (selectedId === ShopStore.me?.userId) void ShopStore.loadMe();
			await load();
		} catch (e) {
			setMessage({ok: false, text: giftErrorText(e)});
		} finally {
			setBusy(false);
		}
	};

	const coins = Math.trunc(Number(amount));
	const coinsValid = Number.isFinite(coins) && coins > 0;

	return (
		<div className={styles.adminLayout} data-flx="chatflux.shop.admin">
			<div className={styles.adminList}>
				<div className={styles.listHeader}>
					<div className={styles.listTitle}>
						{tr('Felhasználók', 'Users')} ({users.length})
					</div>
				</div>
				<input
					className={styles.input}
					placeholder={tr('Keresés név vagy ID alapján', 'Search by name or ID')}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				<div className={styles.adminAddRow}>
					<input
						className={styles.input}
						placeholder={tr('Más felhasználó ID-ja', 'Another user ID')}
						value={newId}
						inputMode="numeric"
						onChange={(event) => setNewId(event.target.value.replace(/\D/g, ''))}
					/>
					<button
						type="button"
						className={styles.secondaryButton}
						style={{padding: '0 0.875rem'}}
						disabled={!ID_PATTERN.test(newId)}
						onClick={() => {
							setSelectedId(newId);
							setNewId('');
							setMessage(null);
						}}
					>
						{tr('Kiválaszt', 'Select')}
					</button>
				</div>
				{loadError && <div className={styles.error}>{loadError}</div>}
				<div className={styles.adminRows}>
					{rows.map((u) => (
						<button
							key={u.userId}
							type="button"
							className={clsx(styles.adminRow, selectedId === u.userId && styles.friendRowActive)}
							onClick={() => {
								setSelectedId(u.userId);
								setMessage(null);
							}}
						>
							<span className={styles.adminRowName}>
								{u.display}
								<span className={styles.adminRowId}>{u.userId}</span>
							</span>
							<span className={styles.adminRowBalance}>
								<CoinVerticalIcon weight="fill" className={styles.coin} size={14} />
								{formatCoins(u.balance)}
							</span>
						</button>
					))}
				</div>
			</div>
			<div className={styles.adminDetail}>
				{!selectedId ? (
					<div className={styles.empty}>{tr('Válassz egy felhasználót a listából.', 'Pick a user from the list.')}</div>
				) : (
					<>
						<div className={styles.modalType}>{tr('Kiválasztva', 'Selected')}</div>
						<div className={styles.adminSelectedName}>{selectedName}</div>
						<div className={styles.adminRowId}>{selectedId}</div>
						<div className={styles.adminBalance}>
							<CoinVerticalIcon weight="fill" className={styles.coin} size={20} />
							{selected ? formatCoins(selected.balance) : tr('még nincs fiókja a boltban', 'no shop account yet')}
						</div>

						<div className={styles.filterTitle}>{tr('Cicaérme', 'Cat Coins')}</div>
						<input
							className={styles.input}
							value={amount}
							inputMode="numeric"
							onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
						/>
						<div className={styles.adminButtons}>
							<button
								type="button"
								className={styles.primaryButton}
								disabled={busy || !coinsValid}
								onClick={() => grant({coins})}
							>
								+ {tr('Jóváírás', 'Add')}
							</button>
							<button
								type="button"
								className={styles.secondaryButton}
								disabled={busy || !coinsValid}
								onClick={() => grant({coins: -coins})}
							>
								− {tr('Levonás', 'Remove')}
							</button>
						</div>

						<div className={styles.filterTitle}>{tr('Tárgy odaadása', 'Give an item')}</div>
						<select className={styles.select} value={sku} onChange={(event) => setSku(event.target.value)}>
							<option value="">{tr('Válassz…', 'Choose…')}</option>
							{ShopStore.items.map((item) => (
								<option key={item.sku} value={item.sku}>
									{localize(item.name)}
								</option>
							))}
						</select>
						<button type="button" className={styles.primaryButton} disabled={busy || !sku} onClick={() => grant({sku})}>
							<GiftIcon weight="fill" size={18} />
							{tr('Odaadom ingyen', 'Give for free')}
						</button>
						{message && <div className={message.ok ? styles.success : styles.error}>{message.text}</div>}
					</>
				)}
			</div>
		</div>
	);
});
