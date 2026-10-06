import { redirect } from 'next/navigation';

export default function AuditLogsRedirect() {
  redirect('/admin/audit');
}
