// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: feeds the desktop in-game overlay with the current call (who is in it, who is talking,
// who is muted / deafened). The overlay is shown only while a game is detected, the user is in a
// call and the ChatFlux window itself is not focused.

import ActivityDetector from '@app/features/chatflux_activity/ActivityDetector';
import OverlaySettings from '@app/features/chatflux_overlay/OverlaySettings';
import {getElectronAPI} from '@app/features/ui/utils/NativeUtils';
import Users from '@app/features/user/state/Users';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import * as NicknameUtils from '@app/features/user/utils/NicknameUtils';
import {resolveVoiceParticipantAvatarEntryVoiceState} from '@app/features/voice/components/VoiceParticipantDisplayState';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import LocalVoiceState from '@app/features/voice/state/LocalVoiceState';
import {isParticipantVoicePermissionMuted} from '@app/features/voice/utils/VoicePermissionUtils';
import {ME} from '@fluxer/constants/src/AppConstants';

const TICK_MS = 150;

interface OverlayParticipant {
	id: string;
	name: string;
	avatar: string | null;
	speaking: boolean;
	muted: boolean;
	deafened: boolean;
}

interface OverlayState {
	visible: boolean;
	position: 'top' | 'left' | 'right';
	participants: Array<OverlayParticipant>;
}

let started = false;
let lastSent = '';
let sending = false;

function absoluteHttpUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		const absolute = new URL(url, window.location.href);
		return absolute.protocol === 'https:' || absolute.protocol === 'http:' ? absolute.href : null;
	} catch {
		return null;
	}
}

function collectParticipants(guildId: string | null, channelId: string): Array<OverlayParticipant> {
	const currentUserId = Users.currentUser?.id ?? null;
	const localSelfMute = LocalVoiceState.getSelfMute();
	const localSelfDeaf = LocalVoiceState.getSelfDeaf();
	const byUser = new Map<string, OverlayParticipant>();
	for (const [connectionId, voiceState] of Object.entries(
		MediaEngine.getAllVoiceStatesInChannel(guildId ?? ME, channelId),
	)) {
		const userId = voiceState.user_id;
		if (!userId) continue;
		if (!OverlaySettings.showSelf && userId === currentUserId) continue;
		const user = Users.getUser(userId);
		if (!user) continue;
		const isLocal = connectionId === MediaEngine.connectionId;
		const snapshot = MediaEngine.getParticipantByUserIdAndConnectionId(userId, connectionId) ?? null;
		const permissionMuted = isParticipantVoicePermissionMuted({
			voiceState,
			guildId,
			channelId,
			isCurrentUser: userId === currentUserId,
		});
		const state = resolveVoiceParticipantAvatarEntryVoiceState({
			snapshot: {...(snapshot ?? {}), isLocal},
			voiceState,
			permissionMuted,
			localEffectiveSelfMute: localSelfMute,
			localSelfDeaf,
		});
		const existing = byUser.get(userId);
		if (existing) {
			// Same user on several devices: talking on any of them counts.
			existing.speaking = existing.speaking || state.speaking;
			existing.muted = existing.muted && state.selfMute;
			existing.deafened = existing.deafened && state.selfDeaf;
			continue;
		}
		byUser.set(userId, {
			id: userId,
			name: guildId ? NicknameUtils.getNickname(user, guildId) : NicknameUtils.getNickname(user, null, channelId),
			avatar: absoluteHttpUrl(AvatarUtils.getUserAvatarURL({id: user.id, avatar: user.avatar}, false)),
			speaking: state.speaking,
			muted: state.selfMute,
			deafened: state.selfDeaf,
		});
	}
	return [...byUser.values()];
}

function buildState(): OverlayState {
	const position = OverlaySettings.position;
	const channelId = MediaEngine.channelId;
	const inCall = MediaEngine.connected && channelId != null;
	const gameRunning = ActivityDetector.current != null;
	const appFocused = typeof document !== 'undefined' && document.hasFocus();
	if (!OverlaySettings.enabled || !inCall || !gameRunning || appFocused || !channelId) {
		return {visible: false, position, participants: []};
	}
	return {visible: true, position, participants: collectParticipants(MediaEngine.guildId, channelId)};
}

async function tick(): Promise<void> {
	const api = getElectronAPI();
	if (!api?.chatfluxOverlayUpdate || sending) return;
	let state: OverlayState;
	try {
		state = buildState();
	} catch {
		state = {visible: false, position: OverlaySettings.position, participants: []};
	}
	const serialized = JSON.stringify(state);
	if (serialized === lastSent) return;
	sending = true;
	try {
		await api.chatfluxOverlayUpdate(state);
		lastSent = serialized;
	} catch {
		// Older desktop shell without the overlay, or a transient IPC error: retry next tick.
	} finally {
		sending = false;
	}
}

export function startOverlayBridge(): void {
	if (started || !OverlaySettings.supported) return;
	started = true;
	setInterval(() => void tick(), TICK_MS);
}
