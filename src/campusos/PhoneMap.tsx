import { CAMPUS, CAMPUS_TILES } from '../campusCamera'
import type { CampusPosition } from '../campusReturn'
import { worldLocations } from '../world'

export function PhoneMap({ position, currentBuilding }: { position?: CampusPosition, currentBuilding?: string }) {
  const buildings = Object.values(worldLocations)
  const current = currentBuilding ? worldLocations[currentBuilding] : undefined
  return <><div className="phone-app-heading"><h2>Карта</h2></div>
    <div className="phone-campus-map" role="img" aria-label="Мини-карта кампуса: главное здание, Backend, Frontend, Analytics и дорожки">
      <div className="phone-campus-tiles" aria-hidden="true">{CAMPUS_TILES.map(tile => <img key={tile} src={`/content/backgrounds/campus_main_${tile}.png`} alt="" />)}</div>
      <svg viewBox={`0 0 ${CAMPUS.width} ${CAMPUS.height}`} aria-hidden="true">
        {buildings.map((b, index) => <g key={b.slug} transform={`translate(${b.campusPortal.x} ${b.campusPortal.y})`}><circle r="26" className="map-building-dot"/><text textAnchor="middle" dy="10">{index + 1}</text></g>)}
        {position && <g transform={`translate(${position.x} ${position.y})`}><circle r="20" className="map-player-halo"/><circle r="10" className="map-player-dot"/></g>}
      </svg>
    </div>
    <p className="phone-map-position"><span className="map-player-key" /> {current ? `Вы в корпусе: ${current.label}` : position ? 'Вы на территории кампуса' : 'Положение появится после выхода в кампус'}</p>
    <div className="phone-map-legend">{buildings.map((b, i) => <div key={b.slug}><span>{i + 1}</span>{b.label}</div>)}</div>
  </>
}
