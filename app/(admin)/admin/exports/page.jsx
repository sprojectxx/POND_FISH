import { redirect } from 'next/navigation';

export default function ExportsRedirect() {
  redirect('/admin/reports');
}
