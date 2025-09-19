interface StatCardProps {
  title: string;
  value: string;
  icon: any;
  color: string;
}

export default function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  // Kurumsal renkler için sadece icon rengi kullanılacak
  const iconColorMap: { [key: string]: string } = {
    'bg-blue-500': 'text-blue-600',
    'bg-green-500': 'text-green-600', 
    'bg-indigo-500': 'text-indigo-600',
    'bg-yellow-500': 'text-yellow-600',
    'bg-red-500': 'text-red-600'
  }

  return (
    <div className="bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 rounded-lg border border-gray-100">
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 bg-gray-50 rounded-lg flex items-center justify-center">
              <Icon className={`h-6 w-6 ${iconColorMap[color] || 'text-gray-600'}`} />
            </div>
          </div>
          <div className="ml-4 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-600 uppercase tracking-wide truncate">
                {title}
              </dt>
              <dd className="text-2xl font-bold text-gray-900 mt-1">
                {value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
