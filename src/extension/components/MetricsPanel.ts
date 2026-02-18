/**
 * Metrics Panel
 * Displays floorplan statistics: summary, unit mix, and egress compliance
 */

import { FloorPlanData, UnitType, DynamicUnitType } from '../../algorithm/types';
import { FEET_TO_METERS } from '../../algorithm/constants';

// Default colors for legacy unit types (using Forma Data Labels palette)
const DEFAULT_UNIT_COLORS: Record<UnitType, string> = {
  [UnitType.Studio]: '#A0D4DC',   // data-blue
  [UnitType.OneBed]: '#D0E1A4',   // data-green
  [UnitType.TwoBed]: '#F5C297',   // data-orange
  [UnitType.ThreeBed]: '#D9DDFC'  // data-purple
};

// Default labels for legacy unit types
const DEFAULT_UNIT_LABELS: Record<UnitType, string> = {
  [UnitType.Studio]: 'Studios',
  [UnitType.OneBed]: '1-Bedroom',
  [UnitType.TwoBed]: '2-Bedroom',
  [UnitType.ThreeBed]: '3-Bedroom'
};

// Convert square meters to square feet for display
function sqMetersToSqFeet(sqMeters: number): number {
  return sqMeters / (FEET_TO_METERS * FEET_TO_METERS);
}

// Convert meters to feet
function metersToFeet(meters: number): number {
  return meters / FEET_TO_METERS;
}

// Format number with commas
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString();
}

/**
 * Render the complete metrics panel HTML
 * @param floorplan The floor plan data to display
 * @param unitTypes Optional array of dynamic unit types for flexible rendering
 */
export function renderMetricsPanel(floorplan: FloorPlanData, unitTypes?: DynamicUnitType[], stories = 1): string {
  const { stats, egress } = floorplan;

  // Convert areas to square feet for display
  const gsfFeet = sqMetersToSqFeet(stats.gsf);
  const nrsfFeet = sqMetersToSqFeet(stats.nrsf);
  const totalGsfFeet = gsfFeet * stories;
  const totalNrsfFeet = nrsfFeet * stories;
  const totalUnits = stats.totalUnits * stories;

  // Calculate unit percentages (works with both string keys and UnitType enum)
  const unitPercentages: Record<string, number> = {};

  if (stats.totalUnits > 0) {
    Object.entries(stats.unitCounts).forEach(([type, count]) => {
      unitPercentages[type] = Math.round((count / stats.totalUnits) * 100);
    });
  }

  // Convert egress distances to feet
  const deadEndFeet = Math.round(metersToFeet(egress.maxDeadEnd));
  const travelDistFeet = Math.round(metersToFeet(egress.maxTravelDistance));

  return `
    <div class="metrics-panel" style="padding: 16px; font-family: var(--forma-font-family, 'Artifakt Element', -apple-system, sans-serif); font-size: 11px;">

      <!-- Summary Section -->
      <div class="metrics-section" style="margin-bottom: 16px;">
        <div class="section-header" style="
          font-size: 11px;
          font-weight: 600;
          color: #747474;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #D9D9D9;
        ">Summary</div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">Stories</span>
          <span style="font-weight: 600; color: #3C3C3C;">${stories}</span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">Units/floor</span>
          <span style="font-weight: 600; color: #3C3C3C;">${stats.totalUnits}</span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">Total units</span>
          <span style="font-weight: 600; color: #3C3C3C;">${totalUnits}</span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">Efficiency</span>
          <span style="font-weight: 600; color: ${stats.efficiency >= 0.75 ? '#87B340' : '#FAA21B'};">${(stats.efficiency * 100).toFixed(1)}%</span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">GSF/floor</span>
          <span style="font-weight: 600; color: #3C3C3C;">${formatNumber(gsfFeet)} sf</span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">Total GSF</span>
          <span style="font-weight: 600; color: #3C3C3C;">${formatNumber(totalGsfFeet)} sf</span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #747474;">Total NRSF</span>
          <span style="font-weight: 600; color: #3C3C3C;">${formatNumber(totalNrsfFeet)} sf</span>
        </div>
      </div>

      <!-- Unit Mix Section -->
      <div class="metrics-section" style="margin-bottom: 16px;">
        <div class="section-header" style="
          font-size: 11px;
          font-weight: 600;
          color: #747474;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #D9D9D9;
        ">Unit mix</div>

        ${renderUnitMixRows(stats.unitCounts, unitPercentages, unitTypes)}
      </div>

      <!-- Egress Section -->
      <div class="metrics-section">
        <div class="section-header" style="
          font-size: 11px;
          font-weight: 600;
          color: #747474;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #D9D9D9;
        ">Egress</div>

        <div class="metric-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #747474;">Dead-end</span>
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 500; color: #3C3C3C;">${deadEndFeet}'</span>
            ${renderStatusBadge(egress.deadEndStatus)}
          </span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #747474;">Travel dist</span>
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 500; color: #3C3C3C;">${travelDistFeet}'</span>
            ${renderStatusBadge(egress.travelDistanceStatus)}
          </span>
        </div>

        <div class="metric-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #747474;">Sprinklered</span>
          <span style="font-weight: 500; color: #3C3C3C;">Yes</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render all unit mix rows dynamically
 */
function renderUnitMixRows(
  unitCounts: Record<string, number>,
  unitPercentages: Record<string, number>,
  unitTypes?: DynamicUnitType[]
): string {
  // If dynamic unit types provided, use them
  if (unitTypes && unitTypes.length > 0) {
    return unitTypes.map(ut => {
      const count = unitCounts[ut.id] || 0;
      const percentage = unitPercentages[ut.id] || 0;
      return renderUnitMixRow(ut.color, ut.name, count, percentage);
    }).join('');
  }

  // Fallback to legacy hardcoded types
  const legacyTypes = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];
  return legacyTypes.map(type => {
    const count = unitCounts[type] || 0;
    const percentage = unitPercentages[type] || 0;
    return renderUnitMixRow(DEFAULT_UNIT_COLORS[type], DEFAULT_UNIT_LABELS[type], count, percentage);
  }).join('');
}

/**
 * Render a unit mix row with color indicator
 */
function renderUnitMixRow(color: string, label: string, count: number, percentage: number): string {
  return `
    <div class="metric-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="display: flex; align-items: center; gap: 8px; color: #747474;">
        <span style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${color};
        "></span>
        ${label}
      </span>
      <span style="font-weight: 500; color: #3C3C3C;">
        ${count} <span style="color: #ABABAB; font-weight: 400;">(${percentage}%)</span>
      </span>
    </div>
  `;
}

/**
 * Render a pass/fail status badge
 */
function renderStatusBadge(status: 'Pass' | 'Fail'): string {
  const isPass = status === 'Pass';

  return `
    <span style="
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      background: ${isPass ? '#e8f5e1' : '#fdeaea'};
      color: ${isPass ? '#87B340' : '#EB5555'};
    ">
      ${isPass ? '✓' : '✗'} ${status}
    </span>
  `;
}

/**
 * Render an empty metrics panel placeholder
 */
export function renderEmptyMetricsPanel(): string {
  return `
    <div class="metrics-panel" style="padding: 16px; font-family: var(--forma-font-family, 'Artifakt Element', -apple-system, sans-serif);">
      <div style="color: #ABABAB; text-align: center; padding: 40px 20px;">
        <div style="font-size: 11px;">Generate a floorplate to see metrics</div>
      </div>
    </div>
  `;
}
