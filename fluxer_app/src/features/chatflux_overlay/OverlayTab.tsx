// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: Appearance → Overlay settings (in-game "who is talking" overlay, desktop app only).

import OverlaySettings, {type OverlayPosition} from '@app/features/chatflux_overlay/OverlaySettings';
import {tr} from '@app/features/chatflux_shop/ShopApi';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import type {RadioOption} from '@app/features/ui/radio_group/RadioGroup';
import {RadioGroup} from '@app/features/ui/radio_group/RadioGroup';
import styles from '@app/features/user/components/modals/tabs/appearance_tab/StreamerModeTab.module.css';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const OverlayTabContent: React.FC = observer(() => {
	const positionOptions: ReadonlyArray<RadioOption<OverlayPosition>> = [
		{
			value: 'top',
			name: tr('Fent', 'Top'),
			desc: tr('Vízszintes sor a bal felső sarokban.', 'A row in the top left corner.'),
		},
		{
			value: 'left',
			name: tr('Bal oldalt', 'Left'),
			desc: tr('Egymás alatt, a képernyő bal szélén.', 'Stacked on the left edge of the screen.'),
		},
		{
			value: 'right',
			name: tr('Jobb oldalt', 'Right'),
			desc: tr('Egymás alatt, a képernyő jobb szélén.', 'Stacked on the right edge of the screen.'),
		},
	];
	return (
		<div className={styles.container} data-flx="chatflux-overlay.tab.container">
			<Switch
				label={tr('Játékon belüli overlay', 'In-game overlay')}
				description={tr(
					'Hívás közben játék alatt mutatja, ki beszél. Ablakos és keret nélküli teljes képernyős módban működik.',
					'Shows who is talking while you play during a call. Works in windowed and borderless fullscreen mode.',
				)}
				value={OverlaySettings.enabled}
				onChange={OverlaySettings.setEnabled}
				data-flx="chatflux-overlay.tab.switch.enabled"
			/>
			<Switch
				label={tr('Saját magam mutatása', 'Show myself')}
				description={tr('Te is megjelensz az overlay-en.', 'You appear on the overlay too.')}
				value={OverlaySettings.showSelf}
				onChange={OverlaySettings.setShowSelf}
				disabled={!OverlaySettings.enabled}
				data-flx="chatflux-overlay.tab.switch.show-self"
			/>
			<fieldset className={styles.behaviorGroup} data-flx="chatflux-overlay.tab.position">
				<legend className={styles.behaviorLegend} data-flx="chatflux-overlay.tab.position-legend">
					{tr('Pozíció', 'Position')}
				</legend>
				<RadioGroup
					aria-label={tr('Overlay pozíciója', 'Overlay position')}
					options={positionOptions}
					value={OverlaySettings.position}
					onChange={(value) => OverlaySettings.setPosition(value)}
					disabled={!OverlaySettings.enabled}
					data-flx="chatflux-overlay.tab.radio-group.position"
				/>
			</fieldset>
		</div>
	);
});
