import React, { useState, useEffect } from 'react'

interface LoadingStateManagerProps {
  siteId: string;
  expectedSources: number; // Kaç tane data source bekleniyor
  allData: Map<string, any[]>;
  children: (isDataReady: boolean, dataLoadingProgress: number) => React.ReactNode;
}

export default function LoadingStateManager({ 
  siteId, 
  expectedSources, 
  allData, 
  children 
}: LoadingStateManagerProps) {
  const [dataLoadingProgress, setDataLoadingProgress] = useState(0)
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false)
  
  useEffect(() => {
    // Bu site için kaç source'un verisi geldi?
    const loadedSources = Array.from(allData.keys())
      .filter(key => key.startsWith(siteId + ':'))
      .length
    
    const progress = expectedSources > 0 ? (loadedSources / expectedSources) * 100 : 0
    setDataLoadingProgress(progress)
    
    // İlk yükleme tamamlandı mı?
    if (progress >= 100 && !isInitialLoadComplete) {
      // 500ms gecikme ile tamamlandı say (Firebase subscription stabilize olsun)
      setTimeout(() => {
        setIsInitialLoadComplete(true)
      }, 500)
    }
  }, [allData, siteId, expectedSources, isInitialLoadComplete])

  const isDataReady = isInitialLoadComplete

  return (
    <>
      {children(isDataReady, dataLoadingProgress)}
    </>
  )
}
