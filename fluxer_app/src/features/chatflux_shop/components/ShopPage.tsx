// SPDX-License-Identifier: AGPL-3.0-or-later

import {GiftNotice, GiftPicker, ShopAdminPanel} from '@app/features/chatflux_shop/components/ShopGiftAndAdmin';
import {ShopItemPreview} from '@app/features/chatflux_shop/components/ShopItemPreview';
import styles from '@app/features/chatflux_shop/components/ShopPage.module.css';
import {
	localize,
	ShopApiError,
	type ShopCollection,
	type ShopItem,
	type ShopItemType,
	type ShopSlot,
	shopAssetUrl,
	tr,
} from '@app/features/chatflux_shop/ShopApi';
import ShopStore from '@app/features/chatflux_shop/ShopStore';
import {
	CheckCircleIcon,
	CoinVerticalIcon,
	GiftIcon,
	MagnifyingGlassIcon,
	StorefrontIcon,
	XIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

type Tab = 'featured' | 'browse' | 'owned' | 'admin';
type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

const TYPE_ORDER: Array<ShopItemType> = ['decoration', 'nameplate', 'effect', 'frame', 'bundle'];
const SLOTS: Array<ShopSlot> = ['decoration', 'nameplate', 'effect', 'frame'];

function typeLabel(type: ShopItemType, plural = false): string {
	switch (type) {
		case 'decoration':
			return plural ? tr('Avatar díszek', 'Avatar Decorations') : tr('Avatar dísz', 'Avatar Decoration');
		case 'nameplate':
			return plural ? tr('Névtáblák', 'Nameplates') : tr('Névtábla', 'Nameplate');
		case 'effect':
			return plural ? tr('Profil effektek', 'Profile Effects') : tr('Profil effekt', 'Profile Effect');
		case 'frame':
			return plural ? tr('Profilkeretek', 'Profile Frames') : tr('Profilkeret', 'Profile Frame');
		case 'bundle':
			return plural ? tr('Csomagok', 'Bundles') : tr('Csomag', 'Bundle');
	}
}

function formatCoins(value: number): string {
	return value.toLocaleString('hu-HU');
}

function errorText(error: unknown): string {
	if (error instanceof ShopApiError) {
		switch (error.code) {
			case 'not_enough_coins':
				return tr('Nincs elég Cicaérméd ehhez.', "You don't have enough Cat Coins for this.");
			case 'already_owned':
				return tr('Ez már a tiéd.', 'You already own this.');
			case 'not_owned':
				return tr('Ezt még nem vetted meg.', "You don't own this yet.");
			case 'unauthorized':
				return tr('Jelentkezz be újra.', 'Please log in again.');
		}
		return tr(`Hiba történt (${error.status}).`, `Something went wrong (${error.status}).`);
	}
	return tr('A bolt most nem érhető el. Próbáld újra később.', 'The shop is unavailable right now. Try again later.');
}

const Price: React.FC<{item: ShopItem}> = observer(({item}) => {
	const price = ShopStore.priceFor(item);
	const pieces = (item.contains ?? []).reduce((sum, sku) => sum + (ShopStore.itemBySku(sku)?.price ?? 0), 0);
	const showDiscount = item.type === 'bundle' && pieces > price;
	return (
		<>
			<CoinVerticalIcon weight="fill" className={styles.coin} size={16} />
			<span>{formatCoins(price)}</span>
			{showDiscount && (
				<>
					<span className={styles.strike}>{formatCoins(pieces)}</span>
					<span className={styles.discount}>-{Math.round((1 - price / pieces) * 100)}%</span>
				</>
			)}
		</>
	);
});

const ItemCard: React.FC<{item: ShopItem; onOpen: (item: ShopItem) => void}> = observer(({item, onOpen}) => {
	const owned = ShopStore.owns(item.sku);
	const equipped = ShopStore.isEquipped(item);
	return (
		<button type="button" className={styles.card} onClick={() => onOpen(item)} data-flx="chatflux.shop.item-card">
			{item.badge && <span className={styles.badge}>{localize(item.badge)}</span>}
			{owned && (
				<span className={clsx(styles.ownedBadge, equipped && styles.ownedBadgeEquipped)}>
					<CheckCircleIcon weight="fill" size={12} />
					{equipped ? tr('Viseled', 'Equipped') : tr('Megvéve', 'Owned')}
				</span>
			)}
			<div className={styles.cardPreview}>
				<ShopItemPreview item={item} />
			</div>
			<div className={styles.cardFooter}>
				<div className={styles.cardName}>{localize(item.name)}</div>
				<div className={styles.cardPrice}>{owned ? <span>{typeLabel(item.type)}</span> : <Price item={item} />}</div>
			</div>
		</button>
	);
});

const ItemModal: React.FC<{item: ShopItem; onClose: () => void}> = observer(({item, onClose}) => {
	const [error, setError] = useState<string | null>(null);
	const [gifting, setGifting] = useState(false);
	const owned = ShopStore.owns(item.sku);
	const equipped = ShopStore.isEquipped(item);
	const busy = ShopStore.pendingSku != null;
	const balance = ShopStore.me?.balance ?? 0;
	const price = ShopStore.priceFor(item);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	const run = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(errorText(e));
		}
	};

	const buy = () => run(() => ShopStore.purchase(item.sku));
	const toggleEquip = () => {
		if (item.type === 'bundle') return;
		const slot = item.type;
		return run(() => ShopStore.equip(slot, equipped ? null : item.sku));
	};
	const equipBundle = () =>
		run(async () => {
			for (const sku of item.contains ?? []) {
				const piece = ShopStore.itemBySku(sku);
				if (piece && piece.type !== 'bundle') await ShopStore.equip(piece.type, piece.sku);
			}
		});

	let actions: React.ReactNode;
	if (gifting) {
		actions = <GiftPicker item={item} onClose={() => setGifting(false)} />;
	} else if (ShopStore.meState === 'error' && !ShopStore.me) {
		actions = <div className={styles.error}>{errorText(null)}</div>;
	} else if (!owned) {
		const affordable = balance >= price;
		actions = (
			<>
				<button type="button" className={styles.primaryButton} disabled={busy || !affordable} onClick={buy}>
					<CoinVerticalIcon weight="fill" size={18} />
					{tr(`Megveszem – ${formatCoins(price)}`, `Buy for ${formatCoins(price)}`)}
				</button>
				{!affordable && (
					<div className={styles.error}>
						{tr(
							`Még ${formatCoins(price - balance)} Cicaérme hiányzik.`,
							`You need ${formatCoins(price - balance)} more Cat Coins.`,
						)}
					</div>
				)}
			</>
		);
	} else if (item.type === 'bundle') {
		actions = (
			<button type="button" className={styles.primaryButton} disabled={busy} onClick={equipBundle}>
				{tr('Mindet felveszem', 'Equip all')}
			</button>
		);
	} else {
		actions = (
			<button
				type="button"
				className={equipped ? styles.secondaryButton : styles.primaryButton}
				disabled={busy}
				onClick={toggleEquip}
			>
				{equipped ? tr('Leveszem', 'Unequip') : tr('Felveszem', 'Equip')}
			</button>
		);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: clicking the dimmed backdrop closes the dialog; Escape works too
		<div
			className={styles.backdrop}
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
			data-flx="chatflux.shop.item-modal"
		>
			<div className={styles.modal} role="dialog" aria-modal="true" aria-label={localize(item.name)}>
				<button type="button" className={styles.closeButton} onClick={onClose} aria-label={tr('Bezárás', 'Close')}>
					<XIcon size={18} />
				</button>
				<div className={styles.modalPreview}>
					<ShopItemPreview item={item} size="large" />
				</div>
				<div className={styles.modalInfo}>
					<div className={styles.modalType}>{typeLabel(item.type)}</div>
					<div className={styles.modalName}>{localize(item.name)}</div>
					{item.description && <div className={styles.modalDescription}>{localize(item.description)}</div>}
					{item.type === 'bundle' && (
						<div className={styles.bundleList}>
							{(item.contains ?? []).map((sku) => {
								const piece = ShopStore.itemBySku(sku);
								if (!piece) return null;
								const pieceOwned = ShopStore.owns(sku);
								return (
									<div key={sku} className={styles.bundlePiece}>
										{pieceOwned && <CheckCircleIcon weight="fill" size={14} className={styles.pieceOwned} />}
										<span>{localize(piece.name)}</span>
									</div>
								);
							})}
						</div>
					)}
					{!owned && (
						<div className={styles.modalPrice}>
							<Price item={item} />
						</div>
					)}
					<div className={styles.modalSpacer} />
					<div className={styles.modalActions}>
						{actions}
						{!gifting && ShopStore.me && (
							<button type="button" className={styles.secondaryButton} onClick={() => setGifting(true)}>
								<GiftIcon weight="fill" size={18} />
								{tr('Ajándékba adom valakinek', 'Gift it to someone')}
							</button>
						)}
						{error && <div className={styles.error}>{error}</div>}
					</div>
				</div>
			</div>
		</div>
	);
});

