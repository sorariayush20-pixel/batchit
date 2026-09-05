import React from 'react';
import { CallModal } from './CallModal';
import { ActiveCallState, User } from '../types';
import { Socket } from 'socket.io-client';

interface VoiceCallModalProps {
  callState: ActiveCallState;
  currentUser: User;
  socket: Socket | null;
  onAcceptCall: () => void;
  onRejectCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo?: () => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = (props) => {
  return (
    <CallModal
      {...props}
      onToggleVideo={props.onToggleVideo || (() => {})}
    />
  );
};
