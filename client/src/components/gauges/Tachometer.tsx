import { useMemo } from 'react';
import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_HEX_DIM, COLOR_GLOW, COLOR_GLOW_DIM } from '@/lib/colors';

interface TachometerProps {
  rpm: number;
  maxRpm: number;
  redlineRpm: number;
  shiftLightRpm: number;
  vtec?: boolean;
  color?: GaugeColor;
  multiColorZones?: boolean;
}

const REDZONE_RPM_START = 8800;
const REDZONE_RPM_END = 9000;

const MULTI_ZONE_GREEN_END = 5000;
const MULTI_ZONE_YELLOW_END = 7000;

function getMultiZoneColor(segRpm: number, isActive: boolean) {
  if (segRpm <= MULTI_ZONE_GREEN_END) {
    return {
      fillColor: isActive ? COLOR_HEX.green : COLOR_HEX_DIM.green,
      glowColor: isActive ? COLOR_GLOW.green : COLOR_GLOW_DIM.green,
    };
  } else if (segRpm <= MULTI_ZONE_YELLOW_END) {
    return {
      fillColor: isActive ? COLOR_HEX.yellow : COLOR_HEX_DIM.yellow,
      glowColor: isActive ? COLOR_GLOW.yellow : COLOR_GLOW_DIM.yellow,
    };
  } else {
    return {
      fillColor: isActive ? COLOR_HEX.red : COLOR_HEX_DIM.red,
      glowColor: isActive ? COLOR_GLOW.red : COLOR_GLOW_DIM.red,
    };
  }
}

