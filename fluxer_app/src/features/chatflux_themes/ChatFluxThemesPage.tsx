// SPDX-License-Identifier: AGPL-3.0-or-later

import {tr} from '@app/features/chatflux_shop/ShopApi';
import {
	applyChatFluxTheme,
	CHATFLUX_THEMES,
	type ChatFluxThemeDefinition,
	getActiveChatFluxThemeId,
	resetChatFluxTheme,
} from '@app/features/chatflux_themes/ChatFluxThemes';
import styles from '@app/features/chatflux_themes/ChatFluxThemesPage.module.css';
import ThemeLibrary from '@app/features/theme/state/ThemeLibrary';
import ThemeSettingsState from '@app/features/theme_settings/state/ThemeSettingsState';
import {Scroller} from '@app/features/ui/components/Scroller';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useState} from 'react';

function pick(text: {hu: string; en: string}): string {
	return tr(text.hu, text.en);
}

function buttonLabel(busy: boolean, active: boolean): string {
	if (busy) return tr('Pillanat…', 'One moment…');
	if (active) return tr('Aktív – kikapcsolás', 'Active – turn off');
	return tr('Alkalmazás', 'Apply');
}

function ThemePreview({theme}: {theme: ChatFluxThemeDefinition}) {
	const p = theme.palette;
	return (
		<div className={styles.preview} style={{background: p.frame}} aria-hidden>
			<div className={styles.previewGuilds}>
				<span className={styles.previewGuild} style={{background: p.brand}} />
				<span className={styles.previewGuild} style={{background: p.guildItem}} />
				<span className={styles.previewGuild} style={{background: p.guildItem}} />
			</div>
			<div className={styles.previewSidebar} style={{background: p.sidebar}}>
				<span className={styles.previewLine} style={{background: p.textFaint, width: '70%'}} />
				<span className={styles.previewChannel} style={{background: `${p.tint}26`}}>
					<span className={styles.previewLine} style={{background: p.text, width: '60%'}} />
				</span>
				<span className={styles.previewLine} style={{background: p.textFaint, width: '55%'}} />
				<span className={styles.previewLine} style={{background: p.textFaint, width: '65%'}} />
			</div>
			<div className={styles.previewChat} style={{background: p.surface}}>
				<div className={styles.previewHeader} style={{background: p.header}}>
					<span className={styles.previewLine} style={{background: p.text, width: '35%'}} />
				</div>
				<div className={styles.previewMessages}>
					{[0.62, 0.8, 0.48].map((width, index) => (
						<div key={width} className={styles.previewMessage}>
							<span className={styles.previewAvatar} style={{background: index === 1 ? p.brand : p.elevated}} />
							<div className={styles.previewMessageBody}>
								<span
									className={styles.previewLine}
									style={{background: index === 1 ? p.link : p.text, width: '30%'}}
								/>
								<span className={styles.previewLine} style={{background: p.textMuted, width: `${width * 100}%`}} />
							</div>
						</div>
					))}
				</div>
				<div className={styles.previewInput} style={{background: p.input}}>
					<span className={styles.previewSend} style={{background: p.brand}} />
				</div>
			</div>
			<span className={styles.previewEmoji}>{theme.emoji}</span>
		</div>
	);
}

export const ChatFluxThemesPage = observer(function ChatFluxThemesPage() {
	const [busyId, setBusyId] = useState<string | null>(null);
	useEffect(() => {
		void ThemeLibrary.init();
	}, []);
	const activeId = ThemeLibrary.isHydrated ? getActiveChatFluxThemeId() : null;
	const run = async (id: string, action: () => Promise<void>) => {
		setBusyId(id);
		try {
			await action();
		} finally {
			setBusyId(null);
		}
	};
	return (
		<div className={styles.container}>
			<Scroller>
				<div className={styles.content}>
					<header className={styles.hero}>
						<h1 className={styles.title}>{tr('Témák', 'Themes')}</h1>
						<p className={styles.subtitle}>
							{tr(
								'Válassz egy ChatFlux témát, és az egész alkalmazás új színekbe öltözik. Egyszerre egy téma lehet aktív.',
								'Pick a ChatFlux theme to give the whole app a new look. One theme can be active at a time.',
							)}
						</p>
						{ThemeSettingsState.customCssOff && (
							<p className={styles.warning}>
								{tr(
									'Az egyéni CSS jelenleg ki van kapcsolva, ezért a témák nem látszanak.',
									'Custom CSS is currently turned off, so themes will not show.',
								)}
							</p>
						)}
					</header>
					<div className={styles.grid}>
						{CHATFLUX_THEMES.map((theme) => {
							const active = activeId === theme.id;
							const busy = busyId === theme.id;
							return (
								<article
									key={theme.id}
									className={clsx(styles.card, active && styles.cardActive)}
									style={{'--theme-accent': theme.palette.brand} as React.CSSProperties}
								>
									<ThemePreview theme={theme} />
									<div className={styles.cardBody}>
										<div className={styles.cardTitleRow}>
											<h2 className={styles.cardTitle}>{pick(theme.name)}</h2>
											{theme.badge && <span className={styles.badge}>{pick(theme.badge)}</span>}
										</div>
										<p className={styles.cardDescription}>{pick(theme.description)}</p>
										<div className={styles.swatches} aria-hidden>
											{[theme.palette.frame, theme.palette.surface, theme.palette.brand, theme.palette.link].map(
												(color) => (
													<span key={color} className={styles.swatch} style={{background: color}} />
												),
											)}
										</div>
										<button
											type="button"
											className={clsx(styles.button, active && styles.buttonActive)}
											disabled={busyId !== null || !ThemeLibrary.isHydrated}
											onClick={() =>
												void run(theme.id, () => (active ? resetChatFluxTheme() : applyChatFluxTheme(theme)))
											}
										>
											{buttonLabel(busy, active)}
										</button>
									</div>
								</article>
							);
						})}
					</div>
					{activeId !== null && (
						<button
							type="button"
							className={styles.resetButton}
							disabled={busyId !== null}
							onClick={() => void run('reset', resetChatFluxTheme)}
						>
							{tr('Vissza az alap témára', 'Back to the default theme')}
						</button>
					)}
				</div>
			</Scroller>
		</div>
	);
});
