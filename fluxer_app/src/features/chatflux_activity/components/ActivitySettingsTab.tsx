// SPDX-License-Identifier: AGPL-3.0-or-later

import {SettingsSection} from '@app/features/app/components/dialogs/shared/SettingsSection';
import {SettingsTabContainer, SettingsTabContent} from '@app/features/app/components/dialogs/shared/SettingsTabLayout';
import {ActivityApi, type ActivitySettings, type RecentGame} from '@app/features/chatflux_activity/ActivityApi';
import ActivityDetector from '@app/features/chatflux_activity/ActivityDetector';
import styles from '@app/features/chatflux_activity/components/ActivitySettingsTab.module.css';
import {formatAgo, GameIcon} from '@app/features/chatflux_activity/components/GameActivity';
import {tr} from '@app/features/chatflux_shop/ShopApi';
import {GuildIcon} from '@app/features/guild/components/popouts/GuildIcon';
import Guilds from '@app/features/guild/state/Guilds';
import {Button} from '@app/features/ui/button/Button';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import {RadioGroup, type RadioOption} from '@app/features/ui/radio_group/RadioGroup';
import {GameControllerIcon, TrashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

type WindowProcess = {pid: number; name: string; title: string};

const SERVER_MODE_OPTIONS = (): Array<RadioOption<ActivitySettings['servers']>> => [
	{value: 'all', name: tr('Minden szerveren', 'Share in all servers')},
	{value: 'none', name: tr('Egyik szerveren se', 'Do not share in any servers')},
];

function lastPlayedLabel(lastPlayed: number | undefined, playingNow: boolean, now: number): string {
	if (playingNow) return tr('Most játszol vele', 'Playing now');
	if (!lastPlayed) return tr('Még nem játszottál vele', 'Not played yet');
	return tr(`Utoljára: ${formatAgo(lastPlayed, now)}`, `Last played ${formatAgo(lastPlayed, now)}`);
}

const AddGamePicker: React.FC<{onDone: () => void}> = observer(({onDone}) => {
	const [windows, setWindows] = useState<Array<WindowProcess> | null>(null);
	const [selected, setSelected] = useState('');
	const [name, setName] = useState('');
	useEffect(() => {
		let alive = true;
		ActivityDetector.listWindows().then((list) => {
			if (!alive) return;
			const seen = new Set<string>();
			setWindows(list.filter((w) => !seen.has(w.name) && seen.add(w.name)));
		});
		return () => {
			alive = false;
		};
	}, []);
	const handleSelect = (exe: string) => {
		setSelected(exe);
		const match = windows?.find((w) => w.name === exe);
		setName(match?.title || exe.replace(/\.exe$/, ''));
	};
	const handleAdd = () => {
		ActivityDetector.addCustom(selected, name);
		onDone();
	};
	return (
		<div className={styles.picker} data-flx="chatflux.activity-settings.add-game-picker">
			{windows == null ? (
				<div className={styles.muted}>{tr('Futó programok keresése…', 'Looking for running programs…')}</div>
			) : (
				<select
					className={styles.select}
					value={selected}
					onChange={(event) => handleSelect(event.target.value)}
					data-flx="chatflux.activity-settings.add-game-select"
				>
					<option value="">{tr('Válassz egy futó programot', 'Pick a running program')}</option>
					{windows.map((w) => (
						<option key={w.name} value={w.name}>
							{w.title ? `${w.title} (${w.name})` : w.name}
						</option>
					))}
				</select>
			)}
			{selected && (
				<input
					className={styles.input}
					value={name}
					maxLength={80}
					onChange={(event) => setName(event.target.value)}
					placeholder={tr('Játék neve', 'Game name')}
					data-flx="chatflux.activity-settings.add-game-name"
				/>
			)}
			<div className={styles.pickerActions}>
				<Button variant="secondary" small onClick={onDone}>
					{tr('Mégse', 'Cancel')}
				</Button>
				<Button small disabled={!selected || !name.trim()} onClick={handleAdd}>
					{tr('Hozzáadás', 'Add game')}
				</Button>
			</div>
		</div>
	);
});

const RegisteredGames: React.FC = observer(() => {
	const [adding, setAdding] = useState(false);
	const current = ActivityDetector.current;
	const list = ActivityDetector.registeredList;
	const now = Date.now();
	return (
		<>
			<div className={styles.currentBox} data-flx="chatflux.activity-settings.current-game">
				{current ? (
					<>
						<GameControllerIcon size={28} weight="fill" className={styles.currentIcon} />
						<div>
							<div className={styles.currentName}>{current.name}</div>
							<div className={styles.muted}>
								{ActivityDetector.registered[current.id]?.enabled === false
									? tr('Most játszol vele, de nem osztod meg.', 'Playing now, not shared.')
									: tr('Most játszol vele.', 'Playing now.')}
							</div>
						</div>
					</>
				) : (
					<div>
						<div className={styles.currentName}>{tr('Nincs felismert játék', 'No game detected')}</div>
						<div className={styles.muted}>
							{tr('Nem látod a játékodat? ', 'Not seeing your game? ')}
							<button type="button" className={styles.link} onClick={() => setAdding(true)}>
								{tr('Add hozzá!', 'Add it!')}
							</button>
						</div>
					</div>
				)}
			</div>
			{adding && <AddGamePicker onDone={() => setAdding(false)} />}
			{list.length > 0 && (
				<div className={styles.gameList} data-flx="chatflux.activity-settings.game-list">
					{list.map((game) => (
						<div key={game.id} className={styles.gameRow}>
							<div className={styles.gameText}>
								<div className={styles.gameName}>{game.name}</div>
								<div className={styles.muted}>{lastPlayedLabel(game.lastPlayed, current?.id === game.id, now)}</div>
							</div>
							{game.custom && (
								<button
									type="button"
									className={styles.iconButton}
									onClick={() => ActivityDetector.remove(game.id)}
									aria-label={tr('Eltávolítás', 'Remove')}
								>
									<TrashIcon size={16} />
								</button>
							)}
							<div className={styles.gameSwitch}>
								<Switch
									value={game.enabled}
									onChange={(value) => ActivityDetector.setEnabled(game.id, value)}
									aria-label={tr('Megosztás', 'Share')}
								/>
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
});

const ActivitySettingsTab: React.FC = observer(() => {
	const [settings, setSettings] = useState<ActivitySettings | null>(null);
	const [recent, setRecent] = useState<Array<RecentGame>>([]);
	const [error, setError] = useState(false);
	const [search, setSearch] = useState('');
	useEffect(() => {
		ActivityApi.settings()
			.then((res) => {
				setSettings(res.settings);
				setRecent(res.recent);
			})
			.catch(() => setError(true));
	}, []);
	const save = useCallback((body: Parameters<typeof ActivityApi.saveSettings>[0]) => {
		ActivityApi.saveSettings(body)
			.then((res) => {
				setSettings(res.settings);
				setRecent(res.recent);
				setError(false);
			})
			.catch(() => setError(true));
	}, []);
	const guilds = Guilds.getGuilds();
	const filteredGuilds = useMemo(() => {
		const query = search.trim().toLowerCase();
		return query ? guilds.filter((guild) => guild.name.toLowerCase().includes(query)) : guilds;
	}, [guilds, search]);
	const now = Date.now();

	return (
		<SettingsTabContainer>
			<SettingsTabContent>
				{error && (
					<div className={styles.error}>
						{tr(
							'Az aktivitás szolgáltatás most nem érhető el. Próbáld újra később.',
							'The activity service is not reachable right now. Try again later.',
						)}
					</div>
				)}
				<SettingsSection id="chatflux-activity-share" title={tr('Mit osztok meg', 'What activity I share')}>
					<Switch
						label={tr('Aktivitásom megosztása', 'Share my activity')}
						description={tr(
							'Mások látják, mivel játszol és mióta: a taglistában, a profilkártyádon és a profilodon. A játékokat a ChatFlux Windows alkalmazás ismeri fel.',
							'Others see what you play and for how long: in the member list, on your profile card and on your profile. Games are detected by the ChatFlux Windows app.',
						)}
						value={settings?.share ?? true}
						disabled={!settings}
						onChange={(share) => save({share})}
					/>
				</SettingsSection>

				<SettingsSection
					id="chatflux-activity-servers"
					title={tr('Hol osztom meg', 'Where I share activity')}
					description={tr(
						'Közvetlen üzenetekben és a barátaid felé mindig látszik, ha be van kapcsolva a megosztás.',
						'It always shows in direct messages and to friends while sharing is on.',
					)}
				>
					<RadioGroup
						options={SERVER_MODE_OPTIONS()}
						value={settings?.servers ?? 'all'}
						disabled={!settings || !settings.share}
						onChange={(servers) => save({servers})}
						aria-label={tr('Hol osztom meg', 'Where I share activity')}
					/>
					{guilds.length > 0 && (
						<>
							<input
								className={styles.input}
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder={tr('Szervereim keresése', 'Search my servers')}
								data-flx="chatflux.activity-settings.server-search"
							/>
							<div className={styles.guildList}>
								{filteredGuilds.map((guild) => {
									const override = settings?.guilds[guild.id];
									const value = override ?? settings?.servers !== 'none';
									return (
										<div key={guild.id} className={styles.guildRow}>
											<GuildIcon id={guild.id} name={guild.name} icon={guild.icon} sizePx={36} />
											<div className={styles.gameName}>{guild.name}</div>
											<div className={styles.gameSwitch}>
												<Switch
													value={Boolean(value)}
													disabled={!settings || !settings.share}
													onChange={(next) => save({guilds: {[guild.id]: next}})}
													aria-label={guild.name}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}
				</SettingsSection>

				<SettingsSection
					id="chatflux-activity-games"
					title={tr('Felismert játékok', 'Registered games')}
					description={
						ActivityDetector.supported
							? tr('Az itt kikapcsolt játékokat senki nem látja.', 'Games switched off here are never shown to anyone.')
							: tr(
									'A játékokat a ChatFlux Windows alkalmazás ismeri fel. A böngészőből nem látszik, mivel játszol.',
									'Games are detected by the ChatFlux Windows app. The browser cannot see what you play.',
								)
					}
				>
					{ActivityDetector.supported && <RegisteredGames />}
				</SettingsSection>

				<SettingsSection
					id="chatflux-activity-recent"
					title={tr('Legutóbbi aktivitás', 'Recent activity')}
					description={tr(
						'Az elmúlt 30 nap játékai a profilodon. Ha kikapcsolod a megosztást, ezt sem látja senki.',
						'Games from the last 30 days on your profile. When sharing is off, nobody sees this either.',
					)}
				>
					{recent.length === 0 ? (
						<div className={styles.muted}>{tr('Még nincs játék a listán.', 'No games yet.')}</div>
					) : (
						<div className={styles.gameList}>
							{recent.map((game) => (
								<div key={game.id} className={styles.gameRow}>
									<GameIcon icon={game.icon} name={game.name} size={36} />
									<div className={styles.gameText}>
										<div className={styles.gameName}>{game.name}</div>
										<div className={styles.muted}>{formatAgo(game.lastPlayed, now)}</div>
									</div>
								</div>
							))}
						</div>
					)}
					{recent.length > 0 && (
						<div>
							<Button
								variant="secondary"
								small
								onClick={() =>
									ActivityApi.clearRecent()
										.then((res) => setRecent(res.recent))
										.catch(() => setError(true))
								}
							>
								{tr('Lista törlése', 'Clear list')}
							</Button>
						</div>
					)}
				</SettingsSection>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});

export default ActivitySettingsTab;
