type Status = 'added' | 'already_member' | 'not_found' | 'error' | 'pending'

const config: Record<Status, { label: string; className: string }> = {
  added: { label: 'Added', className: 'bg-green-100 text-green-800' },
  already_member: { label: 'Already Member', className: 'bg-violet-100 text-violet-800' },
  not_found: { label: 'Not Found', className: 'bg-red-100 text-red-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800' },
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = config[status as Status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
