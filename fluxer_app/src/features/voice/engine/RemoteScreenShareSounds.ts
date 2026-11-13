// SPDX-License-Identifier: AGPL-3.0-or-later

// ChatFlux: play the screen share start/stop sound when someone else in the call starts or stops
// sharing their screen. Driven by the media room (LiveKit) instead of gateway voice states,
// because in DM / group calls the other side's self_stream change does not always arrive as a
// VOICE_STATE_UPDATE. Own screen shares already play these sounds from the screen share engine.

import {SoundType} from '@app/features/notification/utils/SoundUtils';
import * as SoundCommands from '@app/features/ui/commands/SoundCommands';
import {type RemoteParticipant, type RemoteTrackPublication, type Room, RoomEvent, Track} from 'livekit-client';

/** Ignore the burst of TrackPublished events for tracks that already existed when we joined. */
const JOIN_GRACE_MS = 2500;
/** A share can be republished (codec/quality migration); only a lasting stop counts. */
const STOP_CONFIRM_MS = 1500;

function hasScreenShare(participant: RemoteParticipant): boolean {
	for (const publication of participant.trackPublications.values()) {
		if (publication.source === Track.Source.ScreenShare) return true;
	}
	return false;
}

export function bindRemoteScreenShareSounds(room: Room): () => void {
	const boundAt = Date.now();
	const sharing = new Set<string>();
	const stopTimers = new Map<string, ReturnType<typeof setTimeout>>();
	for (const participant of room.remoteParticipants.values()) {
		if (hasScreenShare(participant)) sharing.add(participant.identity);
	}

	const clearStopTimer = (identity: string): void => {
		const timer = stopTimers.get(identity);
		if (timer === undefined) return;
		clearTimeout(timer);
		stopTimers.delete(identity);
	};

	const onTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant): void => {
		if (publication.source !== Track.Source.ScreenShare) return;
		const identity = participant.identity;
		clearStopTimer(identity);
		if (sharing.has(identity)) return;
		sharing.add(identity);
		if (Date.now() - boundAt < JOIN_GRACE_MS) return;
		SoundCommands.playSound(SoundType.ScreenShareStart);
	};

	const onTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant): void => {
		if (publication.source !== Track.Source.ScreenShare) return;
		const identity = participant.identity;
		if (!sharing.has(identity)) return;
		clearStopTimer(identity);
		stopTimers.set(
			identity,
			setTimeout(() => {
				stopTimers.delete(identity);
				const current = room.remoteParticipants.get(identity);
				// Left the call entirely: the leave sound covers it.
				if (!current) {
					sharing.delete(identity);
					return;
				}
				if (hasScreenShare(current)) return;
				sharing.delete(identity);
				SoundCommands.playSound(SoundType.ScreenShareStop);
			}, STOP_CONFIRM_MS),
		);
	};

	const onParticipantDisconnected = (participant: RemoteParticipant): void => {
		clearStopTimer(participant.identity);
		sharing.delete(participant.identity);
	};

	room.on(RoomEvent.TrackPublished, onTrackPublished);
	room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
	room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
	return () => {
		room.off(RoomEvent.TrackPublished, onTrackPublished);
		room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
		room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
		for (const timer of stopTimers.values()) clearTimeout(timer);
		stopTimers.clear();
	};
}