function sortItems(items: Array<ShopItem>, sort: SortKey): Array<ShopItem> {
	const sorted = [...items];
	switch (sort) {
		case 'price-asc':
			return sorted.sort((a, b) => a.price - b.price);
		case 'price-desc':
			return sorted.sort((a, b) => b.price - a.price);
		case 'name':
			return sorted.sort((a, b) => localize(a.name).localeCompare(localize(b.name)));
		default:
			return sorted.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
	}
}

const Hero: React.FC<{collection: ShopCollection; onShop: () => void}> = ({collection, onShop}) => {
	const banner = shopAssetUrl(collection.banner);
	const style = collection.accent ? ({'--hero-accent': collection.accent} as React.CSSProperties) : undefined;
	return (
		<div className={styles.hero} style={style} data-flx="chatflux.shop.hero">
			{banner && <img className={styles.heroArt} src={banner} alt="" draggable={false} />}
			<div className={styles.heroText}>
				{collection.tagline && <div className={styles.heroTagline}>{localize(collection.tagline)}</div>}
				<div className={styles.heroTitle}>{localize(collection.name)}</div>
				{collection.description && <div className={styles.heroDescription}>{localize(collection.description)}</div>}
			</div>
			<button type="button" className={styles.heroButton} onClick={onShop}>
				{tr('Kollekció megtekintése', 'Shop the collection')}
			</button>
		</div>
	);
};

