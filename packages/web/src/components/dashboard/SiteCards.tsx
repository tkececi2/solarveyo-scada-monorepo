import { Site, InverterData } from '@/types'
import { formatPower, formatEnergy } from '@/utils/format'
import FaultDisplaySystem from '../FaultDisplaySystem'
import LoadingStateManager from '../LoadingStateManager'

interface SiteCardsProps {
  sites: Site[];
  allData: Map<string, InverterData[]>;
}

function MiniStat({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className={`text-xs font-medium ${color} uppercase tracking-wide`}>{title}</div>
      <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
    </div>
  )
}

export default function SiteCards({ sites, allData }: SiteCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sites.map((site) => {
        const siteInverters = Array.from(allData.entries())
          .filter(([key]) => key.startsWith(site.id + ':'))
          .flatMap(([_, arr]) => arr)

        // VERİ YÜKLENDİ Mİ KONTROLÜ
        const hasDataLoaded = siteInverters.length > 0
        const isLoadingData = !hasDataLoaded

        const power = siteInverters.reduce((s, i) => s + (i.activePower || 0), 0)
        const daily = siteInverters.reduce((s, i) => s + (i.dailyYield || 0), 0)

        return (
          <LoadingStateManager
            key={site.id}
            siteId={site.id}
            expectedSources={site.sources.length}
            allData={allData}
          >
            {(isDataReady, loadingProgress) => (
              <div className="bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 rounded-lg border border-gray-100">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{site.location} • {site.capacityMWp} MWp • {site.systemType}</p>
                    </div>
                    <FaultDisplaySystem
                      inverterData={siteInverters}
                      siteName={site.name}
                      compact={true}
                      isLoading={!isDataReady}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <MiniStat title="Anlık Güç" value={isDataReady ? formatPower(power) : "..."} color="text-green-600"/>
                    <MiniStat title="Günlük" value={isDataReady ? formatEnergy(daily) : "..."} color="text-blue-600"/>
                    <MiniStat title="İnverter" value={isDataReady ? `${siteInverters.length}` : "..."} color="text-gray-600"/>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 font-medium">
                      {isDataReady ? (
                        <>Veri Kaynakları: {site.sources.map(s=>s.collection).join(', ')}</>
                      ) : (
                        <>📡 Veri yükleniyor... {loadingProgress.toFixed(0)}%</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </LoadingStateManager>
        )
      })}
    </div>
  )
}
