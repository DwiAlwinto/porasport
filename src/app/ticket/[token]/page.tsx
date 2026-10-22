import { redirect } from 'next/navigation';

export default async function TicketTokenRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/ticket/verify?token=${encodeURIComponent(token)}`);
}
