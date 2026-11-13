// SPDX-License-Identifier: AGPL-3.0-or-later

import {SystemMessage} from '@app/features/channel/components/SystemMessage';
import {SystemMessageUsername} from '@app/features/channel/components/SystemMessageUsername';
import {tr} from '@app/features/chatflux_shop/ShopApi';
import {useSystemMessageData} from '@app/features/messaging/hooks/useSystemMessageData';
import type {Message} from '@app/features/messaging/models/MessagingMessage';
import styles from '@app/features/theme/styles/Message.module.css';
import Users from '@app/features/user/state/Users';
import {IdentificationCardIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface ChatFluxNicknameChangeMessageProps {
	message: Message;
}

/** ChatFlux: "<actor> changed <target>'s nickname to <nick>" in group DMs. */
export const ChatFluxNicknameChangeMessage = observer(({message}: ChatFluxNicknameChangeMessageProps) => {
	const {author, channel, guild} = useSystemMessageData(message);
	if (!channel) {
		return null;
	}
	const targetId = message.mentions.length > 0 ? message.mentions[0].id : null;
	const target = targetId ? Users.getUser(targetId) : null;
	const isSelf = targetId === author.id;
	const newNick = (message.content ?? '').trim();
	const actorNode = (
		<SystemMessageUsername
			key={author.id}
			author={author}
			guild={guild}
			message={message}
			data-flx="channel.chatflux-nickname-change-message.actor"
		/>
	);
	const targetNode =
		target && !isSelf ? (
			<SystemMessageUsername
				key={target.id}
				author={target}
				guild={guild}
				message={message}
				data-flx="channel.chatflux-nickname-change-message.target"
			/>
		) : null;
	const nickNode = (
		<span
			className={styles.systemMessageLink}
			style={{cursor: 'text', textDecoration: 'none'}}
			data-flx="channel.chatflux-nickname-change-message.nick"
		>
			{newNick}
		</span>
	);

	let messageContent: React.ReactNode;
	if (isSelf || !targetNode) {
		const who = isSelf ? tr('a saját becenevét', 'their nickname') : tr('valaki becenevét', "someone's nickname");
		messageContent = newNick ? (
			<>
				{actorNode} {tr(`átváltotta ${who} erre:`, `changed ${who} to`)} {nickNode}.
			</>
		) : (
			<>
				{actorNode} {tr(`visszaállította ${who}.`, `reset ${who}.`)}
			</>
		);
	} else {
		messageContent = newNick ? (
			<>
				{actorNode} {tr('átváltotta', 'changed')} {targetNode}
				{tr(' becenevét erre:', "'s nickname to")} {nickNode}.
			</>
		) : (
			<>
				{actorNode} {tr('visszaállította', 'reset')} {targetNode}
				{tr(' becenevét.', "'s nickname.")}
			</>
		);
	}

	return (
		<SystemMessage
			icon={IdentificationCardIcon}
			iconWeight="bold"
			message={message}
			messageContent={messageContent}
			data-flx="channel.chatflux-nickname-change-message.system-message"
		/>
	);
});
