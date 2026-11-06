// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: CALL_CREATE / CALL_UPDATE carry the full voice states of a DM call, but only the
// call's participant list used them. After a reconnect (e.g. restarting the app for an update)
// the voice engine therefore did not know who was already in the call: the other person was
// missing from the call view and the call looked like an outgoing ring with no way to rejoin.
// This feeds those voice states into the voice engine as well.

import type {CallVoiceState, VoiceState} from '@app/features/gateway/types/GatewayVoiceTypes';
import Users from '@app/features/user/state/Users';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import {startCallAloneAutoLeave} from '@app/features/voice/events/CallAloneAutoLeave';
import {startCallParticipantHeal} from '@app/features/voice/events/CallParticipantHeal';
import {ME} from '@fluxer/constants/src/AppConstants';

type FullCallVoiceState = CallVoiceState & {connection_id?: string};

/**
 * @param prune also removes voice states in this call that the gateway no longer lists
 *   (only safe for CALL_CREATE, which is a full snapshot sent on connect).
 */
export function syncCallVoiceStates(
	channelId: string,
	voiceStates: ReadonlyArray<CallVoiceState> | undefined,
	prune: boolean,
): void {
	startCallParticipantHeal();
	startCallAloneAutoLeave();
	if (!voiceStates) return;
	const me = Users.getCurrentUser()?.id ?? null;
	// This device's own connection is managed by the local voice engine. Our other devices
	// (e.g. the desktop app while this is the browser) are fed in, so the call shows
	// "in the call on another device" with a button to join here.
	const localConnectionId = MediaEngine.connectionId;
	const isLocal = (userId: string | undefined, connectionId: string) =>
		userId === me && localConnectionId != null && connectionId === localConnectionId;
	const known = MediaEngine.getAllVoiceStatesInChannel(ME, channelId);
	const listed = new Set<string>();
	for (const raw of voiceStates as ReadonlyArray<FullCallVoiceState>) {
		const connectionId = raw.connection_id;
		if (!connectionId || !raw.user_id) continue;
		listed.add(connectionId);
		if (isLocal(raw.user_id, connectionId)) continue;
		if (known[connectionId]?.channel_id === channelId) continue;
		MediaEngine.handleGatewayVoiceStateUpdate(null, {
			mute: false,
			deaf: false,
			self_mute: false,
			self_deaf: false,
			self_video: false,
			self_stream: false,
			...raw,
			// Same shape as a DM VOICE_STATE_UPDATE: no guild.
			guild_id: null,
			channel_id: channelId,
			connection_id: connectionId,
		} as unknown as VoiceState);
	}
	if (!prune) return;
	for (const [connectionId, state] of Object.entries(known)) {
		if (listed.has(connectionId) || isLocal(state.user_id, connectionId)) continue;
		MediaEngine.handleGatewayVoiceStateUpdate(null, {...state, channel_id: null} as unknown as VoiceState);
	}
}
