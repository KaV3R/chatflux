// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: leaves a DM / group DM call after you have been alone in it for 3 minutes
// (everyone else hung up and nobody is being rung). 15 seconds before, a toast warns you;
// clicking it keeps you in the call for another 3 minutes.

import {tr} from '@app/features/chatflux_shop/ShopApi';
import {Logger} from '@app/features/platform/utils/AppLogger';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import Users from '@app/features/user/state/Users';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import CallState from '@app/features/voice/state/CallState';
import {ME} from '@fluxer/constants/src/AppConstants';

const logger = new Logger('CallAloneAutoLeave');
const ALONE_LIMIT_MS = 3 * 60 * 1000;
const WARN_BEFORE_MS = 15 * 1000;
const CHECK_MS = 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let aloneChannelId: string | null = null;
let aloneSince = 0;
let warningToastId: string | null = null;

function clearWarning(): void {
	if (warningToastId) ToastCommands.destroyToast(warningToastId);
	warningToastId = null;
}

function reset(): void {
	aloneChannelId = null;
	aloneSince = 0;
	clearWarning();
}

function isAlone(channelId: string): boolean {
	const me = Users.getCurrentUser()?.id ?? null;
	const states = MediaEngine.getAllVoiceStatesInChannel(ME, channelId);
	if (Object.values(states).some((state) => state.user_id && state.user_id !== me)) return false;
	const ringing = CallState.getCall(channelId)?.ringing ?? [];
	// Still calling someone: the ring decides, not us.
	return !ringing.some((userId) => userId !== me);
}

function stay(): void {
	clearWarning();
	aloneSince = Date.now();
}

function check(): void {
	const channelId = MediaEngine.channelId;
	const inDmCall =
		MediaEngine.connected && channelId != null && (MediaEngine.guildId == null || MediaEngine.guildId === ME);
	if (!inDmCall || !isAlone(channelId)) {
		reset();
		return;
	}
	const now = Date.now();
	if (aloneChannelId !== channelId) {
		reset();
		aloneChannelId = channelId;
		aloneSince = now;
		return;
	}
	const elapsed = now - aloneSince;
	if (elapsed >= ALONE_LIMIT_MS) {
		logger.info('Alone in the call for 3 minutes, leaving', {channelId});
		reset();
		void MediaEngine.disconnectFromVoiceChannel('user');
		ToastCommands.createToast({
			type: 'info',
			children: tr(
				'Kiléptél a hívásból, mert 3 perce egyedül voltál benne.',
				'You left the call because you were alone in it for 3 minutes.',
			),
		});
		return;
	}
	if (elapsed >= ALONE_LIMIT_MS - WARN_BEFORE_MS && !warningToastId) {
		warningToastId = ToastCommands.createToast({
			type: 'info',
			timeout: WARN_BEFORE_MS + 2000,
			children: tr(
				'Egyedül vagy a hívásban, 15 másodperc múlva kilépsz. Kattints ide, ha maradnál.',
				'You are alone in the call and will leave in 15 seconds. Click here to stay.',
			),
			onClick: stay,
			onClose: () => {
				warningToastId = null;
			},
		});
	}
}

export function startCallAloneAutoLeave(): void {
	if (timer != null) return;
	timer = setInterval(() => {
		try {
			check();
		} catch (error) {
			logger.warn('Alone check failed', {error});
		}
	}, CHECK_MS);
}
