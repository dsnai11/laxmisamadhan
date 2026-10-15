import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Notification, Ticket, Comment, Approval } from '@types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinTicket: (ticketId: string) => void;
  leaveTicket: (ticketId: string) => void;
  onTicketUpdate: (callback: (data: any) => void) => () => void;
  onNewComment: (callback: (comment: Comment) => void) => () => void;
  onStatusChange: (callback: (data: { ticketId: string; status: string; oldStatus: string }) => void) => () => void;
  onAssignment: (callback: (data: { ticketId: string; assignee: any }) => void) => () => void;
  onSLAWarning: (callback: (data: any) => void) => () => void;
  onSLABreach: (callback: (data: any) => void) => () => void;
  onApprovalRequest: (callback: (approval: Approval) => void) => () => void;
  onApprovalResponse: (callback: (approval: Approval) => void) => () => void;
  onNotification: (callback: (notification: Notification) => void) => () => void;
  onTypingStart: (callback: (data: { userId: string; userName: string; isInternal: boolean }) => void) => () => void;
  onTypingStop: (callback: (userId: string) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(WS_URL, {
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, user]);

  const joinTicket = useCallback((ticketId: string) => {
    socket?.emit('join:ticket', ticketId);
  }, [socket]);

  const leaveTicket = useCallback((ticketId: string) => {
    socket?.emit('leave:ticket', ticketId);
  }, [socket]);

  const createListener = <T,>(event: string, callback: (data: T) => void) => {
    if (!socket) return () => {};

    socket.on(event, callback);
    return () => socket.off(event, callback);
  };

  const onTicketUpdate = useCallback((callback: (data: any) => void) => createListener('ticket:updated', callback), []);
  const onNewComment = useCallback((callback: (comment: Comment) => void) => createListener('comment:new', callback), []);
  const onStatusChange = useCallback((callback: (data: { ticketId: string; status: string; oldStatus: string }) => void) => createListener('ticket:status-changed', callback), []);
  const onAssignment = useCallback((callback: (data: { ticketId: string; assignee: any }) => void) => createListener('ticket:assigned', callback), []);
  const onSLAWarning = useCallback((callback: (data: any) => void) => createListener('sla:warning', callback), []);
  const onSLABreach = useCallback((callback: (data: any) => void) => createListener('sla:breached', callback), []);
  const onApprovalRequest = useCallback((callback: (approval: Approval) => void) => createListener('approval:requested', callback), []);
  const onApprovalResponse = useCallback((callback: (approval: Approval) => void) => createListener('approval:responded', callback), []);
  const onNotification = useCallback((callback: (notification: Notification) => void) => createListener('notification:new', callback), []);
  const onTypingStart = useCallback((callback: (data: { userId: string; userName: string; isInternal: boolean }) => void) => createListener('user:typing', callback), []);
  const onTypingStop = useCallback((callback: (userId: string) => void) => createListener('user:stopped-typing', callback), []);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      joinTicket,
      leaveTicket,
      onTicketUpdate,
      onNewComment,
      onStatusChange,
      onAssignment,
      onSLAWarning,
      onSLABreach,
      onApprovalRequest,
      onApprovalResponse,
      onNotification,
      onTypingStart,
      onTypingStop,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}