export const ShopPage: React.FC = observer(() => {
	const [tab, setTab] = useState<Tab>('featured');
	const [types, setTypes] = useState<Set<ShopItemType>>(new Set());
	const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
	const [sort, setSort] = useState<SortKey>('featured');
	const [search, setSearch] = useState('');
	const [openSku, setOpenSku] = useState<string | null>(null);

	useEffect(() => {
		void ShopStore.loadCatalog();
		void ShopStore.loadMe();
	}, []);

	const openItem = useCallback((item: ShopItem) => setOpenSku(item.sku), []);
	const closeItem = useCallback(() => setOpenSku(null), []);
	const openedItem = openSku ? ShopStore.itemBySku(openSku) : undefined;

	const allItems = ShopStore.items;
	const collections = ShopStore.catalog?.collections ?? [];
	const featuredCollection = collections.find((c) => c.featured) ?? collections[0];

	const browseTo = (filter: {types?: Array<ShopItemType>; collection?: string | null}) => {
		setTypes(new Set(filter.types ?? []));
		setCollectionFilter(filter.collection ?? null);
		setTab('browse');
	};

	const toggleType = (type: ShopItemType) => {
		setTypes((prev) => {
			const next = new Set(prev);
			if (next.has(type)) next.delete(type);
			else next.add(type);
			return next;
		});
	};

	const query = search.trim().toLowerCase();
	const browseItems = useMemo(() => {
		const filtered = allItems.filter(
			(item) =>
				(types.size === 0 || types.has(item.type)) &&
				(collectionFilter == null || item.collection === collectionFilter) &&
				(query === '' || localize(item.name).toLowerCase().includes(query)),
		);
		return sortItems(filtered, sort);
	}, [allItems, types, collectionFilter, query, sort]);

	const ownedItems = allItems.filter((item) => item.type !== 'bundle' && ShopStore.owns(item.sku));

	let listTitle = tr('Minden termék', 'All items');
	if (types.size === 1) listTitle = typeLabel([...types][0], true);
	else if (collectionFilter) {
		const c = collections.find((col) => col.id === collectionFilter);
		if (c) listTitle = localize(c.name);
	}

	let body: React.ReactNode;
	if (ShopStore.catalogState === 'error') {
		body = (
			<div className={styles.empty}>
				{errorText(null)}
				<div style={{marginTop: '1rem'}}>
					<button
						type="button"
						className={styles.secondaryButton}
						style={{margin: '0 auto', padding: '0 1rem'}}
						onClick={() => ShopStore.loadCatalog(true)}
					>
						{tr('Újrapróbálom', 'Retry')}
					</button>
				</div>
			</div>
		);
	} else if (!ShopStore.catalog) {
		body = <div className={styles.empty}>{tr('Bolt betöltése…', 'Loading the shop…')}</div>;
	} else if (tab === 'featured') {
		const featured = allItems.filter((item) => item.featured && item.type !== 'bundle');
		const bundles = allItems.filter((item) => item.type === 'bundle');
		body = (
			<>
				{featuredCollection && (
					<Hero collection={featuredCollection} onShop={() => browseTo({collection: featuredCollection.id})} />
				)}
				{featured.length > 0 && (
					<section className={styles.section}>
						<div className={styles.sectionHeader}>
							<div className={styles.sectionTitle}>{tr('Kiemelt', 'Featured')}</div>
						</div>
						<div className={styles.grid}>
							{featured.map((item) => (
								<ItemCard key={item.sku} item={item} onOpen={openItem} />
							))}
						</div>
					</section>
				)}
				{bundles.length > 0 && (
					<section className={styles.section}>
						<div className={styles.sectionHeader}>
							<div className={styles.sectionTitle}>{typeLabel('bundle', true)}</div>
						</div>
						<div className={styles.grid}>
							{bundles.map((item) => (
								<ItemCard key={item.sku} item={item} onOpen={openItem} />
							))}
						</div>
					</section>
				)}
				{SLOTS.map((type) => {
					const items = allItems.filter((item) => item.type === type);
					if (items.length === 0) return null;
					return (
						<section key={type} className={styles.section}>
							<div className={styles.sectionHeader}>
								<div className={styles.sectionTitle}>{typeLabel(type, true)}</div>
								<button type="button" className={styles.linkButton} onClick={() => browseTo({types: [type]})}>
									{tr(`Mind (${items.length})`, `See all (${items.length})`)}
								</button>
							</div>
							<div className={styles.grid}>
								{items.slice(0, 4).map((item) => (
									<ItemCard key={item.sku} item={item} onOpen={openItem} />
								))}
							</div>
						</section>
					);
				})}
			</>
		);
	} else if (tab === 'browse') {
		body = (
			<div className={styles.browseLayout}>
				<div className={styles.browseMain}>
					<div className={styles.listHeader}>
						<div className={styles.listTitle}>
							{listTitle} ({browseItems.length})
						</div>
						<select
							className={styles.select}
							value={sort}
							onChange={(event) => setSort(event.target.value as SortKey)}
							aria-label={tr('Rendezés', 'Sort by')}
						>
							<option value="featured">{tr('Népszerű', 'Popular')}</option>
							<option value="price-asc">{tr('Ár szerint növekvő', 'Price: low to high')}</option>
							<option value="price-desc">{tr('Ár szerint csökkenő', 'Price: high to low')}</option>
							<option value="name">{tr('Név szerint', 'Name')}</option>
						</select>
					</div>
					{browseItems.length === 0 ? (
						<div className={styles.empty}>{tr('Nincs találat.', 'Nothing found.')}</div>
					) : (
						<div className={styles.grid}>
							{browseItems.map((item) => (
								<ItemCard key={item.sku} item={item} onOpen={openItem} />
							))}
						</div>
					)}
				</div>
				<aside className={styles.filters}>
					<div className={styles.filterTitle}>{tr('Csak ezek', 'Show only')}</div>
					{TYPE_ORDER.map((type) => (
						<label key={type} className={styles.check}>
							<input type="checkbox" checked={types.has(type)} onChange={() => toggleType(type)} />
							{typeLabel(type, true)}
						</label>
					))}
					{collections.length > 0 && (
						<>
							<div className={styles.filterTitle}>{tr('Kollekciók', 'Collections')}</div>
							<div className={styles.chips}>
								{collections.map((c) => (
									<button
										key={c.id}
										type="button"
										className={clsx(styles.chip, collectionFilter === c.id && styles.chipActive)}
										onClick={() => setCollectionFilter(collectionFilter === c.id ? null : c.id)}
									>
										{localize(c.name)}
									</button>
								))}
							</div>
						</>
					)}
					<button
						type="button"
						className={styles.clearButton}
						onClick={() => {
							setTypes(new Set());
							setCollectionFilter(null);
							setSearch('');
						}}
					>
						{tr('Szűrők törlése', 'Clear all filters')}
					</button>
				</aside>
			</div>
		);
	} else if (tab === 'admin' && ShopStore.me?.isAdmin) {
		body = <ShopAdminPanel />;
	} else {
		body = (
			<>
				<div className={styles.listHeader}>
					<div className={styles.listTitle}>{tr('Amit most viselsz', 'Currently wearing')}</div>
				</div>
				<div className={styles.wearing}>
					{SLOTS.map((slot) => {
						const sku = ShopStore.me?.equipped[slot];
						const item = sku ? ShopStore.itemBySku(sku) : undefined;
						return (
							<div key={slot} className={styles.wearingSlot}>
								<div>
									<div className={styles.wearingLabel}>{typeLabel(slot)}</div>
									<div>{item ? localize(item.name) : tr('Nincs', 'None')}</div>
								</div>
								{item && (
									<button
										type="button"
										className={styles.linkButton}
										disabled={ShopStore.pendingSku != null}
										onClick={() => void ShopStore.equip(slot, null).catch(() => {})}
									>
										{tr('Leveszem', 'Remove')}
									</button>
								)}
							</div>
						);
					})}
				</div>
				<div className={styles.listHeader}>
					<div className={styles.listTitle}>
						{tr('Gyűjteményem', 'My collection')} ({ownedItems.length})
					</div>
				</div>
				{ownedItems.length === 0 ? (
					<div className={styles.empty}>
						{tr('Még nincs semmid. Nézz körül a boltban!', "You don't own anything yet. Take a look around the shop!")}
					</div>
				) : (
					<div className={styles.grid}>
						{ownedItems.map((item) => (
							<ItemCard key={item.sku} item={item} onOpen={openItem} />
						))}
					</div>
				)}
			</>
		);
	}

	return (
		<div className={styles.layout} data-flx="chatflux.shop.layout">
			<div className={styles.topBar}>
				<StorefrontIcon weight="fill" className={styles.topIcon} />
				<div className={styles.tabs} role="tablist">
					{(
						[
							['featured', tr('Kiemelt', 'Featured')],
							['browse', tr('Böngészés', 'Browse')],
							['owned', tr('Gyűjteményem', 'My collection')],
							...(ShopStore.me?.isAdmin ? [['admin', 'Admin']] : []),
						] as Array<[Tab, string]>
					).map(([id, label]) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							className={clsx(styles.tab, tab === id && styles.tabActive)}
							onClick={() => {
								if (id === 'browse') browseTo({});
								else setTab(id);
							}}
						>
							{label}
						</button>
					))}
				</div>
				<div className={styles.topSpacer} />
				<label className={styles.search}>
					<MagnifyingGlassIcon size={14} />
					<input
						value={search}
						placeholder={tr('Keresés a boltban', 'Search the shop')}
						onChange={(event) => {
							setSearch(event.target.value);
							if (tab !== 'browse') setTab('browse');
						}}
					/>
				</label>
				<div className={styles.balance} title={localize(ShopStore.catalog?.currency) || 'Cicaérme'}>
					<CoinVerticalIcon weight="fill" className={styles.coin} size={18} />
					{ShopStore.me ? formatCoins(ShopStore.me.balance) : '–'}
				</div>
			</div>
			<div className={styles.scroller}>
				<div className={styles.content}>
					{ShopStore.me == null && ShopStore.meState === 'error' && ShopStore.catalog && (
						<div className={styles.notice}>
							{tr(
								'Nem sikerült betölteni a fiókodat a boltban, ezért most csak nézelődni tudsz.',
								'Could not load your shop account, so you can only browse for now.',
							)}
						</div>
					)}
					<GiftNotice />
					{body}
				</div>
			</div>
			{openedItem && <ItemModal item={openedItem} onClose={closeItem} />}
		</div>
	);
});
