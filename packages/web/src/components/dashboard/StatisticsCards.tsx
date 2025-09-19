import { Building2, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import StatCard from './StatCard'
import { formatPower, formatEnergy, formatNumberTR } from '@/utils/format'

interface StatisticsCardsProps {
  totalSites: number;
  totalCapacity: number;
  summary: {
    dailyProduction: number;
    totalPower: number;
    faultCount: number;
  };
}

export default function StatisticsCards({ 
  totalSites, 
  totalCapacity, 
  summary 
}: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Toplam Santral"
        value={totalSites.toString()}
        icon={Building2}
        color="bg-blue-500"
      />
      <StatCard
        title="Toplam Kapasite"
        value={`${formatNumberTR(totalCapacity, 1)} MWp`}
        icon={Zap}
        color="bg-green-500"
      />
      <StatCard
        title="Günlük Üretim"
        value={formatEnergy(summary.dailyProduction)}
        icon={Zap}
        color="bg-indigo-500"
      />
      <StatCard
        title="Anlık Güç"
        value={formatPower(summary.totalPower)}
        icon={TrendingUp}
        color="bg-yellow-500"
      />
      <StatCard
        title="Çalışmayan Sayısı"
        value={summary.faultCount.toString()}
        icon={AlertTriangle}
        color="bg-red-500"
      />
    </div>
  )
}
