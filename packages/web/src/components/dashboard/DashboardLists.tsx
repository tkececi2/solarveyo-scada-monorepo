import { Site, InverterData } from '@/types'
import { formatPower, formatEnergy } from '@/utils/format'

interface DashboardListsProps {
  sites: Site[];
  allData: Map<string, InverterData[]>;
}

function ListCard({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 rounded-lg border border-gray-100 p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
      <span className="text-gray-700 truncate pr-2 font-medium">{left}</span>
      <span className="text-gray-900 font-bold">{right}</span>
    </div>
  )
}

function EmptyText({ text = 'Veri yok' }: { text?: string }) {
  return <div className="text-xs text-gray-400">{text}</div>
}

export default function DashboardLists({ sites, allData }: DashboardListsProps) {
  // Derive per-site aggregates
  const siteAgg = sites.map(site => {
    const invs = Array.from(allData.entries()).filter(([k]) => k.startsWith(site.id + ':')).flatMap(([_, arr]) => arr)
    const power = invs.reduce((s, i) => s + (i.activePower || 0), 0)
    const daily = invs.reduce((s, i) => s + (i.dailyYield || 0), 0)
    const faults = invs.filter(i => {
      const st = (i.status || '').toString().toLowerCase()
      return st.includes('fault') || st.includes('error') || st.includes('alarm') || st.includes('warning')
    }).length
    return { site, power, daily, faults }
  })

  const topPower = [...siteAgg].sort((a,b)=>b.power-a.power).slice(0,5)
  const topDaily = [...siteAgg].sort((a,b)=>b.daily-a.daily).slice(0,5)
  const faulty = [...siteAgg].filter(s=>s.faults>0).sort((a,b)=>b.faults-a.faults).slice(0,5)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ListCard title="En Yüksek Anlık Güç (Top 5)">
        {topPower.length === 0 ? (
          <EmptyText />
        ) : topPower.map(({site, power}) => (
          <Row key={site.id} left={site.name} right={formatPower(power)} />
        ))}
      </ListCard>
      <ListCard title="En Yüksek Günlük Üretim (Top 5)">
        {topDaily.length === 0 ? (
          <EmptyText />
        ) : topDaily.map(({site, daily}) => (
          <Row key={site.id} left={site.name} right={formatEnergy(daily)} />
        ))}
      </ListCard>
      <ListCard title="Çalışmayan Santraller (Top 5)">
        {faulty.length === 0 ? (
          <EmptyText text="Çalışmayan santral yok" />
        ) : faulty.map(({site, faults}) => (
          <Row key={site.id} left={site.name} right={`${faults} çalışmıyor`} />
        ))}
      </ListCard>
    </div>
  )
}
