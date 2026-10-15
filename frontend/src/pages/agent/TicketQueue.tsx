import TicketQueue from '@components/tickets/TicketQueue';

export default function AgentTicketQueue() {
  return <TicketQueue basePath="/agent/tickets" title="Ticket Queue" subtitle="Tickets in your department. Take an unassigned ticket to start working on it." />;
}