export function Tachometer({ rpm, maxRpm, redlineRpm, shiftLightRpm, vtec, color = 'green', multiColorZones = false }: TachometerProps) {
  const barHeight = 50;
  const barWidth = 5;
  const startX = 60;
  const endX = 840;
  const centerX = 450;
  const minY = 8;
  const edgeY = 55;
  
  const curveCoeff = (edgeY - minY) / Math.pow((startX - centerX), 2);

  const rpmPercent = Math.min(rpm / maxRpm, 1);

  const activeHex = COLOR_HEX[color];
  const dimHex = COLOR_HEX_DIM[color];
  const activeGlow = COLOR_GLOW[color];
  const dimGlow = COLOR_GLOW_DIM[color];
  const redHex = COLOR_HEX.red;
  const redGlow = COLOR_GLOW.red;
  const redDimHex = COLOR_HEX_DIM.red;
  const redDimGlow = COLOR_GLOW_DIM.red;

  const segments = useMemo(() => {
    const numSegments = 90;
    const totalWidth = endX - startX;
    const segmentWidth = totalWidth / numSegments;
    
    return Array.from({ length: numSegments }, (_, i) => {
      const x = startX + i * segmentWidth + segmentWidth / 2;
      const y = curveCoeff * Math.pow(x - centerX, 2) + minY;
      
      const segRpmPercent = (i + 1) / numSegments;
      const segRpm = segRpmPercent * maxRpm;
      
      const isRedZone = segRpm >= REDZONE_RPM_START && segRpm <= REDZONE_RPM_END;
      
      const isActive = segRpmPercent <= rpmPercent;
      
      let fillColor: string;
      let glowColor: string;

      const isYellowZone = segRpm > MULTI_ZONE_GREEN_END && segRpm <= MULTI_ZONE_YELLOW_END;

      const isRedSection = segRpm > MULTI_ZONE_YELLOW_END;

      if (isRedSection) {
        fillColor = isActive ? redHex : redDimHex;
        glowColor = isActive ? redGlow : redDimGlow;
      } else if (isYellowZone) {
        fillColor = isActive ? COLOR_HEX.yellow : COLOR_HEX_DIM.yellow;
        glowColor = isActive ? COLOR_GLOW.yellow : COLOR_GLOW_DIM.yellow;
      } else if (multiColorZones) {
        const zoneColors = getMultiZoneColor(segRpm, isActive);
        fillColor = zoneColors.fillColor;
        glowColor = zoneColors.glowColor;
      } else {
        fillColor = isActive ? activeHex : dimHex;
        glowColor = isActive ? activeGlow : dimGlow;
      }
      
      return { x, y, fillColor, glowColor, isActive, segRpm, isRedZone };
    });
  }, [maxRpm, rpmPercent, startX, endX, curveCoeff, centerX, minY, activeHex, dimHex, activeGlow, dimGlow, redHex, redDimHex, redGlow, redDimGlow, multiColorZones]);

  const rpmLabels = useMemo(() => {
    const labels = [];
    const totalWidth = endX - startX;
    for (let i = 0; i <= 9; i++) {
      const x = startX + (i / 9) * totalWidth;
      const y = curveCoeff * Math.pow(x - centerX, 2) + minY + barHeight + 30;
      labels.push({ value: i, x, y });
    }
    return labels;
  }, [startX, endX, curveCoeff, centerX, minY, barHeight]);

  const ticks = useMemo(() => {
    const tickList = [];
    const totalWidth = endX - startX;
    for (let i = 0; i <= 9; i++) {
      const x = startX + (i / 9) * totalWidth;
      const baseY = curveCoeff * Math.pow(x - centerX, 2) + minY + barHeight + 4;
      tickList.push({ x, y: baseY, height: 10, isMajor: true });
      
      if (i < 9) {
        const midX = startX + ((i + 0.5) / 9) * totalWidth;
        const midY = curveCoeff * Math.pow(midX - centerX, 2) + minY + barHeight + 6;
        tickList.push({ x: midX, y: midY, height: 5, isMajor: false });
      }
    }
    return tickList;
  }, [startX, endX, curveCoeff, centerX, minY, barHeight]);

  const isShiftLight = rpm >= shiftLightRpm;
  const isRedline = rpm >= redlineRpm;

  const tickColor = multiColorZones ? COLOR_HEX.green : (color === 'white' ? '#94a3b8' : activeHex);

  return (
    <div className="relative w-full" data-testid="gauge-tachometer">
      <svg viewBox="0 0 900 150" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="tachGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="tachDimGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {segments.map((seg, i) => (
          <rect
            key={i}
            x={seg.x - barWidth / 2}
            y={seg.y}
            width={barWidth}
            height={barHeight}
            fill={seg.fillColor}
            rx="1"
            opacity={seg.isActive ? 1 : 0.4}
            filter={seg.isActive ? 'url(#tachGlow)' : 'url(#tachDimGlow)'}
          />
        ))}
        
        {ticks.map((tick, idx) => (
          <rect
            key={idx}
            x={tick.x - 1}
            y={tick.y}
            width={tick.isMajor ? 2 : 1}
            height={tick.height}
            fill={tickColor}
            opacity={tick.isMajor ? 0.9 : 0.5}
          />
        ))}
        
        {rpmLabels.map((label, idx) => (
          <text
            key={idx}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize="18"
            fontFamily="Arial, sans-serif"
            fontWeight="500"
          >
            {label.value}
          </text>
        ))}
        
        <text
          x={startX}
          y={145}
          textAnchor="start"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize="11"
          fontFamily="Arial, sans-serif"
          opacity="0.7"
        >
          x1000r/min
        </text>
        
        {vtec && (
          <text
            x={centerX}
            y={75}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={activeHex}
            fontSize="14"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            letterSpacing="0.1em"
            filter="url(#tachGlow)"
          >
            VTEC
          </text>
        )}
        
        {isShiftLight && (
          <g>
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={750 + i * 24}
                cy={20}
                r="10"
                fill={isRedline ? '#ef4444' : '#f97316'}
                filter="url(#tachGlow)"
              >
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur="0.2s"
                  repeatCount="indefinite"
                  begin={`${i * 0.06}s`}
                />
              </circle>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
