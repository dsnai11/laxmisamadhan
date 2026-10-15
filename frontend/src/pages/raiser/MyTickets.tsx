import { Link } from 'react-router-dom';
import api from '@services/api';
import TicketListPage from '@components/tickets/TicketListPage';

export default function MyTickets() {
  return (
    <TicketListPage
      title="My Tickets"
      subtitle="Everything you have raised, and where it stands"
      queryKey="my-tickets-list"
      fetcher={(params) => api.getMyTickets(params)}
      basePath="/raiser/tickets"
      showAssignee
      emptyMessage="You have not raised any tickets yet."
      actions={<Link to="/raiser/create-ticket" className="btn-primary">New ticket</Link>}
    />
  );
}
